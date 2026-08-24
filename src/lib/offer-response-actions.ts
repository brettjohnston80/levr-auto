"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { logNotificationEvent } from "./notifications";

export interface RespondToOfferResult {
  ok: boolean;
  error?: string;
}

/**
 * Records a customer's accept/decline on a qualifying offer. Sets
 * customer_responded_at, which is what the sold-before-response guarantee
 * edge case (see src/lib/guarantee.ts) checks against the 24h window
 * starting at delivered_at.
 *
 * Guarded by `.eq("status", "pending")` on the write, not just a pre-check —
 * mirrors the delivered_at IS NULL guard in customer-dashboard.ts — so a
 * double-click or concurrent request can't overwrite an already-recorded
 * response.
 */
export async function respondToOffer(
  offerId: string,
  response: "accepted" | "declined"
): Promise<RespondToOfferResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const admin = createAdminClient();

  const { data: offer, error: offerError } = await admin
    .from("qualifying_offers")
    .select("id, customer_search_id, dealer_name")
    .eq("id", offerId)
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

  const newStatus = response === "accepted" ? "customer_accepted" : "customer_declined";

  const { data: updated, error: updateError } = await admin
    .from("qualifying_offers")
    .update({ customer_responded_at: new Date().toISOString(), status: newStatus })
    .eq("id", offerId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: `Failed to save your response: ${updateError.message}` };
  }
  if (!updated) {
    return { ok: false, error: "You've already responded to this offer." };
  }

  await logNotificationEvent({
    customerSearchId: offer.customer_search_id,
    eventType: "offer_response_recorded",
    eventData: { dealerName: offer.dealer_name, response },
  });

  revalidatePath("/account");
  return { ok: true };
}
