import type { Answers, Powertrain, VehicleType } from "./matchmaker-data";
import { fuelTypeToPowertrain, type MatchmakerVehicle } from "./matchmaker-vehicle-display";

// Rank position (1st, 2nd, ...) -> weight, per the approved scoring spec
// (matchmaker-scoring-spec-2026-08-29.md, Section 6). Index 0 = 1st place.
export const RANK_WEIGHTS = [100, 75, 50, 40, 30, 25, 20, 15, 10];

// Minimum-only filter, per the approved spec's actual filter rule (not its
// own bucket label, which is displayed as "6+"): "1-2" has no filter at
// all, "3-5" excludes under 3 seats, "6+" excludes under 6 seats. "" means
// the step hasn't been reached yet.
function minSeatsForFamilySize(familySize: string): number {
  if (familySize === "3-5") return 3;
  if (familySize === "6+") return 6;
  return 0;
}

// Hard filters -- a vehicle failing any of these is excluded entirely, not
// soft-weighted. Powertrain is deliberately NOT here (segmented display
// only, built in Step 4) and Main Use is NOT here (dimension-priority
// pre-fill, a separate follow-up per the approved plan).
export function passesHardFilters(vehicle: MatchmakerVehicle, answers: Answers): boolean {
  if (answers.vehicleType !== "" && vehicle.bodyStyle !== answers.vehicleType) {
    return false;
  }

  const minSeats = minSeatsForFamilySize(answers.familySize);
  if (minSeats > 0 && (vehicle.seatingCapacity === null || vehicle.seatingCapacity < minSeats)) {
    return false;
  }

  if (answers.priceRange !== null) {
    if (vehicle.trueStartingPriceCents === null) return false;
    const minCents = Math.round(answers.priceRange.min * 100);
    const maxCents = Math.round(answers.priceRange.max * 100);
    if (vehicle.trueStartingPriceCents < minCents || vehicle.trueStartingPriceCents > maxCents) {
      return false;
    }
  }

  return true;
}

// Each vehicle's precomputed 0-100 scores (already relative to its
// body-style class -- see matchmaker_scoring_pipeline.py) multiplied by
// the rank-weight of wherever the customer placed that dimension, summed.
// Pure arithmetic on already-computed numbers -- never recalculates a
// score, only combines them, matching the approved spec exactly.
export function weightedTotal(vehicle: MatchmakerVehicle, priorityOrder: string[]): number {
  let total = 0;
  priorityOrder.forEach((label, index) => {
    const weight = RANK_WEIGHTS[index] ?? 0;
    const score = vehicle.scores[label] ?? 0;
    total += score * weight;
  });
  return total;
}

export type MatchedVehicle = MatchmakerVehicle & { totalScore: number };

