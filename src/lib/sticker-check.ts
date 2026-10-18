// Sticker (Total SRP) checks on the agent's Log Offer form (Brett,
// 2026-10-17). The guarantee compares the offer price with the sticker the
// agent types, so a sticker that's too high (a dealer addendum, say) could
// make an offer qualify when it shouldn't. These checks warn; they never
// block, because our own data has gaps and the window sticker is the truth.
//
// What MarketCheck's msrp holds (checked 2026-10-17 against 4,125 synced
// listings): the window-sticker total for that VIN, with destination and
// factory options. So a linked listing is the strongest comparison.
//
// Pure and client-safe: used by the form and by tests.

/** What our data says one trim's sticker should be, from the Matchmaker
 *  dataset (base + destination) and configurator option prices. */
export interface StickerRange {
  trim: string;
  /** Lowest base price + destination across rows sharing this trim name. */
  lowCents: number;
  /** Highest base + destination, plus every factory option we have a price for. */
  highCents: number;
}

// Thresholds (proposed 2026-10-17, for Brett's sign-off).
/** Same VIN, so the window sticker should match the listing almost exactly. */
export const LISTING_TOLERANCE_CENTS = 10_000; // $100
/** Below base + destination by more than this. */
export const BELOW_RANGE_TOLERANCE_CENTS = 50_000; // $500
/** Above the top of the range by more than the greater of these. Wide on
 *  purpose: our option prices are incomplete for some makes (Ford, GM). */
export const ABOVE_RANGE_TOLERANCE_CENTS = 500_000; // $5,000
export const ABOVE_RANGE_TOLERANCE_FRACTION = 0.15;

export function normalizeTrim(trim: string | null | undefined): string {
  return (trim ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The range for the trim the agent typed, matched on the name alone. */
export function findStickerRange(ranges: StickerRange[], trim: string | null | undefined): StickerRange | null {
  const t = normalizeTrim(trim);
  if (!t) return null;
  return ranges.find((r) => normalizeTrim(r.trim) === t) ?? null;
}

export interface OptionForMax {
  category: string;
  availability: string;
  priceCents: number | null;
  packageName: string | null;
  packagePriceCents: number | null;
  dealerInstalled: boolean;
}

// A car has one of each of these, so only the dearest counts.
const ONE_OF = new Set(["exterior_color", "interior", "seating", "wheels", "roof"]);

/** The most a trim's factory options can add, from our configurator prices:
 *  the dearest choice in each one-of category, plus every optional package
 *  (once each) and standalone feature. Dealer-installed items and unknown
 *  prices add nothing. */
export function maxFactoryOptionsCents(options: OptionForMax[]): number {
  const usable = options.filter((o) => !o.dealerInstalled && o.availability !== "unavailable");
  let total = 0;
  for (const cat of ONE_OF) {
    total += Math.max(0, ...usable.filter((o) => o.category === cat).map((o) => o.priceCents ?? 0));
  }
  const packages = new Map<string, number>();
  for (const o of usable) {
    if (ONE_OF.has(o.category) || o.availability === "standard") continue;
    if (o.packageName) packages.set(o.packageName, Math.max(packages.get(o.packageName) ?? 0, o.packagePriceCents ?? 0));
    else total += o.priceCents ?? 0;
  }
  for (const p of packages.values()) total += p;
  return total;
}

function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export type StickerWarningKind = "listing" | "below_range" | "above_range";
export interface StickerWarning {
  kind: StickerWarningKind;
  message: string;
}

/** Warnings for the typed sticker (proposed wording, for Brett's sign-off). */
export function stickerWarnings(
  typedCents: number | null,
  listingMsrpCents: number | null,
  range: StickerRange | null,
): StickerWarning[] {
  if (typedCents == null || !Number.isFinite(typedCents) || typedCents <= 0) return [];
  const out: StickerWarning[] = [];
  if (listingMsrpCents != null && listingMsrpCents > 0 && Math.abs(typedCents - listingMsrpCents) > LISTING_TOLERANCE_CENTS) {
    out.push({
      kind: "listing",
      message: `You entered ${dollars(typedCents)}, but the linked listing's sticker is ${dollars(listingMsrpCents)}. Check the window sticker's total — it should match the listing.`,
    });
  }
  if (range) {
    const span = range.lowCents === range.highCents ? dollars(range.lowCents) : `${dollars(range.lowCents)}–${dollars(range.highCents)}`;
    if (typedCents < range.lowCents - BELOW_RANGE_TOLERANCE_CENTS) {
      out.push({
        kind: "below_range",
        message: `You entered ${dollars(typedCents)}, which is below this trim's base price plus destination (${dollars(range.lowCents)}). Check the window sticker's total, which includes destination.`,
      });
    } else if (typedCents > range.highCents + Math.max(ABOVE_RANGE_TOLERANCE_CENTS, range.highCents * ABOVE_RANGE_TOLERANCE_FRACTION)) {
      out.push({
        kind: "above_range",
        message: `You entered ${dollars(typedCents)}, well above what this trim should cost with every factory option we know of (${span}). If the sticker includes a dealer addendum, enter only the manufacturer's total.`,
      });
    }
  }
  return out;
}
