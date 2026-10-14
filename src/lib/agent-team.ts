import "server-only";
import { createAdminClient } from "./supabase/admin";
import { isProductionDeploy } from "./runtime-env";
import { isTestEmail } from "./test-accounts";
import { isAgentAccount } from "./agent-accounts";
import type { Agent, AgentRole } from "./agent-auth";

/**
 * The agents list on the Add-agent page (Phase 1, Chunk 1g). Active agents only
 * (deactivation is a later chunk). Test agents (@levrauto-test.invalid) are left
 * out in production, as every other agent list does (Step 13); outside
 * production they are shown with a TEST badge so the page can be tested.
 */

// oldLogin: linked to a login that isn't agent-only (from before agent and
// customer logins were separated; moved over by hand in Chunk 1f). No actions.
export type SignInStatus = "ready" | "invited" | "noLogin" | "oldLogin";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: AgentRole;
  levrid: number | null;
  isTest: boolean;
  status: SignInStatus;
  isYou: boolean;
  canReset: boolean;
  canResend: boolean;
}

// The persistent test admin used by automated checks (Step 13): never linked to a
// login, so the page offers no actions on it.
const PERSISTENT_TEST_ADMIN = "claude-verify-admin@levrauto-test.invalid";

const RANK: Record<AgentRole, number> = { agent: 1, lead: 2, admin: 3 };
const ROLE_ORDER: Record<AgentRole, number> = { admin: 0, lead: 1, agent: 2 };

/** Leads act on agents; admins act on anyone; nobody acts on themselves. */
export function canActOn(actor: Pick<Agent, "id" | "role">, target: { id: string; role: AgentRole }): boolean {
  if (actor.id === target.id) return false;
  const needed: AgentRole = target.role === "agent" ? "lead" : "admin";
  return RANK[actor.role] >= RANK[needed];
}

export async function getTeam(actor: Agent): Promise<TeamMember[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agents")
    .select("id, name, email, role, levrid, auth_user_id")
    .eq("active", true);
  if (error) throw new Error(`Could not load agents: ${error.message}`);
  const showTest = !isProductionDeploy();
  const rows = (data ?? []).filter((a) => showTest || !isTestEmail(a.email));

  const members = await Promise.all(
    rows.map(async (a): Promise<TeamMember> => {
      let status: SignInStatus = "noLogin";
      if (a.auth_user_id) {
        const { data: login } = await admin.auth.admin.getUserById(a.auth_user_id);
        if (!login?.user || !isAgentAccount(login.user)) status = "oldLogin";
        else status = (login.user.factors ?? []).some((f) => f.status === "verified") ? "ready" : "invited";
      }
      const role = a.role as AgentRole;
      const allowed = canActOn(actor, { id: a.id, role }) && a.email.toLowerCase() !== PERSISTENT_TEST_ADMIN;
      return {
        id: a.id,
        name: a.name,
        email: a.email,
        role,
        levrid: a.levrid ?? null,
        isTest: isTestEmail(a.email),
        status,
        isYou: a.id === actor.id,
        canReset: allowed && status === "ready",
        canResend: allowed && (status === "invited" || status === "noLogin"),
      };
    }),
  );
  return members.sort(
    (x, y) => Number(x.isTest) - Number(y.isTest) || ROLE_ORDER[x.role] - ROLE_ORDER[y.role] || x.name.localeCompare(y.name),
  );
}
