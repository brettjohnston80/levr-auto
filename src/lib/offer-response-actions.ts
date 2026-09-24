"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { logNotificationEvent } from "./notifications";

export interface RespondToOfferResult {
  ok: boolean;
  error?: string;
}

// Approved customer-facing copy (2026-09-24).
function alreadyAcceptedMessage(dealerName: string): string {
  return `You've already accepted an offer from ${dealerName} for this search. If that deal falls through, reach out to your agent and we'll help you move to another offer.`;
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
 *
 * At most one accepted offer per search (2026-09-24). An accept is refused
 * if another offer on the same search is already customer_accepted --
 * otherwise a second, parallel closing flow opens (two PandaDoc service
 * agreements, two deposits). The pre-check gives the friendly message; the
 * partial unique index qualifying_offers_one_accepted_per_search_idx is the
 * race-proof backstop for two tabs accepting different offers at the same
 * instant, and its 23505 is mapped to the same message. Declining is never
 * restricted. A deal that falls through is released by an agent
 * (withdrawAcceptedOffer), which frees the search to accept another offer.
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

  if (response === "accepted") {
    const { data: alreadyAccepted, error: acceptedError } = await admin
      .from("qualifying_offers")
      .select("dealer_name")
      .eq("customer_search_id", offer.customer_search_id)
      .eq("status", "customer_accepted")
      .neq("id", offerId)
      .limit(1)
      .maybeSingle();

    if (acceptedError) {
      return { ok: false, error: `Failed to save your response: ${acceptedError.message}` };
    }
    if (alreadyAccepted) {
      return { ok: false, error: alreadyAcceptedMessage(alreadyAccepted.dealer_name) };
    }
  }

  const newStatus = response === "accepted" ? "customer_accepted" : "customer_declined";

  const { data: updated, error: updateError } = await admin
    .from("qualifying_offers")
    .update({ customer_responded_at: new Date().toISOString(), status: newStatus })
    .eq("id", offerId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  // Lost a race with a simultaneous accept of a different offer on this
  // search -- the partial unique index rejected this write.
  if (updateError?.code === "23505") {
    const { data: winner } = await admin
      .from("qualifying_offers")
      .select("dealer_name")
      .eq("customer_search_id", offer.customer_search_id)
      .eq("status", "customer_accepted")
      .maybeSingle();
    return { ok: false, error: alreadyAcceptedMessage(winner?.dealer_name ?? "another dealer") };
  }
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
  revalidatePath("/account/deal");
  return { ok: true };
}
