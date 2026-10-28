import type { DashboardOffer } from "./customer-dashboard";
import { deliveryEstimatePending, totalPriceCents } from "./delivery-estimate";
import { lowestOtdOfferId, type CompareOffer } from "./offer-comparison-rows";

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
 * What "Best discount" ranks on (2026-10-10): Total SRP minus the offer price
 * plus its delivery estimate when the customer takes delivery and the figure
 * is known. (It also fed the old "Best value" badge, replaced by "Lowest
 * out-the-door" in offer entry, Chunk 10.) The "$X below Total SRP" line stays price-only, since that's
 * what the guarantee measures.
 */
export function valueCents(offer: DashboardOffer): number {
  return offer.msrpCents - totalPriceCents(offer);
}

/** A Your Deal offer in the comparison's shape (offer entry, Chunk 10). */
export function toCompareOffer(offer: DashboardOffer): CompareOffer {
  return {
    id: offer.id,
    status: offer.status,
    offerPriceCents: offer.offerPriceCents,
    msrpCents: offer.msrpCents,
    vehicleExteriorColor: offer.vehicleExteriorColor,
    vehicleInteriorColor: offer.vehicleInteriorColor,
    sentToCustomerAt: offer.sentToCustomerAt,
    goodUntil: offer.goodUntil,
    otd: offer.otd,
    addons: offer.addons.map((a) => ({ description: a.description, amountCents: a.amountCents, dealerSaysRemovable: a.dealerSaysRemovable })),
    fees: offer.fees.map((f) => ({ kind: f.kind, amountCents: f.amountCents })),
    options: offer.options,
    totalPriceCents: totalPriceCents(offer),
    deliveryPending: deliveryEstimatePending(offer),
  };
}

/** "Lowest out-the-door" replaces "Best value" (plan 4.C, 6.4). */
export function lowestOtdOfferIdFor(offers: DashboardOffer[]): string | null {
  return lowestOtdOfferId(offers.map(toCompareOffer));
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
