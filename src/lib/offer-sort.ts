import { valueCents } from "./offer-comparison";
import { deliveryEstimatePending, totalPriceCents } from "./delivery-estimate";
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
  // Renamed 2026-10-10: ranks on price plus a known delivery estimate.
  { value: "price", label: "Best total price" },
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

// Delivery-inclusive (2026-10-10), the same basis as the Best value badge.
const savingsOf = (o: DashboardOffer) => valueCents(o);

export function sortOffers(offers: DashboardOffer[], sort: OfferSort): DashboardOffer[] {
  return [...offers].sort((a, b) => {
    const s = statusRank(a.status) - statusRank(b.status);
    if (s !== 0) return s;
    if (sort === "price") {
      // Offers still waiting on a delivery estimate have no real total yet,
      // so they sort after every offer whose total is known (Brett,
      // 2026-10-10); "Best discount" keeps them in place by price.
      const pa = deliveryEstimatePending(a) ? 1 : 0;
      const pb = deliveryEstimatePending(b) ? 1 : 0;
      if (pa !== pb) return pa - pb;
      return totalPriceCents(a) - totalPriceCents(b);
    }
    if (sort === "closest") {
      // Unknown distances go last, then fall back to best discount.
      const ad = a.distanceMiles ?? Infinity;
      const bd = b.distanceMiles ?? Infinity;
      if (ad !== bd) return ad - bd;
    }
    return savingsOf(b) - savingsOf(a);
  });
}
