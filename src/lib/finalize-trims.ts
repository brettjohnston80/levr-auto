// Aggregates real synced listings.trim data into distinct trim options for
// the finalize flow -- so the self-service trim picker (finalize-self-
// service.tsx) shows actual current inventory and price ranges for the
// customer's already-chosen make/model, rather than a blind text field.
// Deliberately plain data transformation, not a server action.

export interface TrimOption {
  trim: string;
  count: number;
  minPriceCents: number | null;
  maxPriceCents: number | null;
}

export function buildTrimOptions(
  listings: { trim: string | null; price_cents: number | null }[]
): TrimOption[] {
  const byTrim = new Map<string, TrimOption>();

  for (const listing of listings) {
    if (!listing.trim) continue;
    const existing = byTrim.get(listing.trim);
    if (existing) {
      existing.count += 1;
      if (listing.price_cents != null) {
        existing.minPriceCents =
          existing.minPriceCents == null
            ? listing.price_cents
            : Math.min(existing.minPriceCents, listing.price_cents);
        existing.maxPriceCents =
          existing.maxPriceCents == null
            ? listing.price_cents
            : Math.max(existing.maxPriceCents, listing.price_cents);
      }
    } else {
      byTrim.set(listing.trim, {
        trim: listing.trim,
        count: 1,
        minPriceCents: listing.price_cents,
        maxPriceCents: listing.price_cents,
      });
    }
  }

  return [...byTrim.values()].sort((a, b) => (a.minPriceCents ?? 0) - (b.minPriceCents ?? 0));
}
