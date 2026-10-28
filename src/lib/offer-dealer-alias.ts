import "server-only";
import type { createAdminClient } from "./supabase/admin";
import { getOrCreateDealerAlias } from "./dealer-aliases";

/**
 * The dealer's alias for an offer (Phase 1 Chunk 2): from the linked listing's dealer identity,
 * or the typed dealer for an off-lot offer. Never fails the offer: null if it can't be resolved.
 * Shared by Log Offer (outreach-actions.ts) and the offer-entry send path (offer-submission.ts).
 */
export async function resolveOfferDealerAlias(
  admin: ReturnType<typeof createAdminClient>,
  listingId: string | null,
  dealerName: string,
  dealerCity: string | null,
  dealerState: string | null,
): Promise<string | null> {
  try {
    if (listingId) {
      const { data: listing } = await admin
        .from("listings")
        .select("dealer_name, dealer_city, dealer_state, mc_dealer_id")
        .eq("id", listingId)
        .maybeSingle();
      if (listing?.dealer_name) {
        return await getOrCreateDealerAlias(
          listing.dealer_name as string,
          (listing.dealer_city as string | null) ?? null,
          (listing.dealer_state as string | null) ?? null,
          (listing.mc_dealer_id as number | null) ?? null,
        );
      }
    }
    return await getOrCreateDealerAlias(dealerName, dealerCity, dealerState, null);
  } catch (e) {
    console.error("resolveOfferDealerAlias: dealer alias not resolved", e instanceof Error ? e.message : e);
    return null;
  }
}
