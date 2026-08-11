"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";

export interface RequestAddonRemovalResult {
  ok: boolean;
  error?: string;
}

const REREQUESTABLE_STATUSES = ["none", "dealer_declined", "dealer_countered"];

/**
 * Customer flags a specific add-on/fee on an offer for removal. Routes to
 * the agent via the outreach queue to actually negotiate with the dealer —
 * never automated. A customer can re-request after a decline/counter (a new
 * round), which overwrites the prior round's dealer_response/timestamps —
 * see the comment on offer_addons in the schema for the trade-off.
 */
export async function requestAddonRemoval(addonId: string): Promise<RequestAddonRemovalResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const admin = createAdminClient();

  const { data: addon, error: addonError } = await admin
    .from("offer_addons")
    .select("id, qualifying_offer_id, removal_status")
    .eq("id", addonId)
    .maybeSingle();

  if (addonError || !addon) {
    return { ok: false, error: "That add-on no longer exists." };
  }

  const { data: offer, error: offerError } = await admin
    .from("qualifying_offers")
    .select("customer_search_id")
    .eq("id", addon.qualifying_offer_id)
    .maybeSingle();

  if (offerError || !offer) {
    return { ok: false, error: "That offer no longer exists." };
  }

  const { data: search, error: searchError } = await admin
    .from("customer_searches")
    .select("customer_id")
    .eq("id", offer.customer_search_id)
    .maybeSingle();

  if (searchError || !search || search.customer_id !== user.id) {
    return { ok: false, error: "Not authorized." };
  }

  if (!REREQUESTABLE_STATUSES.includes(addon.removal_status)) {
    return { ok: false, error: "A request is already in progress for this add-on." };
  }

  const { data: updated, error: updateError } = await admin
    .from("offer_addons")
    .update({
      removal_status: "pending",
      removal_requested_at: new Date().toISOString(),
      dealer_response: null,
      removal_resolved_at: null,
    })
    .eq("id", addonId)
    .in("removal_status", REREQUESTABLE_STATUSES)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: `Failed to submit request: ${updateError.message}` };
  }
  if (!updated) {
    return { ok: false, error: "A request is already in progress for this add-on." };
  }

  revalidatePath("/account");
  return { ok: true };
}
