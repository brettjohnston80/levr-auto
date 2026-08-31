import type { Answers } from "./matchmaker-data";
import type { MatchmakerVehicle } from "./matchmaker-vehicles";

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
