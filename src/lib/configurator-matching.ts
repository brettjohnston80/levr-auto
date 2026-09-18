// Matching between real inventory and configurator data (step 7 of 9).
//
// Pure functions and types only -- no DB access, no server imports. This
// file is imported by BOTH the server-side question builder
// (configurator-questions.ts) and the client-side question components, so
// it must never pull in the Supabase admin client. Same split, and the
// same reason, as matchmaker-vehicle-display.ts vs matchmaker-vehicles.ts:
// importing a server-only module from a "use client" component drags that
// import into the client bundle and breaks the build.
//
import type { ColorSwatchValue } from "@/lib/vehicle-color-swatches";

// WHAT THIS SOLVES. Inventory is the source of truth for what a customer
// can actually buy (buildTrimOptions, derived from real synced listings),
// and the configurator dataset is a separate research artifact. The two
// disagree about trim NAMES in ways that are systematic rather than random,
// measured against real production rows on 2026-09-09:
//
//   Honda Accord   MarketCheck PREFIXES: "Hybrid Sport"; dataset: "Sport"
//   Honda CR-V     the reverse: MarketCheck "Sport-L"; dataset
//                  "Sport-L Hybrid"
//   Toyota RAV4    one trim name spans BOTH the Hybrid and the PHEV build
//
// Matching on the raw strings caught 21 of 35 real inventory trims (60%),
// and 3 of those 21 were ambiguous -- 18 usable, 51.4%. Stripping the
// powertrain token and then re-qualifying by actual powertrain caught 34
// of 35 with a single ambiguity left: 33 usable, 94.3%.

/**
 * Coarse powertrain class. Deliberately coarse: it exists to tell a gas
 * build apart from a hybrid one, not to model drivetrain nuance.
 */
export type PowertrainClass = "GAS" | "HYBRID" | "PHEV" | "EV" | "FCEV" | "UNKNOWN";

/**
 * Tokens that describe a POWERTRAIN rather than a trim level, and which
 * one source includes in the trim string while the other does not.
 * Stripping them is only safe because every match is re-qualified by
 * powertrain afterwards -- see matchConfiguratorTrim.
 *
 * Deliberately NOT stripped: "i-FORCE MAX" (Toyota's hybrid branding on
 * Tundra/Tacoma) is carried as part of the real trim name in this dataset,
 * and removing it would collapse genuinely distinct trims together.
 */
const POWERTRAIN_TOKENS = /\b(hybrid|hev|phev|plug-?in|e:?hev|electric|ev)\b/gi;

/**
 * Reduces a trim name to its comparable core: powertrain tokens removed,
 * punctuation flattened, whitespace collapsed, lowercased. "Sport-L
 * Hybrid", "Hybrid Sport-L" and "Sport-L" all reduce to "sport l".
 */
