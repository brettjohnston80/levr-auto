import { toCompareOffer, valueCents } from "./offer-comparison";
import { compareByOtd } from "./offer-comparison-rows";
import type { DashboardOffer } from "./customer-dashboard";

// Your Deal sorting (2026-09-26). Lives in the URL (?sort=), not stored per
// customer. Offer entry (Chunk 10, approved 2026-10-25): the default is "Best
// total price", which now sorts by out-the-door, so the "Lowest out-the-door"
// badge and the top of the list agree.

export type OfferSort = "discount" | "price" | "closest";
export const DEFAULT_OFFER_SORT: OfferSort = "price";

// Approved copy (2026-09-26).
export const OFFER_SORT_LABEL = "Sort by";
export const OFFER_SORT_OPTIONS: { value: OfferSort; label: string }[] = [
  { value: "price", label: "Best total price" },
  { value: "discount", label: "Best discount" },
  { value: "closest", label: "Closest" },
];

export function parseOfferSort(value: string | undefined): OfferSort {
  return value === "discount" || value === "closest" ? value : DEFAULT_OFFER_SORT;
}

// Status beats the sort: an accepted offer stays pinned first, declined and
// released offers sink; the chosen sort orders what's in between.
function statusRank(status: string): number {
  if (status === "customer_accepted") return 0;
  if (status === "pending") return 1;
  return 2;
}

// Delivery-inclusive (2026-10-10).
const savingsOf = (o: DashboardOffer) => valueCents(o);

export function sortOffers(offers: DashboardOffer[], sort: OfferSort): DashboardOffer[] {
  return [...offers].sort((a, b) => {
    const s = statusRank(a.status) - statusRank(b.status);
    if (s !== 0) return s;
    if (sort === "price") {
      // By out-the-door, offers without one last; within each group, offers
      // still waiting on a delivery estimate sort after the known ones (Brett,
      // 2026-10-10), then price + delivery as before.
      return compareByOtd(toCompareOffer(a), toCompareOffer(b));
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