// Hard-filters, then scores and sorts descending by weighted total. A
// vehicle that fails a hard filter never appears in the result at all --
// not scored, not shown at the bottom, per the approved plan.
export function getMatchedVehicles(vehicles: MatchmakerVehicle[], answers: Answers): MatchedVehicle[] {
  return vehicles
    .filter((vehicle) => passesHardFilters(vehicle, answers))
    .map((vehicle) => ({ ...vehicle, totalScore: weightedTotal(vehicle, answers.priorities) }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

// --- Powertrain segmentation (Step 4) ---------------------------------
//
// Segmented display only, per the approved plan and the scoring spec's
// own resolution (Section 4) -- powertrain preference never touches
// totalScore or re-sorts within a group. This operates strictly after
// getMatchedVehicles: hard-filtering and scoring are already done: this
// just groups and orders the already-sorted result for display.
//
// Alternative powertrains, grouped into ordered TIERS -- entries within a
// tier are equally preferred, with no order implied between them; tiers
// are themselves ordered, tier 1 being the most-preferred alternative(s).
//
// Only a few of these are things a human actually specified: Electric/Gas
// -> Hybrid as tier 1, Diesel -> Gas as tier 1, Hybrid -> {Gas, Electric}
// tied as tier 1 (all from the scoring spec's own Section 4 resolution),
// and Gas -> {Diesel, Electric} tied as tier 2, after Hybrid (Brett's
// correction, 2026-09-02, replacing this project's own earlier guess that
// had them sequentially ordered). Every other tier not covered by one of
// those is this project's own filled-in gap, not something the spec or
// Brett has actually resolved -- flagged here rather than presented as
// authoritative, since revisiting it later shouldn't come as a surprise.
const ALTERNATIVE_TIERS: Record<Powertrain, Powertrain[][]> = {
  Electric: [["Hybrid"], ["Gas"], ["Diesel"]],
  Gas: [["Hybrid"], ["Diesel", "Electric"]],
  Diesel: [["Gas"], ["Hybrid"], ["Electric"]],
  Hybrid: [["Gas", "Electric"], ["Diesel"]],
};

export const POWERTRAIN_ALTERNATIVE_LABEL: Record<Powertrain, string> = {
  Gas: "Best gas option",
  Diesel: "Best diesel option",
  Hybrid: "Best hybrid option",
  Electric: "Best electric option",
};

export type PowertrainAlternativeGroup = {
  powertrain: Powertrain;
  label: string;
  // 1-based. Groups sharing a tier are equally preferred -- don't read
  // their relative position in the `alternatives` array as a ranking.
  tier: number;
  vehicles: MatchedVehicle[];
};

export type SegmentedResults = {
  primary: MatchedVehicle[];
  alternatives: PowertrainAlternativeGroup[];
};

// Groups already hard-filtered/scored/sorted vehicles by powertrain
// preference. If no preference is set, this is a genuine no-op -- the
// full sorted list stays in `primary`, `alternatives` is empty, matching
// today's flat rendering with no preference picked. A vehicle whose raw
// fuel_type doesn't fold to any known Powertrain (never happens against
// the real v18 data, see fuelTypeToPowertrain) is excluded rather than
// guessed into a group.
export function segmentByPowertrain(
  matched: MatchedVehicle[],
  preferred: Powertrain | "",
): SegmentedResults {
  if (preferred === "") {
    return { primary: matched, alternatives: [] };
  }

  const primary: MatchedVehicle[] = [];
  const rest = new Map<Powertrain, MatchedVehicle[]>();

  for (const vehicle of matched) {
    const powertrain = fuelTypeToPowertrain(vehicle.fuelType);
    if (powertrain === null) continue;
    if (powertrain === preferred) {
      primary.push(vehicle);
    } else {
      if (!rest.has(powertrain)) rest.set(powertrain, []);
      rest.get(powertrain)!.push(vehicle);
    }
  }

  const alternatives: PowertrainAlternativeGroup[] = [];
  ALTERNATIVE_TIERS[preferred].forEach((tierPowertrains, tierIndex) => {
    for (const p of tierPowertrains) {
      if (!rest.has(p)) continue;
      alternatives.push({
        powertrain: p,
        label: POWERTRAIN_ALTERNATIVE_LABEL[p],
        tier: tierIndex + 1,
        vehicles: rest.get(p)!,
      });
    }
  });

  return { primary, alternatives };
}

// --- Model grouping (results-card redesign, planned 2026-09-02) -------
//
// Groups already hard-filtered/scored/sorted individual trim rows into one
// card per (make, model) -- e.g. Audi A5 Premium/Premium Plus/Prestige
// become one group; Audi S5 (a different model value) stays separate. The
// card's displayed price/rationale/list-position come from `headline`
// only; `variants` (headline included) back a within-card trim toggle
// that never changes the group's position in the results list.
export type ModelGroup = {
  // `${make}|${model}|${modelYear}` -- stable identity for a group
  // regardless of which variant is currently toggled active. Grouped on
  // make+model+modelYear (MY2027 support, 2026-09-01) -- previously
  // make+model only, which would have silently collapsed a 2026 and 2027
  // version of the same model into one card/switcher the moment both
  // existed, since the pipeline is deliberately blind to whether two
  // "variants" of a group actually belong to the same year. Confirmed
  // against the real 1,601-row (2026-only) dataset that no model name is
  // currently shared across different makes, same reasoning that already
  // justified keying on both make and model.
  key: string;
  make: string;
  model: string;
  modelYear: number;
  // Highest-scoring trim in the group -- drives the card's list position.
  headline: MatchedVehicle;
  // Every trim in the group, headline included, already in score-
  // descending order (see below for why no separate sort is needed).
  variants: MatchedVehicle[];
};

// Input MUST already be sorted descending by totalScore -- exactly what
// getMatchedVehicles produces, and what segmentByPowertrain's primary/
// alternatives arrays preserve (segmentation only buckets, it never
// re-sorts). This lets a single forward pass double as both "find the
// headline" (the first vehicle seen for a given key is, by construction,
// the highest scorer in that group) and "produce correctly-ordered
// groups" (a Map's iteration order is insertion order, i.e. first-seen
// order, which is already headline-score-descending since the input was)
// -- no secondary sort of the group list is needed.
//
// Deliberately meant to be called separately on segmented.primary and on
// each alternatives[i].vehicles, never once on a flat pre-segmentation
// list. A model spanning multiple powertrains (e.g. a Tucson sold as
// Gas/Hybrid/PHEV) can legitimately produce a separate group -- and a
// separate card -- per powertrain bucket it has a real entry in, rather
// than being collapsed into one card whose toggle would blur the "Other
// powertrains worth a look" section's whole purpose (approved 2026-09-02,
// see matchmaker-duplicate-investigation-and-grouping-plan-2026-09-02.md
// point 5).
export function groupByModel(matched: MatchedVehicle[]): ModelGroup[] {
  const groups = new Map<string, ModelGroup>();
  for (const vehicle of matched) {
    const key = `${vehicle.make}|${vehicle.model}|${vehicle.modelYear}`;
    const existing = groups.get(key);
    if (existing) {
      existing.variants.push(vehicle);
    } else {
      groups.set(key, {
        key,
        make: vehicle.make,
        model: vehicle.model,
        modelYear: vehicle.modelYear,
        headline: vehicle,
        variants: [vehicle],
      });
    }
  }
  return [...groups.values()];
}

// --- Comparison view (approved plan, 2026-09-02) -----------------------
//
// Derives a flagged model's full trim list directly from the raw,
// unfiltered `vehicles` array, never from `matched`. `matched` is
// answers-dependent and can lose a flagged vehicle entirely the moment an
// unrelated answer changes (e.g. switching Vehicle Type away from Sedan
// drops every Sedan from `matched`, including one the customer already
// flagged) -- this is the exact investigation finding the approved plan
// was built around, and cross-body-style comparison (a flagged Sedan next
// to a flagged Truck) is only possible if this reads from the filter-
// independent source. `ModelGroupCard`'s own trim switcher on the main
// results list stays powertrain-scoped via `groupByModel`/
// `segmentByPowertrain` instead (a Tucson flagged from its Gas card should
// only offer other Gas trims there, not the separate Hybrid/PHEV bucket
// that renders as its own "Other powertrains worth a look" card) -- this
// file used to also export a powertrain-scoped `getModelVariants` for
// `ComparisonModal`'s own trim switcher, but that was changed to the
// cross-powertrain `getAllVariantsForModel` below (2026-09-01) to match
// the "+ Add vehicle" picker's own flat trim list, and the powertrain-
// scoped version was deleted as fully unused once that switch landed.
//
// --- Standalone Comparison Tool (approved plan, 2026-09-01) ------------
//
// Body Style -> Make -> Model -> trim/drivetrain selection, entirely
// independent of the quiz's answers-filtered `matched`/hard-filter
// pipeline -- reads the raw `vehicles` array directly, same resolution
// source as the comparison view above and for the identical reason (a
// filter-independent source is what lets a customer build a comparison
// with zero quiz answers at all).
//
// Sorted alphabetically -- both are plain option lists for a picker step,
// not scored/ranked results, so alphabetical is the correct, boring
// default rather than importing any scoring concept here.
export function getMakesForBodyStyle(vehicles: MatchmakerVehicle[], bodyStyle: VehicleType): string[] {
  const makes = new Set<string>();
  for (const v of vehicles) {
    if (v.bodyStyle === bodyStyle) makes.add(v.make);
  }
  return [...makes].sort((a, b) => a.localeCompare(b));
}

export function getModelsForMakeAndBodyStyle(
  vehicles: MatchmakerVehicle[],
  bodyStyle: VehicleType,
  make: string,
): string[] {
  const models = new Set<string>();
  for (const v of vehicles) {
    if (v.bodyStyle === bodyStyle && v.make === make) models.add(v.model);
  }
  return [...models].sort((a, b) => a.localeCompare(b));
}

// MY2027 support (2026-09-01) -- distinct model years a given make+model
// spans, ascending. Not scoped to bodyStyle, same reasoning as
// getAllVariantsForModel below. Used by VehiclePickerFlow right after a
// Model pick to decide whether to show the new model-year step at all: a
// model with only one year skips it entirely (unchanged single-year
// behavior), a model with more than one shows a "which year" choice.
export function getModelYearsForMakeAndModel(
  vehicles: MatchmakerVehicle[],
  make: string,
  model: string,
): number[] {
  const years = new Set<number>();
  for (const v of vehicles) {
    if (v.make === make && v.model === model) years.add(v.modelYear);
  }
  return [...years].sort((a, b) => a - b);
}

// Deliberately NOT powertrain-scoped -- the standalone tool's confirmed
// design has no Powertrain selection step (Body Style -> Make -> Model
// only), so this returns every trim across every powertrain a Make+Model+
// modelYear spans, letting the caller show one flat trim list regardless of
// how many powertrain buckets the model has (see
// matchmaker-standalone-comparison-tool-plan-2026-09-01.md, finding 2).
// Not scoped to `bodyStyle` either -- make+model together already
// uniquely identify the real vehicles for this purpose (confirmed no
// model name is shared across different makes in the real dataset, same
// assumption groupByModel's own key already relies on), and the caller
// always already knows the body style from its own picker state.
//
// `modelYear` is a REQUIRED 4th argument (MY2027 support, 2026-09-01) --
// previously make+model only, which meant a caller could accidentally
// mix trims across model years the instant a second year for the same
// model existed. Making it required, not optional, means there's no code
// path left that can forget to scope it -- every current caller already
// has a specific vehicle/year in hand at the point it calls this (see each
// call site below), so this was never actually a hardship to thread
// through.
//
// Also used by ComparisonModal's own per-column trim switcher
// (matchmaker.tsx, 2026-09-01) -- originally that switcher was powertrain-
// scoped via a separate getModelVariants() function, which made it
// inconsistent with the "+ Add vehicle" picker one column over (a PHEV
// trim visible while adding would vanish from the switcher once added).
// getModelVariants() was deleted once ComparisonModal switched to this
// function instead -- confirmed via grep to have had zero remaining
// callers. ModelGroupCard's own trim switcher on the main results list is
// deliberately NOT part of this change -- it stays powertrain-AND-year-
// scoped via the separate groupByModel()/segmentByPowertrain() pipeline,
// since that's what makes "Other powertrains worth a look" meaningful and
// what keeps a multi-year model's cards from intermixing years.
export function getAllVariantsForModel(
  vehicles: MatchmakerVehicle[],
  make: string,
  model: string,
  modelYear: number,
): MatchmakerVehicle[] {
  return vehicles.filter((v) => v.make === make && v.model === model && v.modelYear === modelYear);
}

// Highest-scoring trim among a model's variants, by the same weightedTotal
// arithmetic used everywhere else a "headline" trim is chosen (groupByModel
// picks the highest scorer as a ModelGroup's headline; getMatchedVehicles
// sorts by the identical total). Used by VehiclePickerFlow (matchmaker.tsx,
// Standalone Comparison Tool follow-up, 2026-09-01) to auto-select a trim
// the instant a model is picked, rather than showing a separate Trim step
// -- the customer adjusts which trim is actually shown afterward via the
// comparison column's own trim switcher (getAllVariantsForModel above), not
// during picking.
//
// `priorityOrder` is always the vehicle's own body style's NEUTRAL default
// order (matchmaker-data.ts's defaultPriorityOrder), never live quiz/
// standalone priorities -- a deliberate choice, not an oversight:
// VehiclePickerFlow is used before any priorities necessarily exist yet
// (the very first pick of a standalone bootstrap, before standalonePriorities
// is computed), and using a fixed, always-available default keeps its
// behavior identical across every call site rather than subtly differing
// depending on what happened to already be in state. `variants` must be
// non-empty -- only ever called with getAllVariantsForModel's own output
// for a model that was just offered as a real option in the picker, so it
// always has at least one trim.
export function pickHighestScoringVariant(
  variants: MatchmakerVehicle[],
  priorityOrder: string[],
): MatchmakerVehicle {
  return variants.reduce((best, v) =>
    weightedTotal(v, priorityOrder) > weightedTotal(best, priorityOrder) ? v : best,
  );
}
