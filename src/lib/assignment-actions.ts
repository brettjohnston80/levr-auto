"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";

/**
 * Lead reassignment (Phase 1, Chunk 3; plan open question C3). Leads and admins only, checked
 * here and again by reassign_search, which also refuses a deactivated target, requires a reason,
 * never gives a real customer's search to a test agent, and logs search_reassigned plus a
 * "manual" history row. No screen yet: the Phase 3 screens add one.
 */
export async function reassignSearch(
  searchId: string,
  newAgentId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const agent = await getAuthorizedAgent({ minRole: "lead" });
  if (!agent) return { ok: false, error: "Not authorized." };
  const trimmed = String(reason ?? "").trim();
  if (!trimmed) return { ok: false, error: "A reason is required." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("reassign_search", {
    p_search_id: String(searchId ?? ""),
    p_new_agent_id: String(newAgentId ?? ""),
    p_actor_agent_id: agent.id,
    p_reason: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/internal/outreach");
  revalidatePath("/internal/admin");
  return { ok: true };
}
