import "server-only";
import { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";

/**
 * Two-factor reset (Phase 1, Chunk 1e; plan section 7.5, C12).
 *   - Leads reset agents; admins reset anyone; nobody resets their own.
 *   - Ends every session on the agent's login (revoke_login_sessions, Step 14:
 *     deleting an authenticator alone does NOT end an open session), then
 *     removes every authenticator, so the agent's next sign-in goes to enrollment.
 *   - Logged as agent_two_factor_reset (by the lead/admin) and the agent is
 *     emailed.
 * Before resetting, the lead/admin confirms it's really the agent by phone or
 * video, never by email alone (team guide rule).
 */

export type TwoFactorResetResult =
  | { ok: true; agentId: string; sessionsEnded: number; factorsRemoved: number; emailed: boolean }
  | { ok: false; error: string };

const RANK: Record<string, number> = { agent: 1, lead: 2, admin: 3 };
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Wording: plan section 3.6 (pending sign-off).
export function twoFactorResetEmail(actorName: string) {
  return {
    subject: "Your LEVR Auto two-factor sign-in was reset",
    html: `<p>${escape(actorName)} reset your two-factor sign-in. The next time you sign in, you'll set it up again. If you didn't ask for this, contact ${escape(actorName)} straight away.</p>`,
  };
}

export async function resetAgentTwoFactor(params: {
  actorAgentId: string;
  subjectAgentId: string;
}): Promise<TwoFactorResetResult> {
  const admin = createAdminClient();
  const [{ data: actor }, { data: subject }] = await Promise.all([
    admin.from("agents").select("id, name, role, active").eq("id", params.actorAgentId).maybeSingle(),
    admin.from("agents").select("id, name, email, role, active, levrid, auth_user_id").eq("id", params.subjectAgentId).maybeSingle(),
  ]);
  if (!actor?.active) return { ok: false, error: "Not authorized." };
  if (!subject) return { ok: false, error: "Agent not found." };
  if (actor.id === subject.id) return { ok: false, error: "You can't reset your own two-factor sign-in." };
  const needed = subject.role === "agent" ? "lead" : "admin";
  if ((RANK[actor.role] ?? 0) < RANK[needed]) {
    return {
      ok: false,
      error: needed === "lead" ? "Only leads and admins can reset an agent's two-factor sign-in." : "Only admins can reset a lead's or an admin's two-factor sign-in.",
    };
  }
  if (!subject.auth_user_id) return { ok: false, error: "That agent hasn't set up a login yet." };

  // 1. Sign the agent out everywhere FIRST (Step 14): deleting an authenticator
  //    alone leaves an open two-factor session working (verified 2026-10-14).
  //    If this fails, nothing has changed yet.
  const { data: sessionsEnded, error: revokeError } = await admin.rpc("revoke_login_sessions", {
    p_auth_user_id: subject.auth_user_id,
  });
  if (revokeError) return { ok: false, error: `Could not sign the agent out: ${revokeError.message}` };

  // 2. Remove every authenticator, so the next sign-in sets one up again.
  const { data: listed, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: subject.auth_user_id });
  if (listError) return { ok: false, error: `Could not read the agent's two-factor sign-in: ${listError.message}` };
  let removed = 0;
  for (const f of listed?.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: subject.auth_user_id });
    if (error) return { ok: false, error: `Could not remove an authenticator: ${error.message}` };
    removed++;
  }

  await admin.rpc("log_agent_activity", {
    p_agent_id: actor.id,
    p_action: "agent_two_factor_reset",
    p_details: { agent_id: subject.id, levrid: subject.levrid, factors_removed: removed, sessions_ended: sessionsEnded ?? 0 },
  });

  let emailed = false;
  try {
    const { subject: s, html } = twoFactorResetEmail(actor.name);
    await sendEmail({ to: subject.email, toName: subject.name, subject: s, html, audience: "agent" });
    emailed = true;
  } catch (e) {
    console.error("[agent-2fa-reset] email failed", e instanceof Error ? e.message : e);
  }
  return { ok: true, agentId: subject.id, sessionsEnded: sessionsEnded ?? 0, factorsRemoved: removed, emailed };
}
