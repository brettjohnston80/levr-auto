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

// Case, spacing and punctuation ignored (the same normalisation as the Log Offer form).
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

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

/** Colours MarketCheck often lists in place of the manufacturer's name. */
const GENERIC_COLOURS = new Set(["black", "white", "gray", "grey", "silver", "red", "blue", "green", "brown", "beige", "tan", "gold", "orange", "yellow", "purple", "other", "unknown"]);

/**
 * How a listed colour compares with the customer's ranked picks (Brett, 2026-10-30), for exterior
 * and interior alike: "match" only when the names are the same (case and spacing ignored);
 * "check" when one contains the other, or the listing gives a generic colour, so the agent
 * confirms from the window sticker; "not_pick" when there's no overlap. Null with no colour or
 * no picks.
 */
export function colourMatch(colour: string | null, picks: string[]): "match" | "check" | "not_pick" | null {
  const v = norm(colour);
  const p = picks.map(norm).filter(Boolean);
  if (!v || p.length === 0) return null;
  if (p.some((x) => x === v)) return "match";
  if (GENERIC_COLOURS.has(v) || p.some((x) => v.includes(x) || x.includes(v))) return "check";
  return "not_pick";
}

/** Approved agent wording (2026-10-30). */
export const COLOUR_MARK = {
  match: "✓ (their pick)",
  check: (colour: string) => `Check: listed as ${colour}`,
  notPick: "not their pick",
};

export const vinLast8 = (vin: string | null) => (vin ? `…${vin.slice(-8)}` : "—");
