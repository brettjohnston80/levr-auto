"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { isAgentAccount } from "./agent-accounts";
import { cameFromSetupLink, currentAgentLogin, verifiedTotpFactorId } from "./agent-session";
import { createAgentSetupLink, resetEmail } from "./agent-invite";
import { sendEmail } from "./email";
import { passwordProblem } from "./password-rules";
import { AGENT_LINK_INVALID, AGENT_PASSWORDS_DONT_MATCH } from "./agent-setup-copy";
import {
  AGENT_SIGNIN_GENERIC_ERROR,
  AGENT_SIGNIN_TOO_MANY,
  isSigninRateLimited,
  normalizeSigninEmail,
  padFailure,
  recordSigninAttempt,
  signinKeys,
} from "./agent-signin";

/**
 * Invite / password reset / two-factor enrollment (Phase 1, Chunk 1c; plan 7.5, C15).
 * Wording pending Brett's sign-off.
 */

export type FormState = { error?: string; done?: boolean };


// 1. /agent/accept: the click that uses the one-time link.
export async function acceptAgentLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const tokenHash = (formData.get("token_hash") as string | null) ?? "";
  if (!tokenHash) return { error: AGENT_LINK_INVALID };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (error || !data.user) return { error: AGENT_LINK_INVALID };
  const login = await currentAgentLogin();
  if (!login || !isAgentAccount(data.user)) {
    // A customer's reset link, or an agent no longer active: refuse and sign this browser out.
    await supabase.auth.signOut({ scope: "local" });
    return { error: AGENT_LINK_INVALID };
  }
  redirect("/agent/set-password");
}

// 2. /agent/set-password
export async function setAgentPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const login = await currentAgentLogin();
  if (!login || !(await cameFromSetupLink(login.supabase))) redirect("/agent");
  const password = (formData.get("password") as string | null) ?? "";
  const confirm = (formData.get("confirm") as string | null) ?? "";
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: AGENT_PASSWORDS_DONT_MATCH };

  // Set through the admin API: Supabase refuses a self-service password change
  // at the first sign-in level once an authenticator is on, which is exactly the
  // reset case. The one-time link above is what proves it's the agent.
  // Supabase signs the login out of EVERY session when the password changes this
  // way (checked 2026-10-12), which is what a reset should do: any other device
  // is signed out. So sign this browser straight back in with the new password.
  const admin = createAdminClient();
  const email = login.user.email ?? "";
  const { error } = await admin.auth.admin.updateUserById(login.user.id, { password });
  if (error) return { error: error.message };
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) redirect("/agent");

  if (await verifiedTotpFactorId(supabase)) redirect("/agent");
  redirect("/agent/enroll");
}

// 3a. /agent/enroll: start a new authenticator. Called ONCE from the browser
// (a page render can happen more than once per visit, and each enroll call
// creates a factor). Removes any earlier unfinished one first.
export type EnrollStart = { ok: true; factorId: string; qrCode: string; secret: string } | { ok: false };

export async function startAgentEnrollment(): Promise<EnrollStart> {
  const login = await currentAgentLogin();
  if (!login || (await verifiedTotpFactorId(login.supabase))) return { ok: false };
  const { data: factors } = await login.supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.status !== "verified") await login.supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await login.supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${crypto.randomUUID().slice(0, 8)}`,
  });
  if (error || !data) {
    console.error("[agent-enroll] could not start enrollment", error?.message);
    return { ok: false };
  }
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

// 3. /agent/enroll: confirm the first authenticator code.
export async function enrollAgentFactor(_prev: FormState, formData: FormData): Promise<FormState> {
  const startedAt = Date.now();
  const login = await currentAgentLogin();
  if (!login) redirect("/agent");
  const factorId = (formData.get("factor_id") as string | null) ?? "";
  const code = ((formData.get("code") as string | null) ?? "").replace(/\s+/g, "");

  let keys;
  try {
    keys = await signinKeys(login.user.email ?? "");
  } catch (e) {
    console.error("[agent-enroll] cannot hash details", e instanceof Error ? e.message : e);
    await padFailure(startedAt);
    return { error: AGENT_SIGNIN_GENERIC_ERROR };
  }
  if (await isSigninRateLimited(keys)) {
    await padFailure(startedAt);
    return { error: AGENT_SIGNIN_TOO_MANY };
  }

  const { data: factors } = await login.supabase.auth.mfa.listFactors();
  const mine = factors?.all?.find((f) => f.id === factorId && f.factor_type === "totp");
  const ok =
    !!mine &&
    /^\d{6}$/.test(code) &&
    !(await login.supabase.auth.mfa.challengeAndVerify({ factorId, code })).error;
  if (!ok) {
    await recordSigninAttempt(keys, "two_factor", false);
    await padFailure(startedAt);
    return { error: AGENT_SIGNIN_GENERIC_ERROR };
  }
  await recordSigninAttempt(keys, "two_factor", true);
  const admin = createAdminClient();
  await admin.rpc("log_agent_activity", {
    p_agent_id: login.agent.id,
    p_action: "agent_two_factor_enrolled",
    p_details: { agent_id: login.agent.id, levrid: login.agent.levrid },
  });
  redirect("/internal/outreach");
}

// 4. /agent/forgot-password (C15). Always the same answer, the same minimum time.
const RESET_COOLDOWN_MINUTES = 5;

export async function requestAgentPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const startedAt = Date.now();
  const email = normalizeSigninEmail(formData.get("email") as string | null);
  // Everything that depends on whether the address is an agent runs AFTER the
  // response is sent, so the answer takes the same time either way.
  if (email) after(() => sendAgentResetIfEligible(email));
  await padFailure(startedAt);
  return { done: true };
}

async function sendAgentResetIfEligible(email: string): Promise<void> {
  try {
    const keys = await signinKeys(email);
    if (await isSigninRateLimited(keys)) return;
    const admin = createAdminClient();
    const { data: agent } = await admin
      .from("agents")
      .select("id, auth_user_id, active")
      .ilike("email", email)
      .maybeSingle();
    if (!agent?.active || !agent.auth_user_id) return;
    const { data: u } = await admin.auth.admin.getUserById(agent.auth_user_id);
    if (!u?.user || !isAgentAccount(u.user)) return;
    // One email per account per few minutes (Supabase records when the last link was made).
    const last = u.user.recovery_sent_at ? Date.parse(u.user.recovery_sent_at) : 0;
    if (Date.now() - last < RESET_COOLDOWN_MINUTES * 60_000) return;
    const to = u.user.email ?? email;
    const link = await createAgentSetupLink(to, "reset");
    if (!link.ok) {
      console.error("[agent-reset] link failed", link.error);
      return;
    }
    const { subject, html } = resetEmail(link.url);
    await sendEmail({ to, subject, html, audience: "agent" });
  } catch (e) {
    console.error("[agent-reset] failed", e instanceof Error ? e.message : e);
  }
}
