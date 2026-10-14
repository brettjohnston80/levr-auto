import "server-only";
import { createAdminClient } from "./supabase/admin";
import { createAgentLogin, isAgentAccount, linkAgentLogin } from "./agent-accounts";
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

import { SETUP_LINK_LIFETIME } from "./agent-invite-lifetime";
export { SETUP_LINK_LIFETIME };

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

export type AddAgentResult =
  | { ok: true; agentId: string; levrid: number | null; name: string; email: string }
  | { ok: false; error: string; added?: { agentId: string; levrid: number | null; name: string; email: string } };

export type ResendResult = { ok: true; email: string } | { ok: false; error: string };

const toRole = (r: unknown) => (r === "lead" || r === "admin" ? r : "agent") as "agent" | "lead" | "admin";

// The database's own messages, in the wording on the Add-agent page (plan section 3.8).
function friendlyDbError(message: string): string {
  if (/only admins can add a lead or an admin/i.test(message)) return "Only admins can add a lead or an admin.";
  if (/only leads and admins can add agents/i.test(message)) return "Only leads and admins can add agents.";
  if (/already exists/i.test(message)) return "An agent with that email already exists.";
  return message;
}

async function sendInvite(actorAgentId: string, email: string, baseUrl?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: inviter } = await admin.from("agents").select("name").eq("id", actorAgentId).maybeSingle();
  const link = await createAgentSetupLink(email, "invite", baseUrl);
  if (!link.ok) return { ok: false, error: link.error };
  const { subject, html } = inviteEmail(inviter?.name ?? "A LEVR Auto lead", link.url);
  try {
    await sendEmail({ to: email, subject, html, audience: "agent" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Add a new agent and send the invite (the Add-agent form, Chunk 1g). Permission
 * rules are the database's (add_agent / link_agent_login): leads add agents;
 * only admins add leads and admins. An existing email is refused, not re-sent.
 */
export async function addAgent(params: {
  actorAgentId: string;
  name: string;
  email: string;
  role: string;
  baseUrl?: string;
}): Promise<AddAgentResult> {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const role = toRole(params.role);
  if (!name) return { ok: false, error: "Enter a name." };
  if (name.length > 100) return { ok: false, error: "Use a shorter name." };
  const problem = agentEmailProblem(email);
  if (problem) return { ok: false, error: problem };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("agents").select("id").ilike("email", email).maybeSingle();
  if (existing) return { ok: false, error: "An agent with that email already exists." };

  const { data, error } = await admin.rpc("add_agent", {
    p_actor_agent_id: params.actorAgentId,
    p_email: email,
    p_name: name,
    p_role: role,
    // Test agents are never put in rotation; real agents get add_agent's default by role.
    p_in_rotation: email.endsWith(TEST_EMAIL_SUFFIX) ? false : null,
  });
  if (error || !data) return { ok: false, error: friendlyDbError(error?.message ?? "Could not add the agent.") };
  const agent = data as { id: string; levrid: number | null };
  const added = { agentId: agent.id, levrid: agent.levrid ?? null, name, email };

  const login = await createAgentLogin(email, agent.id);
  if (!login.ok) return { ok: false, error: login.error, added };
  const linked = await linkAgentLogin(params.actorAgentId, agent.id, login.value);
  if (!linked.ok) {
    await admin.auth.admin.deleteUser(login.value);
    return { ok: false, error: friendlyDbError(linked.error), added };
  }
  const sent = await sendInvite(params.actorAgentId, email, params.baseUrl);
  if (!sent.ok) return { ok: false, error: sent.error, added };
  return { ok: true, ...added };
}

/**
 * Send a fresh invite to an agent who hasn't finished setting up (no
 * authenticator yet). Same permission as adding: leads for agents, admins for
 * leads and admins. Creates and links the login if adding stopped before that.
 */
export async function resendAgentInvite(params: {
  actorAgentId: string;
  agentId: string;
  baseUrl?: string;
}): Promise<ResendResult> {
  const admin = createAdminClient();
  const { data: agent } = await admin
    .from("agents")
    .select("id, email, role, active, auth_user_id")
    .eq("id", params.agentId)
    .maybeSingle();
  if (!agent) return { ok: false, error: "Agent not found." };
  if (!agent.active) return { ok: false, error: "That agent is deactivated." };
  const minRole = agent.role === "agent" ? "lead" : "admin";
  const { data: allowed } = await admin.rpc("agent_has_role", { p_agent_id: params.actorAgentId, p_min_role: minRole });
  if (!allowed) {
    return { ok: false, error: minRole === "lead" ? "Only leads and admins can invite this agent." : "Only admins can invite this agent." };
  }
  if (agent.auth_user_id) {
    const { data: login } = await admin.auth.admin.getUserById(agent.auth_user_id);
    if (!login?.user || !isAgentAccount(login.user)) {
      return { ok: false, error: "This agent's login hasn't been moved to an agent-only login yet." };
    }
    const { data: listed } = await admin.auth.admin.mfa.listFactors({ userId: agent.auth_user_id });
    if ((listed?.factors ?? []).some((f) => f.status === "verified")) {
      return { ok: false, error: "This agent has already set up their sign-in." };
    }
  } else {
    const login = await createAgentLogin(agent.email, agent.id);
    if (!login.ok) return { ok: false, error: login.error };
    const linked = await linkAgentLogin(params.actorAgentId, agent.id, login.value);
    if (!linked.ok) {
      await admin.auth.admin.deleteUser(login.value);
      return { ok: false, error: friendlyDbError(linked.error) };
    }
  }
  const sent = await sendInvite(params.actorAgentId, agent.email, params.baseUrl);
  if (!sent.ok) return { ok: false, error: `The invite email didn't send: ${sent.error}` };
  return { ok: true, email: agent.email };
}
