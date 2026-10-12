import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";

/**
 * Agent logins are kept separate from customer logins (Phase 1, Steps 12/12b,
 * docs/plans/agent-dashboard-phase1-code-plan.md section 7.3).
 *
 * - An agent login is created only here, server-side, with
 *   app_metadata.account_type = 'agent'. app_metadata can't be set or changed
 *   by the user, so a customer can never mark themselves an agent.
 *   user_metadata is never trusted for this.
 * - Supabase Auth writes app_metadata just after it inserts the login, so the
 *   sign-up trigger first creates a customers row, and Step 12b's trigger
 *   deletes it the moment the agent flag lands. createAgentLogin re-checks
 *   that afterwards and fails closed (deletes the new login) if a customers
 *   row is still there.
 * - agents.auth_user_id is set only through link_agent_login (invite) and
 *   relink_agent_login (Brett's cutover); a database trigger refuses any other
 *   write, and refuses a login that isn't agent-only.
 */

export const AGENT_ACCOUNT_TYPE = "agent";

/** True only for a login created as an agent (server-set app_metadata). */
export function isAgentAccount(
  user: Pick<User, "app_metadata"> | null | undefined,
): boolean {
  return user?.app_metadata?.account_type === AGENT_ACCOUNT_TYPE;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Creates an agent-only login (no password; the invite sets one). Returns the
 * new login's id. Never touches an existing login: an address that already
 * has one is refused.
 */
export async function createAgentLogin(
  email: string,
  agentId?: string,
): Promise<Result<string>> {
  const address = email.trim().toLowerCase();
  if (!address) return { ok: false, error: "An email is required." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: address,
    email_confirm: true,
    app_metadata: {
      account_type: AGENT_ACCOUNT_TYPE,
      ...(agentId ? { agent_id: agentId } : {}),
    },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Could not create the login." };
  }
  const authUserId = data.user.id;

  const { count, error: countError } = await admin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("id", authUserId);
  if (countError || count !== 0 || !isAgentAccount(data.user)) {
    // Fail closed: an agent login that is also a customer must not exist.
    await admin.auth.admin.deleteUser(authUserId);
    return {
      ok: false,
      error: countError
        ? `Could not confirm the new login is agent-only: ${countError.message}`
        : "The new login was not agent-only, so it was removed.",
    };
  }
  return { ok: true, value: authUserId };
}

export interface LinkedAgent {
  id: string;
  levrid: number | null;
  email: string;
  auth_user_id: string;
}

/** Invite step: link a new agent login to its agents row (lead/admin rules in the database). */
export async function linkAgentLogin(
  actorAgentId: string,
  agentId: string,
  authUserId: string,
): Promise<Result<LinkedAgent>> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("link_agent_login", {
    p_actor_agent_id: actorAgentId,
    p_agent_id: agentId,
    p_auth_user_id: authUserId,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Could not link the login." };
  return { ok: true, value: data as LinkedAgent };
}

/** Cutover: move an agent (LEVRID and history) to a different agent-only login. Admins only. */
export async function relinkAgentLogin(
  actorAgentId: string,
  agentId: string,
  newAuthUserId: string,
): Promise<Result<LinkedAgent>> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("relink_agent_login", {
    p_actor_agent_id: actorAgentId,
    p_agent_id: agentId,
    p_new_auth_user_id: newAuthUserId,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Could not move the login." };
  return { ok: true, value: data as LinkedAgent };
}
