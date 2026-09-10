// Aggregates real synced listings.trim data into distinct trim options for
// the finalize flow -- so the self-service trim picker (finalize-self-
// service.tsx) shows actual current inventory and price ranges for the
// customer's already-chosen make/model, rather than a blind text field.
// Deliberately plain data transformation, not a server action.

export interface TrimOption {
  // Stable identity for React keys and selection state: a trim name alone
  // is NOT unique once options are split by model year (2026-09-09) -- the
  // same trim can legitimately appear for both MY2026 and MY2027, and two
  // options sharing a key would collide in React and highlight together.
  // Format: `${trim}::${year ?? "unknown"}`.
  id: string;
  trim: string;
  // Model year this option's listings are from, or null when the synced
  // rows carry no year. `listings.year` has always been populated by the
  // sync (and filtered to current-year-or-next by
  // isTrustworthyNewListingYear), but the finalize flow discarded it --
  // so a make/model spanning two model years collapsed into one
  // undifferentiated trim list.
  year: number | null;
  count: number;
  minPriceCents: number | null;
  maxPriceCents: number | null;
}

// Grouped by trim AND year, not trim alone. Everything else about this
// function is unchanged: same count/min/max aggregation, same
// cheapest-first sort, same skip of null trims.
export function buildTrimOptions(
  listings: { trim: string | null; price_cents: number | null; year?: number | null }[]
): TrimOption[] {
  const byTrim = new Map<string, TrimOption>();

  for (const listing of listings) {
    if (!listing.trim) continue;
    const year = listing.year ?? null;
    const key = `${listing.trim}::${year ?? "unknown"}`;
    const existing = byTrim.get(key);
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
      byTrim.set(key, {
        id: key,
        trim: listing.trim,
        year,
        count: 1,
        minPriceCents: listing.price_cents,
        maxPriceCents: listing.price_cents,
      });
    }
  }

  // Primary sort unchanged (cheapest first). Year is only a tie-break, so
  // for any make/model whose listings all share one year -- the common case
  // -- the resulting order is byte-identical to before this change.
  return [...byTrim.values()].sort(
    (a, b) => (a.minPriceCents ?? 0) - (b.minPriceCents ?? 0) || (a.year ?? 0) - (b.year ?? 0),
  );
}
