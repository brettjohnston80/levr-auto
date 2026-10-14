"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AGENT_LAST_SEEN_COOKIE } from "./supabase/middleware";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { isAgentAccount } from "./agent-accounts";
import {
  AGENT_SIGNIN_GENERIC_ERROR,
  AGENT_SIGNIN_TOO_MANY,
  isSigninRateLimited,
  normalizeSigninEmail,
  padFailure,
  recordSigninAttempt,
  signinKeys,
  type SigninKeys,
} from "./agent-signin";

/**
 * /agent sign-in (Phase 1, Chunk 1b; plan section 7.4).
 *   1. email + password;
 *   2. anything wrong (unknown email, wrong password, a customer login, an
 *      agent login with no active agents row) gets the same generic error,
 *      padded to the same minimum time;
 *   3. an agent with a verified authenticator factor goes to the code step;
 *   4. an agent with no factor yet goes to enrollment (/agent/enroll, Chunk 1c).
 * Every agent page and action re-checks all of this server-side in Chunk 1d.
 */

export type AgentSigninState =
  | { step: "password"; error?: string }
  | { step: "two_factor"; error?: string };

const DASHBOARD = "/internal/outreach";

async function activeAgentForLogin(authUserId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agents")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("active", true)
    .maybeSingle();
  return !!data;
}

async function verifiedTotpFactorId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp?.find((f) => f.status === "verified")?.id ?? null;
}

async function passwordStep(formData: FormData): Promise<AgentSigninState> {
  const startedAt = Date.now();
  const email = normalizeSigninEmail(formData.get("email") as string | null);
  const password = (formData.get("password") as string | null) ?? "";
  let keys: SigninKeys;
  try {
    keys = await signinKeys(email);
  } catch (e) {
    console.error("[agent-signin] cannot hash sign-in details", e instanceof Error ? e.message : e);
    await padFailure(startedAt);
    return { step: "password", error: AGENT_SIGNIN_GENERIC_ERROR };
  }

  if (await isSigninRateLimited(keys)) {
    await padFailure(startedAt);
    return { step: "password", error: AGENT_SIGNIN_TOO_MANY };
  }

  const fail = async (): Promise<AgentSigninState> => {
    await recordSigninAttempt(keys, "password", false);
    await padFailure(startedAt);
    return { step: "password", error: AGENT_SIGNIN_GENERIC_ERROR };
  };

  if (!email || !password) return fail();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return fail();

  if (!isAgentAccount(data.user) || !(await activeAgentForLogin(data.user.id))) {
    // A customer login, or an agent login that isn't (or is no longer) an active agent.
    await supabase.auth.signOut();
    return fail();
  }

  await recordSigninAttempt(keys, "password", true);

  if (await verifiedTotpFactorId(supabase)) {
    return { step: "two_factor" };
  }
  redirect("/agent/enroll");
}

async function codeStep(formData: FormData): Promise<AgentSigninState> {
  const startedAt = Date.now();
  const code = ((formData.get("code") as string | null) ?? "").replace(/\s+/g, "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAgentAccount(user) || !(await activeAgentForLogin(user.id))) {
    // Session gone or not an agent: start over at the password step.
    if (user) await supabase.auth.signOut();
    await padFailure(startedAt);
    return { step: "password", error: AGENT_SIGNIN_GENERIC_ERROR };
  }

  let keys: SigninKeys;
  try {
    keys = await signinKeys(user.email ?? "");
  } catch (e) {
    console.error("[agent-signin] cannot hash sign-in details", e instanceof Error ? e.message : e);
    await padFailure(startedAt);
    return { step: "two_factor", error: AGENT_SIGNIN_GENERIC_ERROR };
  }
  if (await isSigninRateLimited(keys)) {
    await padFailure(startedAt);
    return { step: "two_factor", error: AGENT_SIGNIN_TOO_MANY };
  }

  const factorId = await verifiedTotpFactorId(supabase);
  const ok =
    !!factorId &&
    /^\d{6}$/.test(code) &&
    !(await supabase.auth.mfa.challengeAndVerify({ factorId, code })).error;

  if (!ok) {
    await recordSigninAttempt(keys, "two_factor", false);
    await padFailure(startedAt);
    return { step: "two_factor", error: AGENT_SIGNIN_GENERIC_ERROR };
  }

  await recordSigninAttempt(keys, "two_factor", true);
  redirect(DASHBOARD);
}

/** The one form action: the hidden "step" field says which step was submitted. */
export async function agentSigninAction(_prev: AgentSigninState, formData: FormData): Promise<AgentSigninState> {
  return formData.get("step") === "two_factor" ? codeStep(formData) : passwordStep(formData);
}

/** Sign out of the agent dashboard (the header's Sign out). */
export async function agentSignOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete(AGENT_LAST_SEEN_COOKIE);
  redirect("/agent");
}
