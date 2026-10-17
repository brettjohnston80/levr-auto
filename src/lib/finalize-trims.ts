import { listingPowertrainClass, type BodyChoice, type ListingBody, type PowertrainClass } from "./configurator-matching";
// Aggregates real synced listings.trim data into distinct trim options for
// the finalize flow -- so the self-service trim picker (finalize-self-
// service.tsx) shows actual current inventory and price ranges for the
// customer's already-chosen make/model, rather than a blind text field.
// Deliberately plain data transformation, not a server action.

export interface TrimOption {
  id: string;
  trim: string;
  year: number | null;
  count: number;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  /**
   * Set only when this option is one powertrain of a trim name MarketCheck
   * uses for more than one (2026-10-11): e.g. Subaru Forester "Premium" gas
   * vs. hybrid, Honda Civic "Sport". Absent for every ordinary option.
   */
  powertrain?: PowertrainClass;
  /**
   * Set only when this option is one body of a trim our research has a row
   * per body for (2026-10-16): e.g. "Scat Pack 2-Door" / "Scat Pack 4-Door".
   * The research row's body_style; the option matches only that row.
   */
  body?: string;
  /** With `body`: the inventory trim name before the body was added to the label (what's matched). */
  baseTrim?: string;
}

type TrimListing = { trim: string | null; price_cents: number | null; year?: number | null; powertrain?: string | null } & ListingBody;

/** For one trim+year, how to put a listing on a research body; null when there's nothing to split. */
export type BodySplitter = (trim: string, year: number | null) => ((listing: ListingBody) => BodyChoice | null) | null;

// Label suffix for a split-out powertrain. Wording pending Brett's sign-off.
const POWERTRAIN_SUFFIX: Partial<Record<PowertrainClass, string>> = {
  HYBRID: "Hybrid",
  PHEV: "Plug-in Hybrid",
  EV: "Electric",
  FCEV: "Fuel Cell",
};

function labelFor(trim: string, cls: PowertrainClass): string {
  const suffix = POWERTRAIN_SUFFIX[cls];
  if (!suffix) return trim; // gas keeps the plain trim name
  return new RegExp(`\\b${suffix}\\b`, "i").test(trim) ? trim : `${trim} ${suffix}`;
}

function addListing(map: Map<string, TrimOption>, key: string, trim: string, year: number | null, price: number | null, powertrain?: PowertrainClass, body?: string, baseTrim?: string) {
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    if (price != null) {
      existing.minPriceCents = existing.minPriceCents == null ? price : Math.min(existing.minPriceCents, price);
      existing.maxPriceCents = existing.maxPriceCents == null ? price : Math.max(existing.maxPriceCents, price);
    }
  } else {
    map.set(key, {
      id: key,
      trim,
      year,
      count: 1,
      minPriceCents: price,
      maxPriceCents: price,
      ...(powertrain ? { powertrain } : {}),
      ...(body ? { body, baseTrim } : {}),
    });
  }
}

export function buildTrimOptions(listings: TrimListing[], bodySplitter?: BodySplitter): TrimOption[] {
  // Which known powertrains each trim+year group carries.
  const classesByGroup = new Map<string, Map<PowertrainClass, number>>();
  for (const listing of listings) {
    if (!listing.trim) continue;
    const key = `${listing.trim}::${listing.year ?? "unknown"}`;
    const cls = listingPowertrainClass(listing.powertrain);
    if (cls === "UNKNOWN") continue;
    const counts = classesByGroup.get(key) ?? new Map<PowertrainClass, number>();
    counts.set(cls, (counts.get(cls) ?? 0) + 1);
    classesByGroup.set(key, counts);
  }

  // Body split (2026-10-16): only for a trim+year our research has a row
  // per body for; each option is named and matched by its body. A listing whose body can't be read joins the
  // most common one. Without a splitter (or with nothing to split) every
  // option is exactly as before.
  const bodyOf = new Map<TrimListing, BodyChoice>();
  if (bodySplitter) {
    const groups = new Map<string, TrimListing[]>();
    for (const l of listings) if (l.trim) { const k = `${l.trim}::${l.year ?? "unknown"}`; groups.set(k, [...(groups.get(k) ?? []), l]); }
    for (const group of groups.values()) {
      const classify = bodySplitter(group[0].trim as string, group[0].year ?? null);
      if (!classify) continue;
      const choices = new Map<TrimListing, BodyChoice>();
      const counts = new Map<string, { choice: BodyChoice; n: number }>();
      for (const l of group) {
        const c = classify(l);
        if (!c) continue;
        choices.set(l, c);
        counts.set(c.body, { choice: c, n: (counts.get(c.body)?.n ?? 0) + 1 });
      }
      // One body among the listings still gets its name: our research has a
      // row per body, so without it the option can't match either row.
      if (counts.size === 0) continue;
      const common = [...counts.values()].sort((a, b) => b.n - a.n)[0].choice;
      for (const l of group) bodyOf.set(l, choices.get(l) ?? common);
    }
  }

  const byTrim = new Map<string, TrimOption>();
  for (const listing of listings) {
    if (!listing.trim) continue;
    const year = listing.year ?? null;
    const key = `${listing.trim}::${year ?? "unknown"}`;
    const counts = classesByGroup.get(key);
    const body = bodyOf.get(listing);
    let label = listing.trim;
    let cls: PowertrainClass | undefined;
    if (counts && counts.size > 1) {
      // Several powertrains under one trim name: one option per powertrain.
      // A listing with no known powertrain joins the most common one.
      cls = listingPowertrainClass(listing.powertrain);
      if (cls === "UNKNOWN") cls = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      label = labelFor(listing.trim, cls);
    }
    const baseTrim = label;
    if (body) label = `${label} ${body.label}`;
    if (!cls && !body) {
      // One powertrain (or none known), one body: exactly as before.
      addListing(byTrim, key, listing.trim, year, listing.price_cents);
      continue;
    }
    // Keyed by label, so it lines up with a separate MarketCheck trim that
    // already carries the same name (e.g. "SEL Sport Hybrid"): one option.
    addListing(byTrim, `${label}::${year ?? "unknown"}`, label, year, listing.price_cents, cls, body?.body, baseTrim);
  }

  return [...byTrim.values()].sort(
    (a, b) => (a.minPriceCents ?? 0) - (b.minPriceCents ?? 0) || (a.year ?? 0) - (b.year ?? 0),
  );
}

/**
 * Narrows listings to the model year the search committed to (2026-09-14).
 *
 * ⚠ THE ONE PLACE THIS FILTER LIVES, and both finalize surfaces must call
 * it: the customer's /finalize page and the agent-facing finalization
 * queue (outreach-queue.ts -> AgentFinalizeSearchForm). Filtering only one
 * would make the two disagree about which trims the same search can have
 * -- the exact hazard 5d195da closed when year was first threaded through.
 *
 * Applied to LISTINGS, before buildTrimOptions, which stays byte-for-byte
 * unchanged. That is what preserves 5d195da's equivalence guarantee: for a
 * committed year the output is exactly buildTrimOptions's own options for
 * that year, in the same order, and for a make/model whose inventory is
 * all one year it is identical to the unfiltered output.
 *
 * A null committed year -- undecided searches, and rows predating the
 * required year -- returns the listings untouched, i.e. today's behaviour.
 */
export function filterListingsToCommittedYear<T extends { year?: number | null }>(
  listings: T[],
  committedYear: number | null,
): T[] {
  if (committedYear == null) return listings;
  return listings.filter((l) => l.year === committedYear);
}
