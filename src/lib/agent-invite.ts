import "server-only";
import { createAdminClient } from "./supabase/admin";
import { createAgentLogin, linkAgentLogin } from "./agent-accounts";
import { sendEmail } from "./email";
import { isProductionDeploy } from "./runtime-env";
import { TEST_EMAIL_SUFFIX } from "./test-accounts";

/**
 * Agent invites and password-reset links (Phase 1, Chunk 1c; plan section 7.5).
 *
 * Both use a one-time Supabase "recovery" link, but the email carries OUR URL,
 * /agent/accept?token_hash=…, which does nothing until the agent clicks
 * Continue (the same pattern as /auth/confirm), so an inbox scanner fetching
 * the link can't use it up. Generating a new link cancels the previous one.
 */

export type SetupPurpose = "invite" | "reset";

// How long a one-time link stays valid, in seconds. This MUST equal the
// project's "Email OTP Expiration" setting (Supabase dashboard → Authentication
// → Providers → Email), which also governs customer sign-up and reset links;
// the emails' "expires in …" text is built from it. Brett chose to keep the
// current setting (option (a), 2026-10-12). ⚠ 3600 is Supabase's default and is
// NOT YET CONFIRMED against the dashboard; confirm before deploy.
export const SETUP_LINK_LIFETIME_SECONDS = 3600;

export function linkLifetimeText(seconds: number = SETUP_LINK_LIFETIME_SECONDS): string {
  if (seconds % 3600 === 0) {
    const h = seconds / 3600;
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  const m = Math.round(seconds / 60);
  return m === 1 ? "1 minute" : `${m} minutes`;
}

export const SETUP_LINK_LIFETIME = linkLifetimeText();

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** A fresh one-time link for an existing agent login. Cancels any earlier link for it. */
export async function createAgentSetupLink(
  email: string,
  purpose: SetupPurpose,
  baseUrl: string = siteUrl(),
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return { ok: false, error: error?.message ?? "Could not create the link." };
  const url = `${baseUrl}/agent/accept?token_hash=${encodeURIComponent(tokenHash)}&purpose=${purpose}`;
  return { ok: true, url };
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Wording: plan section 3.6 (invite) and C15 (reset). Pending sign-off.
export function inviteEmail(inviterName: string, link: string) {
  return {
    subject: "You've been invited to the LEVR Auto agent dashboard",
    html: `<p>${escape(inviterName)} added you as a LEVR Auto agent. Set your password and turn on two-factor sign-in to get started. This link works once and expires in ${SETUP_LINK_LIFETIME}: <a href="${escape(link)}">${escape(link)}</a></p>`,
  };
}

export function resetEmail(link: string) {
  return {
    subject: "Reset your LEVR Auto agent password",
    html: `<p>Use this link to set a new password for the LEVR Auto agent dashboard. It works once and expires in ${SETUP_LINK_LIFETIME}. You'll still need your authenticator code to sign in. If you didn't ask for this, you can ignore this email: <a href="${escape(link)}">${escape(link)}</a></p>`,
  };
}

/** Work-email rule (C11): @levrauto.com in production; test addresses only outside it. */
export function agentEmailProblem(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(e)) return "Enter a work email address.";
  if (isProductionDeploy()) {
    return e.endsWith("@levrauto.com") ? null : "Use a @levrauto.com work email.";
  }
  return e.endsWith("@levrauto.com") || e.endsWith(TEST_EMAIL_SUFFIX)
    ? null
    : `Use a @levrauto.com work email (or a ${TEST_EMAIL_SUFFIX} test address).`;
}

export type InviteResult =
  | { ok: true; agentId: string; levrid: number | null; resent: boolean }
  | { ok: false; error: string };

/**
 * Invite a new agent, or re-send the invite to an agent who hasn't finished
 * setting up. Permission rules are the database's (add_agent / link_agent_login):
 * leads invite agents; only admins invite leads and admins.
 */
export async function inviteAgent(params: {
  actorAgentId: string;
  name: string;
  email: string;
  role: "agent" | "lead" | "admin";
  baseUrl?: string;
}): Promise<InviteResult> {
  const email = params.email.trim().toLowerCase();
  const problem = agentEmailProblem(email);
  if (problem) return { ok: false, error: problem };

  const admin = createAdminClient();
  const { data: inviter } = await admin.from("agents").select("name").eq("id", params.actorAgentId).maybeSingle();

  // 1. The agents row (with its LEVRID), unless it already exists.
  const { data: existing } = await admin
    .from("agents")
    .select("id, levrid, role, auth_user_id, active")
    .ilike("email", email)
    .maybeSingle();
  let agent = existing;
  let resent = false;
  if (!agent) {
    const { data, error } = await admin.rpc("add_agent", {
      p_actor_agent_id: params.actorAgentId,
      p_email: email,
      p_name: params.name,
      p_role: params.role,
      // Test agents are never put in rotation; real agents get add_agent's default by role.
      p_in_rotation: email.endsWith(TEST_EMAIL_SUFFIX) ? false : null,
    });
    if (error || !data) return { ok: false, error: error?.message ?? "Could not add the agent." };
    agent = data as typeof existing;
  } else {
    if (!agent.active) return { ok: false, error: "That agent is deactivated." };
    // Re-sending needs the same permission as inviting.
    const minRole = agent.role === "agent" ? "lead" : "admin";
    const { data: allowed } = await admin.rpc("agent_has_role", {
      p_agent_id: params.actorAgentId,
      p_min_role: minRole,
    });
    if (!allowed) return { ok: false, error: `Only ${minRole === "lead" ? "leads and admins" : "admins"} can invite this agent.` };
    resent = true;
  }
  if (!agent) return { ok: false, error: "Could not add the agent." };

  // 2. The agent-only login, linked to the row (only if it has none yet).
  if (!agent.auth_user_id) {
    const login = await createAgentLogin(email, agent.id);
    if (!login.ok) return { ok: false, error: login.error };
    const linked = await linkAgentLogin(params.actorAgentId, agent.id, login.value);
    if (!linked.ok) {
      await admin.auth.admin.deleteUser(login.value);
      return { ok: false, error: linked.error };
    }
  }

  // 3. The one-time link, by our own email.
  const link = await createAgentSetupLink(email, "invite", params.baseUrl);
  if (!link.ok) return { ok: false, error: link.error };
  const { subject, html } = inviteEmail(inviter?.name ?? "A LEVR Auto lead", link.url);
  try {
    await sendEmail({ to: email, subject, html, audience: "agent" });
  } catch (e) {
    return { ok: false, error: `The agent was set up, but the invite email failed: ${e instanceof Error ? e.message : e}` };
  }
  return { ok: true, agentId: agent.id, levrid: agent.levrid ?? null, resent };
}
