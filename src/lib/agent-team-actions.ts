"use server";

import { getAuthorizedAgent } from "./agent-auth";
import { addAgent, resendAgentInvite } from "./agent-invite";
import { resetAgentTwoFactor } from "./agent-two-factor-reset";
import { TEAM_COPY } from "./agent-team-copy";

/**
 * The Add-agent page's actions (Phase 1, Chunk 1g). Each one:
 *   - requires a signed-in, two-factor-verified, active LEAD or ADMIN
 *     (getAuthorizedAgent({ minRole: "lead" }));
 *   - takes the actor from that session, never from the browser;
 *   - then applies the finer rules (only admins add leads/admins; leads reset
 *     agents, admins anyone, never your own), which the database enforces too.
 */

export type TeamActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; resendAgentId?: string };

export async function addAgentAction(input: { name: string; email: string; role: string }): Promise<TeamActionResult> {
  const actor = await getAuthorizedAgent({ minRole: "lead" });
  if (!actor) return { ok: false, error: "Not authorized." };
  const r = await addAgent({ actorAgentId: actor.id, name: String(input?.name ?? ""), email: String(input?.email ?? ""), role: String(input?.role ?? "agent") });
  if (r.ok) return { ok: true, message: TEAM_COPY.inviteSent(r.email, r.name, r.levrid) };
  if (r.added) {
    return { ok: false, error: TEAM_COPY.inviteEmailFailed(r.added.name, r.added.levrid, r.error), resendAgentId: r.added.agentId };
  }
  return { ok: false, error: r.error };
}

export async function resendInviteAction(agentId: string): Promise<TeamActionResult> {
  const actor = await getAuthorizedAgent({ minRole: "lead" });
  if (!actor) return { ok: false, error: "Not authorized." };
  const r = await resendAgentInvite({ actorAgentId: actor.id, agentId: String(agentId ?? "") });
  return r.ok ? { ok: true, message: TEAM_COPY.resendSent(r.email) } : { ok: false, error: r.error };
}

export async function resetTwoFactorAction(agentId: string): Promise<TeamActionResult> {
  const actor = await getAuthorizedAgent({ minRole: "lead" });
  if (!actor) return { ok: false, error: "Not authorized." };
  const r = await resetAgentTwoFactor({ actorAgentId: actor.id, subjectAgentId: String(agentId ?? "") });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, message: TEAM_COPY.resetDone(r.agentName) };
}
