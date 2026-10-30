/**
 * The Log Offer listing picker (offer entry, Chunk 6; plan 5.0 step 2): synced listings for the
 * search's make, model and model year, filtered to the customer's ranked trims ("All trims"
 * shows the rest), nearest first. Pure and import-free (unit tested directly). Reads only what's
 * already synced: no MarketCheck calls.
 */

export interface PickerListing {
  id: string;
  trim: string | null;
  year: number | null;
  priceCents: number | null;
  miles: number | null;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function pickerListings<T extends PickerListing>(
  listings: T[],
  opts: { modelYear: number | null; customerTrims: string[]; allTrims: boolean },
): T[] {
  const trims = new Set(opts.customerTrims.map(norm).filter(Boolean));
  return listings
    .filter((l) => opts.modelYear == null || l.year == null || l.year === opts.modelYear)
    .filter((l) => opts.allTrims || trims.size === 0 || trims.has(norm(l.trim)))
    .sort((a, b) => {
      const ma = a.miles ?? Infinity, mb = b.miles ?? Infinity;
      if (ma !== mb) return ma - mb;
      return (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity);
    });
}

/** "✓" when the listing's colour is one the customer ranked, "not their pick" otherwise, null with no picks or colour. */
export function colourMatch(colour: string | null, picks: string[]): "match" | "not_pick" | null {
  const v = norm(colour);
  const p = picks.map(norm).filter(Boolean);
  if (!v || p.length === 0) return null;
  return p.some((x) => v.includes(x) || x.includes(v)) ? "match" : "not_pick";
}

export const vinLast8 = (vin: string | null) => (vin ? `…${vin.slice(-8)}` : "—");
