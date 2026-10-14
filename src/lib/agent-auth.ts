import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { isAgentAccount } from "./agent-accounts";

/**
 * The one agent check (Phase 1, Chunk 1d; plan section 7.3). Every agent page
 * and every agent server action goes through getAuthorizedAgent() or
 * requireAgent(). On the server, every request, it needs ALL of:
 *   1. a verified session (getUser, checked by Supabase);
 *   2. an agent-only login (app_metadata.account_type = 'agent');
 *   3. an ACTIVE agents row linked to this login (agents.auth_user_id);
 *   4. two-factor completed this session (aal2).
 * The old "the signed-in email matches an agents row" check is gone: a customer
 * login can never be an agent, even with the same email.
 * The 8-hour idle sign-out (C13) happens in the proxy before this runs.
 */

export type AgentRole = "agent" | "lead" | "admin";

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: AgentRole;
  levrid: number | null;
}

type AgentCheck =
  | { ok: true; agent: Agent }
  | { ok: false; reason: "signed_out" | "not_agent" | "needs_code" | "needs_enroll" };

const RANK: Record<AgentRole, number> = { agent: 1, lead: 2, admin: 3 };

export function hasRole(agent: Pick<Agent, "role">, minRole: AgentRole): boolean {
  return RANK[agent.role] >= RANK[minRole];
}

async function checkAgent(): Promise<AgentCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "signed_out" };
  if (!isAgentAccount(user)) return { ok: false, reason: "not_agent" };

  const admin = createAdminClient();
  const { data: agent } = await admin
    .from("agents")
    .select("id, name, email, role, levrid")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!agent) return { ok: false, reason: "not_agent" };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    return { ok: false, reason: aal?.nextLevel === "aal2" ? "needs_code" : "needs_enroll" };
  }
  return { ok: true, agent: agent as Agent };
}

/** For server actions and data loaders: the agent, or null (callers return "not authorized"). */
export async function getAuthorizedAgent(opts: { minRole?: AgentRole } = {}): Promise<Agent | null> {
  const check = await checkAgent();
  if (!check.ok) return null;
  if (opts.minRole && !hasRole(check.agent, opts.minRole)) return null;
  return check.agent;
}

/**
 * For pages: the agent, or a redirect to the right sign-in step (the code step
 * and enrollment both live under /agent). A signed-in agent without the role
 * is sent to the dashboard.
 */
export async function requireAgent(opts: { minRole?: AgentRole } = {}): Promise<Agent> {
  const check = await checkAgent();
  if (!check.ok) redirect(check.reason === "needs_enroll" ? "/agent/enroll" : "/agent");
  if (opts.minRole && !hasRole(check.agent, opts.minRole)) redirect("/internal/outreach");
  return check.agent;
}
