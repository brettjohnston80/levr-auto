import type { Answers, Powertrain } from "./matchmaker-data";
import { fuelTypeToPowertrain, type MatchmakerVehicle } from "./matchmaker-vehicles";

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
// Only the single "closest alternative" is actually resolved in the spec
// (Electric/Gas -> Hybrid, Diesel -> Gas, Hybrid -> Gas & Electric tied).
// Where that leaves two or more remaining powertrains unranked against
// each other -- e.g. Diesel's own position when Electric is preferred,
// or Diesel's position at all when Gas is preferred -- the spec simply
// doesn't say. FALLBACK_ORDER fills that gap with a stable, deterministic
// order so the UI never has an undefined case, but it is NOT itself part
// of the approved spec -- flagged here rather than presented as
// authoritative, since revisiting it later shouldn't come as a surprise.
const CLOSEST_ALTERNATIVES: Record<Powertrain, Powertrain[]> = {
  Electric: ["Hybrid"],
  Gas: ["Hybrid"],
  Diesel: ["Gas"],
  Hybrid: ["Gas", "Electric"],
};

const FALLBACK_ORDER: Powertrain[] = ["Gas", "Diesel", "Hybrid", "Electric"];

export const POWERTRAIN_ALTERNATIVE_LABEL: Record<Powertrain, string> = {
  Gas: "Best gas option",
  Diesel: "Best diesel option",
  Hybrid: "Best hybrid option",
  Electric: "Best electric option",
};

export type PowertrainAlternativeGroup = {
  powertrain: Powertrain;
  label: string;
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

  const closest = CLOSEST_ALTERNATIVES[preferred];
  const orderedAlternativePowertrains = [
    ...closest,
    ...FALLBACK_ORDER.filter((p) => p !== preferred && !closest.includes(p)),
  ];

  const alternatives: PowertrainAlternativeGroup[] = orderedAlternativePowertrains
    .filter((p) => rest.has(p))
    .map((p) => ({
      powertrain: p,
      label: POWERTRAIN_ALTERNATIVE_LABEL[p],
      vehicles: rest.get(p)!,
    }));

  return { primary, alternatives };
}
