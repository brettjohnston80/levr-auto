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
      autoExcluded.push({ choice: entry.fallback, note });
    }
  }

  rankable.sort(sortChoices);
  autoExcluded.sort((a, b) => sortChoices(a.choice, b.choice));

  return { rankable, autoExcluded };
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
