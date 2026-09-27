import { computeOfferSavings } from "./offer-comparison";
import type { DashboardOffer } from "./customer-dashboard";

// Your Deal sorting (2026-09-26). Default is best discount, so the offer
// carrying the "Best value" badge (largest dollar savings) lands on top and
// the badge and the order never disagree. Lives in the URL (?sort=), not
// stored per customer.

export type OfferSort = "discount" | "price" | "closest";
export const DEFAULT_OFFER_SORT: OfferSort = "discount";

// Approved copy (2026-09-26).
export const OFFER_SORT_LABEL = "Sort by";
export const OFFER_SORT_OPTIONS: { value: OfferSort; label: string }[] = [
  { value: "discount", label: "Best discount" },
  { value: "price", label: "Best price" },
  { value: "closest", label: "Closest" },
];

export function parseOfferSort(value: string | undefined): OfferSort {
  return value === "price" || value === "closest" ? value : DEFAULT_OFFER_SORT;
}

// Status beats the sort: an accepted offer stays pinned first, declined and
// released offers sink; the chosen sort orders what's in between.
function statusRank(status: string): number {
  if (status === "customer_accepted") return 0;
  if (status === "pending") return 1;
  return 2;
}

const savingsOf = (o: DashboardOffer) => computeOfferSavings(o)?.belowMsrpCents ?? -Infinity;

export function sortOffers(offers: DashboardOffer[], sort: OfferSort): DashboardOffer[] {
  return [...offers].sort((a, b) => {
    const s = statusRank(a.status) - statusRank(b.status);
    if (s !== 0) return s;
    if (sort === "price") return a.offerPriceCents - b.offerPriceCents;
    if (sort === "closest") {
      // Unknown distances go last, then fall back to best discount.
      const ad = a.distanceMiles ?? Infinity;
      const bd = b.distanceMiles ?? Infinity;
      if (ad !== bd) return ad - bd;
    }
    return savingsOf(b) - savingsOf(a);
  });
}
