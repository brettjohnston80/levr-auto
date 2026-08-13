"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";

export interface SwitchSearchResult {
  ok: boolean;
  error?: string;
}

/**
 * Switches a customer's search to a new make/model — agent-only, run from
 * /internal/outreach on a customer's behalf (a phone/email request), never a
 * customer self-service action. The actual insert-new-row +
 * mark-old-row-superseded pair happens atomically in the
 * switch_customer_search DB function (see migrations), since two related
 * writes need to succeed or fail together and supabase-js has no
 * multi-statement transaction. The DB function re-checks the
 * not-already-switched guard under a row lock, so a race between this check
 * and the RPC call can't double-switch a search.
 *
 * Deliberately does not implement the $100 switch fee / 5-day grace period
 * from Core-Processes-v1.md §1b — the new row starts unpaid (no guarantee
 * clock) until it goes through the existing separate Stripe flow.
 */
export async function switchCustomerSearch(formData: FormData): Promise<SwitchSearchResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const oldSearchId = formData.get("old_search_id")?.toString();
  const newMake = formData.get("new_make")?.toString().trim();
  const newModel = formData.get("new_model")?.toString().trim();

  if (!oldSearchId || !newMake || !newModel) {
    return { ok: false, error: "Make and model are required." };
  }

  const admin = createAdminClient();

  const { data: oldSearch, error: oldSearchError } = await admin
    .from("customer_searches")
    .select("id, search_status, superseded_by_id")
    .eq("id", oldSearchId)
    .maybeSingle();

  if (oldSearchError || !oldSearch) {
    return { ok: false, error: "That search no longer exists." };
  }
  if (oldSearch.superseded_by_id || oldSearch.search_status === "switched") {
    return { ok: false, error: "This search has already been switched." };
  }

  const { error: rpcError } = await admin.rpc("switch_customer_search", {
    p_old_search_id: oldSearchId,
    p_new_make: newMake,
    p_new_model: newModel,
  });

  if (rpcError) {
    return { ok: false, error: `Failed to switch: ${rpcError.message}` };
  }

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}
