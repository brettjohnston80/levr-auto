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
}

/**
 * The questions one matched trim earns. An empty array means the question
 * is not asked at all rather than rendered empty.
 */
export interface ConfiguratorQuestions {
  configuratorTrimId: string;
  exteriorColor: ConfiguratorChoice[];
  interior: ConfiguratorChoice[];
  seating: ConfiguratorChoice[];
  features: ConfiguratorChoice[];
}

export function hasAnyQuestion(q: ConfiguratorQuestions): boolean {
  return (
    q.exteriorColor.length > 0 ||
    q.interior.length > 0 ||
    q.seating.length > 0 ||
    q.features.length > 0
  );
}

/** The three-way strength asked alongside a colour/interior/seating pick. */
export type SelectionPriority = "must_have" | "like_to_have" | "open_to";

export const PRIORITY_LABELS: Record<SelectionPriority, string> = {
  must_have: "Must have",
  like_to_have: "Would like",
  open_to: "Open to it",
};

/** One answer, as the customer's form holds it before saving. */
export interface ConfiguratorSelection {
  category: "exterior_color" | "interior" | "seating" | "feature";
  questionKind: "preference" | "feature";
  selection: string;
  /** Always set for 'preference'; always null for 'feature'. */
  priority: SelectionPriority | null;
  packageName: string | null;
  packagePriceCents: number | null;
  packageContents: string[] | null;
  priceUnknown: boolean;
}