export function normalizeTrimForMatch(trim: string): string {
  return trim
    .toLowerCase()
    .replace(POWERTRAIN_TOKENS, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * configurator_trims.fuel_type -> PowertrainClass.
 *
 * The real values are not a clean enum -- alongside "Gas"/"Hybrid"/"PHEV"/
 * "EV"/"Hydrogen" the dataset carries qualified variants like
 * "Hybrid (2.5L Hybrid)", "Hybrid (i-FORCE MAX)" and "Hybrid MAX", so this
 * matches on prefix rather than equality. Anything unrecognized returns
 * UNKNOWN, which can never qualify a match -- fails closed.
 */
export function configuratorFuelClass(fuelType: string | null | undefined): PowertrainClass {
  const f = (fuelType ?? "").trim().toLowerCase();
  if (f.startsWith("phev") || f.includes("plug")) return "PHEV";
  if (f.startsWith("hybrid")) return "HYBRID";
  if (f.startsWith("hydrogen") || f.includes("fcev")) return "FCEV";
  if (f.startsWith("ev") || f.includes("electric")) return "EV";
  if (f.startsWith("gas")) return "GAS";
  return "UNKNOWN";
}

/**
 * MarketCheck's build.powertrain_type -> PowertrainClass.
 *
 * This field, not build.fuel_type, is the real signal. fuel_type is the
 * fuel the engine burns and reads "Unleaded" on essentially everything --
 * including the Accord Hybrids and the entire (hybrid-only) Camry line --
 * so it cannot separate a hybrid from a gas build at all. powertrain_type
 * carries "Combustion" / "HEV" and does.
 */
export function listingPowertrainClass(powertrainType: string | null | undefined): PowertrainClass {
  const p = (powertrainType ?? "").trim().toLowerCase();
  if (p.includes("phev") || p.includes("plug")) return "PHEV";
  if (p.includes("hev") || p.includes("hybrid")) return "HYBRID";
  if (p.includes("fcev") || p.includes("hydrogen")) return "FCEV";
  if (p.includes("bev") || p.includes("electric")) return "EV";
  if (p.includes("combustion") || p.includes("ice") || p.includes("gas")) return "GAS";
  return "UNKNOWN";
}

/** The subset of a configurator_trims row matching needs. */
export interface ConfiguratorTrimCandidate {
  id: string;
  make: string;
  model: string;
  trim: string;
  modelYear: number;
  fuelType: string | null;
}

/** What we know about one inventory-derived trim option. */
export interface InventoryTrimFacts {
  trim: string;
  year: number | null;
  /** Every powertrain class seen across the listings in this group. */
  powertrains: PowertrainClass[];
}

export type MatchOutcome =
  | { matched: true; configuratorTrimId: string }
  | { matched: false; reason: "no_candidates" | "ambiguous_trim" | "mixed_powertrain" };

/**
 * Resolves one inventory trim option to at most one configurator trim.
 *
 * The rule is deliberately strict: EXACTLY ONE qualified candidate, or no
 * match at all. A near-miss is not worth guessing at -- falling back to
 * today's flow costs the customer a richer set of questions, while a wrong
 * guess hands an agent a gas trim's colours and packages for a hybrid car
 * and sends them to negotiate for something that cannot be built. Silence
 * is cheaper than confident error here.
 *
 * A group carrying more than one KNOWN powertrain is refused outright, even
 * when only one candidate qualifies. Real example: Honda Civic Sport 2026
 * is a single MarketCheck trim string covering 222 gas and 129 hybrid
 * listings. buildTrimOptions groups on trim and year, so the customer picks
 * one option that means two different cars -- and there is no answer to
 * "which colours does it come in" that is right for both.
 */
export function matchConfiguratorTrim(
  candidates: ConfiguratorTrimCandidate[],
  facts: InventoryTrimFacts,
): MatchOutcome {
  const knownPowertrains = [...new Set(facts.powertrains.filter((p) => p !== "UNKNOWN"))];
  if (knownPowertrains.length > 1) {
    return { matched: false, reason: "mixed_powertrain" };
  }

  const wanted = normalizeTrimForMatch(facts.trim);
  const sameTrim = candidates.filter(
    (c) => c.modelYear === facts.year && normalizeTrimForMatch(c.trim) === wanted,
  );
  if (sameTrim.length === 0) {
    return { matched: false, reason: "no_candidates" };
  }

  // One name, one powertrain: qualify by class. An UNKNOWN class on either
  // side never qualifies, so unrecognized data falls back rather than
  // guessing.
  const qualified = sameTrim.filter((c) => {
    const cls = configuratorFuelClass(c.fuelType);
    return cls !== "UNKNOWN" && knownPowertrains.includes(cls);
  });

  if (qualified.length === 1) {
    return { matched: true, configuratorTrimId: qualified[0].id };
  }
  if (qualified.length > 1) {
    return { matched: false, reason: "ambiguous_trim" };
  }

  // Nothing qualified on powertrain. If the trim name resolved to exactly
  // one candidate and inventory told us nothing usable about powertrain,
  // the name alone is still an unambiguous answer -- accept it. Anything
  // more than one candidate stays a refusal.
  if (sameTrim.length === 1 && knownPowertrains.length === 0) {
    return { matched: true, configuratorTrimId: sameTrim[0].id };
  }
  return { matched: false, reason: "ambiguous_trim" };
}

// ---------------------------------------------------------------------------
// Question shapes -- shared with the client components.
// ---------------------------------------------------------------------------

export type OptionAvailability = "standard" | "standalone" | "package_only";

/**
 * A colour, interior or seating layout is a CHOICE even when it costs
 * nothing -- a car has exactly one exterior colour, and the free ones are
 * the most common answer. Excluding 'standard' there would throw away most
 * of the question. 'unavailable' is excluded everywhere: never offer what
 * the car cannot be built with.
 *
 * Lives here, not in the server-only configurator-questions.ts, because the
 * ranked-trim-union redesign (2026-09-16) needs the identical rule
 * evaluated BOTH client-side (finalize-self-service.tsx's step-visibility
 * decision) and server-side (finalize-actions.ts's min-one-ranked
 * engagement gate) -- a client component cannot import a `server-only`
 * file at all, so this is what makes sharing one definition possible
 * instead of risking two independently-written copies drifting apart.
 */
export const CHOICE_AVAILABILITY = new Set(["standard", "standalone", "package_only"]);

/**
 * Whether a category counts as a real, offered choice ACROSS a set of
 * trims -- more than one DISTINCT real option somewhere in the set, not
 * more than one ROW. That distinction only starts mattering once rows from
 * more than one trim are merged: the same option name can legitimately
 * exist on several trims (a shared cloth interior, say), and counting rows
 * instead of distinct names would silently inflate the count -- a single
 * real option could misreport as ">1" the instant a second ranked trim
 * happens to offer the exact same name. (The single-trim predicate this
 * replaced never had to guard against this, because one trim's own option
 * rows never repeat a name.)
 *
 * Used identically by the server's min-one-ranked engagement gate
 * (finalize-actions.ts) and the client's step-visibility decision
 * (finalize-self-service.tsx), both fed the union of rows across the
 * customer's currently-ranked, resolved trims -- same function, same
 * import, so the two cannot drift on what "worth asking" means.
 */
export function categoryHasRealChoiceAcrossTrims(
  rows: { availability: string; name: string }[],
): boolean {
  const names = new Set(
    rows.filter((r) => CHOICE_AVAILABILITY.has(r.availability)).map((r) => r.name),
  );
  return names.size > 1;
}

/** One selectable answer, carrying everything the agent will need. */
export interface ConfiguratorChoice {
  name: string;
  availability: OptionAvailability;
  /** Integer cents. NULL means genuinely unknown -- never render as $0. */
  priceCents: number | null;
  priceIsIncluded: boolean;
  packageName: string | null;
  packagePriceCents: number | null;
  packageContents: string[] | null;
  /**
   * Real photo of this colour or feature on this vehicle, when one exists
   * on disk. NULL is the normal case for almost every make -- callers
   * render the option with no image rather than a placeholder. See
   * vehicle-color-images.ts and vehicle-feature-images.ts, each behind its
   * own switch.
   */
  imageUrl?: string | null;
  /**
   * A small colour-code swatch, ALONGSIDE imageUrl -- never a replacement
   * for the real photo. Only ever set for exterior_color/interior; null
   * for trim, seating and feature choices, and for any colour we don't
   * have a hand-checked code for. See vehicle-color-swatches.ts.
   *
   * Type-only import: vehicle-color-swatches.ts pulls in the server-only
   * vehicle-color-images.ts (fs access) for its toggle constant, and this
   * file is shared with client components (see the file header). A
   * type-only import is erased entirely at build time -- same proven
   * pattern as ModelYearOptions in model-year-select.ts -- so this cannot
   * drag fs into the client bundle the way a value import would.
   */
  swatch?: ColorSwatchValue | null;
}

/**
 * Free/standard first, then cheapest first, then alphabetical.
 *
 * Lives here, not in the server-only configurator-questions.ts, because the
 * model-wide union display (finalize-self-service.tsx) needs the identical
 * ordering for its rankable/auto-excluded lists -- same sharing reason as
 * CHOICE_AVAILABILITY above.
 */
export function sortChoices(a: ConfiguratorChoice, b: ConfiguratorChoice): number {
  const rank = (c: ConfiguratorChoice) => (c.availability === "standard" ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  const price = (c: ConfiguratorChoice) =>
    c.packagePriceCents ?? c.priceCents ?? Number.MAX_SAFE_INTEGER;
  if (price(a) !== price(b)) return price(a) - price(b);
  return a.name.localeCompare(b.name);
}

/**
 * The questions one matched trim earns. An empty array means the question
 * is not asked at all rather than rendered empty.
 *
 * The three `*Raw` fields (2026-09-16) are this SAME trim's real
 * availability data before the "is this worth asking about, for this trim
 * ALONE" atLeastTwo gate is applied -- exteriorColor/interior/seating are
 * exactly atLeastTwo(exteriorColorRaw/interiorRaw/seatingRaw), never a
 * separately-fetched or separately-computed list. The ranked-trim-union
 * redesign needs a trim's real availability regardless of whether that one
 * trim alone clears the bar (Nightshade's single real interior colour is
 * a genuine fact about Nightshade even though asking about it in isolation
 * would be a statement, not a question) -- these fields exist so that fact
 * is no longer thrown away. Features has no Raw counterpart: `features`
 * was never atLeastTwo-gated, so it already IS this trim's raw list.
 */
export interface ConfiguratorQuestions {
  configuratorTrimId: string;
  exteriorColor: ConfiguratorChoice[];
  interior: ConfiguratorChoice[];
  seating: ConfiguratorChoice[];
  features: ConfiguratorChoice[];
  exteriorColorRaw: ConfiguratorChoice[];
  interiorRaw: ConfiguratorChoice[];
  seatingRaw: ConfiguratorChoice[];
  /**
   * Names only (2026-09-17, combination preferences UI) -- feature names
   * that are `standard` on THIS trim, i.e. already included and never
   * offered as a customer choice, so they never appear in `features`
   * itself (see FEATURE_AVAILABILITY in configurator-questions.ts). The
   * combinations step needs this to tell "doesn't include" (a wanted
   * feature that is neither standard nor obtainable here) apart from
   * "already comes with it" (standard -- nothing to flag), and to flag an
   * excluded feature the trim forces on the customer regardless
   * ("can't be removed on this trim").
   */
  featuresStandard: string[];
  /**
   * Wheels / roof / drivetrain (2026-09-19, trim comparison view) -- real
   * researched categories that exist in `configurator_options` and were
   * always imported, but never fetched into this type before now, because
   * nothing customer-facing ever asked about them: there is no ranked
   * question or feature checklist for wheels/roof/drivetrain, only the
   * comparison table and the single-trim detail modal read these.
   *
   * CHOICE_AVAILABILITY-filtered (standard + standalone + package_only,
   * `unavailable` excluded), same rule as exteriorColorRaw/interiorRaw/
   * seatingRaw -- but deliberately NOT split into a gated vs. Raw pair,
   * and NOT split into an obtainable-vs-`*Standard` pair the way features
   * is: there is no atLeastTwo gate here (nothing asks a question), and no
   * want/exclude distinction to make (nothing here is ever ranked or
   * refused), so one plain list per category is the whole shape needed.
   *
   * ⚠ REAL DATA SHAPE, WORTH KNOWING BEFORE RENDERING THESE. Confirmed
   * against real Camry/Civic/Accord/CR-V/RAV4 rows before this field
   * existed:
   *   - `wheels` is almost always exactly ONE `standard` row (a specific
   *     real wheel spec, e.g. "17-Inch Silver-Painted Alloy Wheels") --
   *     the spec itself is a genuine per-trim fact worth showing even
   *     with no alternative, and a few trims (Civic LX, CR-V LX, RAV4
   *     Limited) ALSO carry a real `standalone`/`package_only` upgrade.
   *   - `roof` behaves closest to a real `feature` row -- `unavailable`,
   *     `standard`, or a priced `standalone`/`package_only` moonroof --
   *     but is NOT safe to silently merge into the `features` union: at
   *     least one real model (RAV4) has the identical name ("Moonroof")
   *     appear in BOTH `feature` and `roof` with different research
   *     wording elsewhere (Camry: "moonroof" under `feature`, "Power
   *     tilt/slide moonroof" under `roof`, same $870) -- a genuine
   *     upstream research duplication across two categories, not a bug to
   *     fix here. Rendered as its own separate row/section, never unioned
   *     with `features`, so nothing is silently deduped or double-counted
   *     on a guess.
   *   - `drivetrain` is the least uniform: a trim can carry SEVERAL
   *     simultaneous `standard` rows describing genuinely different real
   *     facts at once (engine, transmission, drive layout -- RAV4 Woodland
   *     has 6, describing both its real hybrid AND plug-in-hybrid builds
   *     under the identical trim name), not a small closed set of named
   *     alternatives to pick between. Only some trims (Honda CR-V is the
   *     clean case) carry a genuine priced `standalone` alternative (FWD
   *     standard, AWD +$1,500). See trim-comparison.ts's summarizers for
   *     how this shape is compressed for a comparison cell vs. shown in
   *     full in the detail modal.
   */
  wheels: ConfiguratorChoice[];
  roof: ConfiguratorChoice[];
  drivetrain: ConfiguratorChoice[];
}

export function hasAnyQuestion(q: ConfiguratorQuestions): boolean {
  return (
    q.exteriorColor.length > 0 ||
    q.interior.length > 0 ||
    q.seating.length > 0 ||
    q.features.length > 0
  );
}

/** An option the customer never touched, that no ranked trim offers. */
export interface AutoExcludedChoice {
  choice: ConfiguratorChoice;
  note: string;
  /**
   * Real trim ids that DO offer this (2026-09-17) -- empty for Case B
   * (genuinely offered nowhere in the model). Powers the "Add it"
   * quick-link; the note text alone only has display NAMES, not ids to
   * navigate with.
   */
  offeringTrimIds: string[];
}

/**
 * Collapses a trim's own feature rows into rankable PACKAGES rather than
 * individual features (2026-09-18, features-become-ranked-packages). A
 * package is identified by packageName ?? name -- a standalone feature
 * (packageName null) is already its own single-item package, identified by
 * its own name, and passes through unchanged.
 *
 * This is the ONLY change needed to make packages a real ranked category:
 * fed into computeCategoryAvailability as
 * `rawChoicesFor = (q) => groupIntoPackages(q.features)`, which already
 * dedupes/tie-breaks by ConfiguratorChoice.name generically and needs no
 * changes of its own -- this function's whole job is making `.name` mean
 * "the package label" for this one category, before that shared machinery
 * ever sees it.
 *
 * Price/package fields (packagePriceCents, packageContents, etc.) come
 * straight from the first member encountered -- confirmed against real
 * data (Camry LE's Cold Weather Package) that every feature row belonging
 * to the same package on the same trim already carries an IDENTICAL copy
 * of those fields, so there is no real choice being made here, only a
 * representative picked from otherwise-duplicate data.
 */
export function groupIntoPackages(features: ConfiguratorChoice[]): ConfiguratorChoice[] {
  const byPackage = new Map<string, ConfiguratorChoice[]>();
  for (const f of features) {
    const key = f.packageName ?? f.name;
    const list = byPackage.get(key) ?? [];
    list.push(f);
    byPackage.set(key, list);
  }
  const result: ConfiguratorChoice[] = [];
  for (const [key, members] of byPackage) {
    const first = members[0];
    // Standalone (packageName null) already has name === key -- nothing to
    // rename, so pass it through as-is rather than manufacturing a new
    // object for the common case (real data: standalone outnumbers
    // package-grouped roughly 3:2 across live Toyota/Honda trims).
    result.push(first.packageName == null ? first : { ...first, name: key });
  }
  return result;
}

/**
 * Partitions every real option across "the model" -- every trim already
 * resolved to a real researched build via real inventory, whether ranked
 * or not -- into what's rankable given the customer's CURRENTLY RANKED
 * trims, and what isn't (2026-09-16 full-transparency redesign). "The
 * model" is deliberately scoped to matchedTrimIds (real inventory-backed
 * trims), never the wider researched dataset independent of live
 * inventory -- a trim with no real listings can't be added to the ranking
 * anyway, so surfacing it here would be a dead end with nothing to add.
 *
 * Deduped by NAME across trims (the same colour can legitimately exist on
 * several trims), tie-broken deterministically for which trim's copy of
 * price/package fields is shown: the customer's highest-ranked trim that
 * offers it, else the first trim encountered in `matchedTrimIds` order.
 *
 * "Rankable" = offered by at least one of the customer's CURRENTLY RANKED
 * trims. Everything else is "auto-excluded" -- a live-computed fact, never
 * a persisted row (search_option_selections' own contract is that silence
 * means no opinion; this is neither an opinion nor silence, it's a fact
 * about trim availability, and belongs nowhere near that table). Each
 * auto-excluded item's note names which OTHER real trim(s) -- from the
 * full matched set, not just ranked -- do offer it (Case A). Case B (no
 * trim offers it at all) is a defensive fallback that should be
 * structurally UNREACHABLE through this function alone: a name can only
 * ever enter `byName` below because some matched trim's raw choices
 * contained it, so "offered nowhere" can only apply to something outside
 * this function's own input -- e.g. a customer's already-answered
 * selection whose name no longer matches any current trim's data, a
 * different (Step 6) concern this function doesn't try to solve.
 */
export function computeCategoryAvailability(
  matchedTrimIds: string[],
  rankedTrimIds: string[],
  configuratorQuestions: Record<string, ConfiguratorQuestions>,
  rawChoicesFor: (q: ConfiguratorQuestions) => ConfiguratorChoice[],
  trimDisplayNameById: Record<string, string>,
  /**
   * Name -> the rank position the customer HAD it at, for names that are
   * currently a genuine RANKED (non-excluded) answer (2026-09-16, surgical
   * re-validation). Purely cosmetic to this function -- it never changes
   * which bucket a name lands in, only which note an auto-excluded entry
   * gets: a name the customer had actually ranked reads "Previously
   * ranked #N", everything else reads the plain "not offered" note. The
   * caller (RankedQuestion) is what actually keeps a demoted item's
   * underlying answer intact -- see its own comment for why nothing here
   * ever deletes anything.
   */
  currentlyRankedPositions: Map<string, number> = new Map(),
): { rankable: ConfiguratorChoice[]; autoExcluded: AutoExcludedChoice[] } {
  const rankedSet = new Set(rankedTrimIds);
  const trimRank = new Map(rankedTrimIds.map((id, i) => [id, i]));

  const byName = new Map<string, { fallback: ConfiguratorChoice; trimIds: string[] }>();
  for (const trimId of matchedTrimIds) {
    const q = configuratorQuestions[trimId];
    if (!q) continue;
    for (const choice of rawChoicesFor(q)) {
      const entry = byName.get(choice.name);
      if (!entry) {
        byName.set(choice.name, { fallback: choice, trimIds: [trimId] });
      } else {
        entry.trimIds.push(trimId);
      }
    }
  }

  const rankable: ConfiguratorChoice[] = [];
  const autoExcluded: AutoExcludedChoice[] = [];

  for (const entry of byName.values()) {
    const rankedOfferingIds = entry.trimIds.filter((id) => rankedSet.has(id));
    if (rankedOfferingIds.length > 0) {
      const winnerId = [...rankedOfferingIds].sort(
        (a, b) => (trimRank.get(a) ?? Infinity) - (trimRank.get(b) ?? Infinity),
      )[0];
      const winnerChoice =
        rawChoicesFor(configuratorQuestions[winnerId]).find((c) => c.name === entry.fallback.name) ??
        entry.fallback;
      rankable.push(winnerChoice);
    } else {
      const offeringNames = entry.trimIds.map((id) => trimDisplayNameById[id] ?? id);
      const previousRank = currentlyRankedPositions.get(entry.fallback.name);
      const note =
        previousRank != null
          ? offeringNames.length > 0
            ? `Previously ranked #${previousRank} — not offered on your currently-selected trims. Available on ${offeringNames.join(", ")}.`
            : `Previously ranked #${previousRank} — not offered on any trim currently available for this model.`
          : offeringNames.length > 0
            ? `Not offered on any of your selected trims — available on ${offeringNames.join(", ")}. Add it to your ranking to select this.`
            : "Not offered on any trim currently available for this model.";
      autoExcluded.push({ choice: entry.fallback, note, offeringTrimIds: entry.trimIds });
    }
  }

  rankable.sort(sortChoices);
  autoExcluded.sort((a, b) => sortChoices(a.choice, b.choice));

  return { rankable, autoExcluded };
}

// ---------------------------------------------------------------------------
// Combination preferences (2026-09-17) -- once colour/interior/feature
// answers validate against the RANKED-TRIM UNION rather than one trim, a
// customer's separate per-category rankings no longer pin down one exact
// car: "LE #1, Ocean Gem #1, Cockpit Red leather #1" can describe a
// combination that exists on no single real trim (Ocean Gem only on LE,
// Cockpit Red leather only on XSE). computeRealCombinations enumerates
// every REAL (trim, colour, interior, seating) tuple the customer's
// current rankings actually produce, so they can refine among real cars
// rather than an impossible composite.
// ---------------------------------------------------------------------------

/** One real, buildable (trim, exterior colour, interior, seating) tuple. */
export interface RealCombination {
  trimId: string;
  /** Display label, e.g. "XSE" -- from trimDisplayNameById. */
  trim: string;
  /** Null means this axis was never a real question across the ranked
   *  union (categoryHasRealChoiceAcrossTrims false) -- a "no preference"
   *  placeholder, not "the customer chose nothing". */
  exteriorColor: string | null;
  interior: string | null;
  seating: string | null;
  /**
   * Sum of rank positions across trim + colour + interior + seating (a
   * "no preference" axis counts as 1) -- lower is more preferred. Purely
   * a display-ordering heuristic (see prioritizeCombinations), never
   * persisted.
   */
  rankSum: number;
}

function categoryEverRealAcrossTrims(
  rankedTrimIds: string[],
  configuratorQuestions: Record<string, ConfiguratorQuestions>,
  rawChoicesFor: (q: ConfiguratorQuestions) => ConfiguratorChoice[],
): boolean {
  const names = new Set<string>();
  for (const id of rankedTrimIds) {
    const q = configuratorQuestions[id];
    if (!q) continue;
    for (const c of rawChoicesFor(q)) names.add(c.name);
  }
  return names.size > 1;
}

/**
 * Enumerates every real combination across the customer's currently
 * ranked trims, scoped to the categories/options they've already ranked
 * (never the model's full universe -- a customer who ranked 3 colours
 * gets combinations built from those 3, not every real colour on the
 * trim). Per-trim cross product, summed across ranked trims -- NEVER a
 * union-wide cross product, which would invent combinations no real car
 * offers.
 *
 * Per-category, per-trim axis resolution (must match
 * categoryHasRealChoiceAcrossTrims's own ">1 distinct name" rule exactly,
 * not "does this trim have >=1 row" -- a category where every trim has
 * exactly one real option, or shares the identical option, was never a
 * real question and must not incorrectly zero out every trim):
 *   1. Category never a real question across the ranked union (e.g.
 *      seating, almost always) -> one implicit "no preference" value,
 *      contributing once to every trim's cross product.
 *   2. Category WAS a real question -> filter the customer's ranked names
 *      down to ones real on THIS trim. Non-empty -> cross-product with
 *      them. Empty (trim has real options here, but none the customer
 *      ranked) -> this trim contributes ZERO combinations, full stop --
 *      not a bug, a real signal that none of what the customer asked for
 *      exists on this specific trim.
 *
 * `rankedPackageNames` (2026-09-18, features-become-ranked-packages) is a
 * per-trim GATE, not a new combination axis -- combination identity stays
 * (trim, colour, interior, seating) only, unchanged from Phase 1's own
 * constraint; packages are display-only pills everywhere else in this
 * file. Optional throughout, same as the ranking step itself: an empty
 * array (nothing ranked) filters nothing, matching how a category that
 * was never a real question contributes an implicit "no preference"
 * rather than zeroing anything out. Non-empty -> the SAME "empty
 * intersection drops the trim" rule every axis above already follows: a
 * trim offering none of the customer's ranked packages (standalone or
 * bundled) contributes zero combinations, full stop.
 */
export function computeRealCombinations(
  rankedTrimIds: string[],
  configuratorQuestions: Record<string, ConfiguratorQuestions>,
  trimDisplayNameById: Record<string, string>,
  rankedColorPositions: Map<string, number>,
  rankedInteriorPositions: Map<string, number>,
  rankedSeatingPositions: Map<string, number>,
  rankedPackageNames: string[] = [],
): RealCombination[] {
  const colorEverReal = categoryEverRealAcrossTrims(rankedTrimIds, configuratorQuestions, (q) => q.exteriorColorRaw);
  const interiorEverReal = categoryEverRealAcrossTrims(rankedTrimIds, configuratorQuestions, (q) => q.interiorRaw);
  const seatingEverReal = categoryEverRealAcrossTrims(rankedTrimIds, configuratorQuestions, (q) => q.seatingRaw);

  const axisEntries = (
    q: ConfiguratorQuestions,
    everReal: boolean,
    rawChoicesFor: (qq: ConfiguratorQuestions) => ConfiguratorChoice[],
    positions: Map<string, number>,
  ): { name: string | null; position: number }[] | null => {
    if (!everReal) return [{ name: null, position: 1 }];
    const realOnTrim = new Set(rawChoicesFor(q).map((c) => c.name));
    const matched = [...positions.keys()].filter((n) => realOnTrim.has(n));
    if (matched.length === 0) return null;
    return matched.map((name) => ({ name, position: positions.get(name)! }));
  };

  const combos: RealCombination[] = [];
  rankedTrimIds.forEach((trimId, index) => {
    const q = configuratorQuestions[trimId];
    if (!q) return;
    const trimRank = index + 1;
    const trim = trimDisplayNameById[trimId] ?? trimId;

    const colorAxis = axisEntries(q, colorEverReal, (qq) => qq.exteriorColorRaw, rankedColorPositions);
    const interiorAxis = axisEntries(q, interiorEverReal, (qq) => qq.interiorRaw, rankedInteriorPositions);
    const seatingAxis = axisEntries(q, seatingEverReal, (qq) => qq.seatingRaw, rankedSeatingPositions);
    if (!colorAxis || !interiorAxis || !seatingAxis) return;

    // Package gate (2026-09-18) -- see this function's own comment above.
    if (rankedPackageNames.length > 0) {
      const trimPackageNames = new Set(groupIntoPackages(q.features).map((c) => c.name));
      const offersAnyRankedPackage = rankedPackageNames.some((name) => trimPackageNames.has(name));
      if (!offersAnyRankedPackage) return;
    }

    for (const c of colorAxis) {
      for (const i of interiorAxis) {
        for (const s of seatingAxis) {
          combos.push({
            trimId,
            trim,
            exteriorColor: c.name,
            interior: i.name,
            seating: s.name,
            rankSum: trimRank + c.position + i.position + s.position,
          });
        }
      }
    }
  });

  return combos;
}

function compareCombinations(a: RealCombination, b: RealCombination): number {
  if (a.rankSum !== b.rankSum) return a.rankSum - b.rankSum;
  if (a.trim !== b.trim) return a.trim.localeCompare(b.trim);
  const colorCmp = (a.exteriorColor ?? "").localeCompare(b.exteriorColor ?? "");
  if (colorCmp !== 0) return colorCmp;
  const interiorCmp = (a.interior ?? "").localeCompare(b.interior ?? "");
  if (interiorCmp !== 0) return interiorCmp;
  return (a.seating ?? "").localeCompare(b.seating ?? "");
}

/**
 * Stable identity for one real combination -- not carried on
 * RealCombination itself (a pure display/ordering value), so this is the
 * one place it's derived, shared between the client component (React key,
 * and mapping ranked/excluded id arrays back to full combos) and the save
 * payload builder (finalize-self-service.tsx). Each combo is already a
 * unique cross-product entry per ranked trim within one render, so this
 * can't collide there -- it is NOT used for anything server-side, which
 * re-derives identity from configuratorTrimId + colour/interior/seating
 * fields directly rather than trusting this opaque client-built string.
 */
export function combinationId(c: RealCombination): string {
  return [c.trimId, c.exteriorColor ?? " ", c.interior ?? " ", c.seating ?? " "].join("::");
}

/** Initial visible rows before a "show more" reveal. */
export const COMBINATION_INITIAL_COUNT = 5;
/** Absolute ceiling -- same "cap, don't paginate everything" precedent as
 *  Matchmaker's PRIMARY_MAX_COUNT. Anything beyond this is never shown. */
export const COMBINATION_MAX_COUNT = 10;

export interface PrioritizedCombinations {
  /** Up to COMBINATION_MAX_COUNT, best (lowest rankSum) first. */
  visible: RealCombination[];
  initialCount: number;
  /** Real combination count before capping -- for an honest "showing your
   *  top N of TOTAL" when TOTAL exceeds what's ever displayed. */
  totalReal: number;
}

/**
 * Orders and caps the full real combination set for display. Deliberately
 * NOT applied inside computeRealCombinations itself -- that function's
 * whole job is producing the correct, uncapped, real set; this is purely
 * a display concern layered on top.
 */
export function prioritizeCombinations(combinations: RealCombination[]): PrioritizedCombinations {
  const sorted = [...combinations].sort(compareCombinations);
  return {
    visible: sorted.slice(0, COMBINATION_MAX_COUNT),
    initialCount: COMBINATION_INITIAL_COUNT,
    totalReal: combinations.length,
  };
}

/**
 * One answer, as the customer's form holds it before saving.
 *
 * Replaces the must_have/like_to_have/open_to scale (tester feedback,
 * 2026-09-14). That scale asked the customer to rate each colour in
 * isolation, which is not how anyone chooses one -- they have an order of
 * preference and usually a couple they would actively refuse.
 *
 * The two ranked states are mutually exclusive and exhaustive, mirroring
 * search_option_selections_rank_shape: ranked carries a 1-based
 * rankPosition with excluded false, refused carries a null rankPosition
 * with excluded true. An option the customer did not touch produces NO
 * entry at all -- "no opinion" needs no third state and can never be
 * confused with "ranked last".
 */
export interface ConfiguratorSelection {
  category: "exterior_color" | "interior" | "seating" | "feature";
  questionKind: "ranked" | "feature";
  selection: string;
  /** 1-based position in the category's list; null when excluded or a feature. */
  rankPosition: number | null;
  /** True only for an explicitly refused ranked option. */
  excluded: boolean;
  packageName: string | null;
  packagePriceCents: number | null;
  packageContents: string[] | null;
  priceUnknown: boolean;
}

/**
 * One ranked trim preference, as the form holds it before saving.
 *
 * Trim is ranked like everything else now, but lives in its own table
 * (search_trim_preferences) because a trim option is identified by trim AND
 * model year -- "LE 2026" and "LE 2027" are different real choices with
 * different inventory and different prices. See that table's own comment.
 */
export interface TrimPreference {
  trim: string;
  /** Nullable: buildTrimOptions tolerates listings carrying no year. */
  modelYear: number | null;
  rankPosition: number | null;
  excluded: boolean;
  /**
   * Which researched build this trim resolved to, when it resolved at all.
   * NULL is the common case -- 34 of 36 makes have no configurator data.
   * Re-validated server-side before storage; never trusted as sent.
   */
  configuratorTrimId: string | null;
}

/**
 * One combination preference, as the form holds it before saving
 * (combination-preferences Phase 3, 2026-09-19). Same ranked/excluded
 * shape as TrimPreference/ConfiguratorSelection.
 *
 * `configuratorTrimId` is the real, resolved configurator build --
 * NEVER the client-side TrimOption id (RealCombination.trimId) that
 * identifies a combination in the browser. The save payload builder
 * (finalize-self-service.tsx) translates one to the other via
 * `configuratorQuestions[combo.trimId]?.configuratorTrimId`, the exact
 * same translation buildTrimPreferences() already does for trim ranking
 * -- so this carries the same structural guarantee: the server re-checks
 * this id is a member of the customer's OWN ranked-and-resolved trim set
 * (writeTrimPreferences's rankedResolvedTrimIds) before trusting it at
 * all, and the full (trim, colour, interior, seating) tuple must ALSO
 * match a combination computeRealCombinations itself derives server-side
 * -- see writeCombinationPreferences in finalize-actions.ts.
 */
export interface CombinationPreference {
  configuratorTrimId: string;
  exteriorColor: string | null;
  interior: string | null;
  seating: string | null;
  rankPosition: number | null;
  excluded: boolean;
}
