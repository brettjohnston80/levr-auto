"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";

export type BypassActionResult = { ok: true } | { ok: false; error: string };

/**
 * Extension side of the hidden agent bypass (Pass 3 of the Day-60
 * paused-state policy, CLAUDE.md) — grants exactly +30 days on any search,
 * no eligibility restriction, without a real Stripe charge. The actual
 * deadline update + agent_bypass_log insert happen atomically inside
 * grant_extension_bypass (20260816140000_agent_bypass_log.sql) — this
 * action just validates input and authorizes the caller, same shape as
 * switchCustomerSearch.
 */
export async function grantExtensionBypass(formData: FormData): Promise<BypassActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const searchId = formData.get("search_id")?.toString();
  const reasonCategory = formData.get("reason_category")?.toString();
  const notes = formData.get("notes")?.toString().trim() || null;

  if (!searchId) {
    return { ok: false, error: "No search selected." };
  }
  if (!reasonCategory) {
    return { ok: false, error: "A reason is required." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("grant_extension_bypass", {
    p_search_id: searchId,
    p_agent_id: agent.id,
    p_reason_category: reasonCategory,
    p_notes: notes,
  });

  if (error) {
    return { ok: false, error: `Failed to grant extension: ${error.message}` };
  }

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}
