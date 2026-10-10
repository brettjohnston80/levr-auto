import type { DashboardOffer } from "./customer-dashboard";
import { deliveryEstimatePending, totalPriceCents } from "./delivery-estimate";

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
 * What "best value" ranks on (2026-10-10): Total SRP minus the offer price
 * plus its delivery estimate when the customer takes delivery and the figure
 * is known. Shared by the badge and the "Best discount" sort so they can't
 * disagree. The "$X below Total SRP" line stays price-only, since that's
 * what the guarantee measures.
 */
export function valueCents(offer: DashboardOffer): number {
  return offer.msrpCents - totalPriceCents(offer);
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
    if (!computeOfferSavings(offer)) continue;
    // Held until its delivery estimate arrives: a price that will go up by
    // an unknown amount can't be called the best value.
    if (deliveryEstimatePending(offer)) continue;
    const value = valueCents(offer);
    if (value > 0 && value > bestSavingsCents) {
      bestSavingsCents = value;
      bestId = offer.id;
    }
  }

  return bestId;
}

export interface OfferPriceSummary {
  count: number;
  lowestPriceCents: number;
  medianPriceCents: number;
}

/**
 * Lowest/median price across a set of offers, for a compact summary in
 * place of individual cards -- feeds a purchased search's "Your Deal" view,
 * which shows the actually-purchased offer as its own full card and
 * summarizes everything else this way rather than as N more cards.
 *
 * Deliberately knows nothing about "accepted"/"purchased" itself -- the
 * caller passes in whichever offers it wants summarized (in practice,
 * every offer except the one identified by
 * DealDetails.purchasedQualifyingOfferId), same separation of concerns as
 * bestValueOfferId/computeOfferSavings above. No status filtering beyond
 * that exclusion: a declined or still-pending offer is equally part of
 * "what else came in" on a deal that's already closed.
 *
 * Returns null for an empty input so the caller can hide the section
 * entirely rather than render "0 other offers."
 */
export function summarizeOfferPrices(offers: DashboardOffer[]): OfferPriceSummary | null {
  if (offers.length === 0) return null;

  const sortedPrices = offers.map((o) => o.offerPriceCents).sort((a, b) => a - b);
  const count = sortedPrices.length;
  const mid = Math.floor(count / 2);
  const medianPriceCents =
    count % 2 === 0 ? Math.round((sortedPrices[mid - 1] + sortedPrices[mid]) / 2) : sortedPrices[mid];

  return {
    count,
    lowestPriceCents: sortedPrices[0],
    medianPriceCents,
  };
}
