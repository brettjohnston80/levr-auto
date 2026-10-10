// Why a Matchmaker result ranked where it did (Cruz's tester feedback #5,
// approved 2026-10-10). Pure functions over the same numbers that produced
// the order -- weightedTotal() is score x RANK_WEIGHTS[priority position],
// summed -- so every sentence here is true of the actual ranking, never a
// paraphrase of it.

import { RANK_WEIGHTS } from "./matchmaker-scoring";
import { dimensionDisplayName } from "./matchmaker-dimension-indicators";
import { TOWING_PAYLOAD_VEHICLE_TYPES, type VehicleType } from "./matchmaker-data";

type Scored = { scores: Record<string, number> };

/**
 * The priority list a vehicle of `bodyStyle` is actually scored on. With
 * one vehicle type the list already holds only the matching 9th priority
 * (Towing & Payload or Resale Value); with several types selected it holds
 * both, and each type's list drops the one that doesn't apply to it.
 */
export function prioritiesForType(order: string[], bodyStyle: VehicleType | ""): string[] {
  const towing = bodyStyle !== "" && TOWING_PAYLOAD_VEHICLE_TYPES.includes(bodyStyle);
  const notForThisType = towing ? "Resale Value" : "Towing & Payload";
  return order.filter((label) => label !== notForThisType);
}

function priorityPhrase(positions: number[]): string {
  const sorted = [...positions].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] === 1 ? "your top priority" : `your #${sorted[0]} priority`;
  if (sorted[0] === 1 && sorted[1] === 2) return "your top two priorities";
  return `your #${sorted[0]} and #${sorted[1]} priorities`;
}

/**
 * One or two lines for a ranked card.
 *
 * "why": the (up to) two priorities where this vehicle earns the most points
 * above the average of the vehicles it was ranked against -- that is what
 * lifts it up the list. Falls back to its two biggest contributors when it
 * is above average on nothing (e.g. it is the only result).
 *
 * "below" (rank 2 and lower): the priority where it gives up the most points
 * to the #1 vehicle.
 *
 * Approved wording: "Ranked #1 mainly for Cargo Space and Comfort — your
 * top two priorities." / "Ranks below #1 mainly on Fuel Economy."
 */
export function rankReasons(
  vehicle: Scored,
  field: Scored[],
  priorities: string[],
  position: number,
  leader: Scored | null,
): { why: string | null; below: string | null } {
  if (priorities.length === 0) return { why: null, below: null };
  const weight = (i: number) => RANK_WEIGHTS[i] ?? 0;
  const score = (v: Scored, label: string) => v.scores[label] ?? 0;
  const avg = (label: string) =>
    field.length === 0 ? 0 : field.reduce((sum, v) => sum + score(v, label), 0) / field.length;

  let picks = priorities
    .map((label, i) => ({ label, position: i + 1, points: weight(i) * (score(vehicle, label) - avg(label)) }))
    .filter((p) => p.points > 0.0001)
    .sort((a, b) => b.points - a.points)
    .slice(0, 2);
  if (picks.length === 0) {
    picks = priorities
      .map((label, i) => ({ label, position: i + 1, points: weight(i) * score(vehicle, label) }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 2);
  }
  picks.sort((a, b) => a.position - b.position);
  const names = picks.map((p) => dimensionDisplayName(p.label)).join(" and ");
  const why = `Ranked #${position} mainly for ${names} — ${priorityPhrase(picks.map((p) => p.position))}.`;

  let below: string | null = null;
  if (position > 1 && leader) {
    const gap = priorities
      .map((label, i) => ({ label, points: weight(i) * (score(leader, label) - score(vehicle, label)) }))
      .filter((g) => g.points > 0.0001)
      .sort((a, b) => b.points - a.points)[0];
    if (gap) below = `Ranks below #1 mainly on ${dimensionDisplayName(gap.label)}.`;
  }
  return { why, below };
}

/**
 * Per-priority breakdown for the detail view: how much each priority can
 * count (its weight) and how much of that this vehicle earns (its score).
 */
export function priorityBreakdown(
  vehicle: Scored,
  priorities: string[],
): { label: string; name: string; position: number; weightShare: number; earned: number }[] {
  const maxWeight = RANK_WEIGHTS[0];
  return priorities.map((label, i) => ({
    label,
    name: dimensionDisplayName(label),
    position: i + 1,
    weightShare: (RANK_WEIGHTS[i] ?? 0) / maxWeight,
    earned: Math.max(0, Math.min(100, vehicle.scores[label] ?? 0)) / 100,
  }));
}

const TYPE_PLURAL: Record<string, string> = {
  Sedan: "sedans",
  Truck: "trucks",
  SUV: "SUVs",
  Hatchback: "hatchbacks",
  Wagon: "wagons",
  Convertible: "convertibles",
  Coupe: "coupes",
  Minivan: "minivans",
  "Cargo Van": "cargo vans",
};

/** "SUVs", "trucks"... or a generic phrase when several types are in play. */
export function bodyStylePlural(types: (VehicleType | "")[]): string {
  const real = [...new Set(types.filter(Boolean))];
  if (real.length !== 1) return "vehicles of the same type";
  return TYPE_PLURAL[real[0]] ?? `${real[0].toLowerCase()}s`;
}

/**
 * Score legend lines (#6). Best in Class and Excellent approved 2026-10-10;
 * Good, Below average and No data drafted for Brett's sign-off.
 */
export function scoreLegendLines(types: (VehicleType | "")[]): { label: string; text: string }[] {
  const plural = bodyStylePlural(types);
  return [
    { label: "★ Best in Class", text: `the top score among comparable ${plural}.` },
    { label: "Excellent", text: "in the top tier for this category." },
    { label: "Good", text: "above average for this category." },
    { label: "Below average", text: `near the bottom of comparable ${plural} for this category.` },
    { label: "No data", text: "we couldn't find a reliable figure, so it counts as the lowest score." },
  ];
}
