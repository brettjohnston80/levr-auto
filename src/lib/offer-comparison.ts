import type { DashboardOffer } from "./customer-dashboard";

// A declined/withdrawn offer is no longer a real option, so it's excluded
// from "best value" comparison even though it still renders on the card.
const COMPARABLE_STATUSES = ["pending", "customer_accepted"];

export interface OfferSavings {
  belowMsrpCents: number;
  belowMsrpPercent: number;
}

/** Null for any offer at or above Total SRP -- nothing to show. */
export function computeOfferSavings(offer: DashboardOffer): OfferSavings | null {
  if (!offer.isBelowMsrp) return null;
  const belowMsrpCents = offer.msrpCents - offer.offerPriceCents;
  const belowMsrpPercent = Math.round((belowMsrpCents / offer.msrpCents) * 100);
  return { belowMsrpCents, belowMsrpPercent };
}

/**
 * The offer id to highlight as the best value, or null when there's nothing
 * to compare (fewer than 2 offers) or nothing worth highlighting (no live
 * offer is actually below Total SRP). "Live" = pending or already accepted
 * -- a declined/withdrawn offer isn't a real option anymore, so it's never
 * the one highlighted even if it once had the biggest discount.
 */
export function bestValueOfferId(offers: DashboardOffer[]): string | null {
  if (offers.length < 2) return null;

  let bestId: string | null = null;
  let bestSavingsCents = -Infinity;

  for (const offer of offers) {
    if (!COMPARABLE_STATUSES.includes(offer.status)) continue;
    const savings = computeOfferSavings(offer);
    if (!savings) continue;
    if (savings.belowMsrpCents > bestSavingsCents) {
      bestSavingsCents = savings.belowMsrpCents;
      bestId = offer.id;
    }
  }

  return bestId;
}
