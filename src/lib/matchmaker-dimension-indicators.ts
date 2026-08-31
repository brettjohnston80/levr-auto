import { retargetPriorityOrderForVehicleType, type VehicleType } from "./matchmaker-data";

// Ranking-indicator (Green/Yellow/Red/Gray) logic, part of the
// results-card redesign approved 2026-09-02 (see
// data/matchmaker-duplicate-investigation-and-grouping-plan-2026-09-02.md,
// Part 3, "Step C"). Pure functions, no UI here -- consumed by both the
// compact card indicator row (top 5) and the detail modal's full
// breakdown (all 9), so ordering logic lives in exactly one place.

export type IndicatorLevel = "green" | "yellow" | "red" | "gray";

// Thresholds per the approved design: Green >=80, Yellow 65-79, Red 50-64
// (real data, genuinely weak/worst-in-class -- the pipeline's scores never
// go below 50, see floor_rescale in matchmaker_scoring_pipeline.py), Gray
// = no underlying data for this dimension. Gray is checked first and
// short-circuits the numeric thresholds entirely -- a score is never used
// to infer "has data" on its own, since a bare 50 is genuinely ambiguous
// between "missing data" and "real data, tied for worst in class" (see
// the vehicles_has_data_flags migration's comment). Always pass hasData
// from MatchmakerVehicle.hasData, never derive it from the score value.
export function dimensionIndicator(score: number, hasData: boolean): IndicatorLevel {
  if (!hasData) return "gray";
  if (score >= 80) return "green";
  if (score >= 65) return "yellow";
  return "red";
}

// The customer's chosen priority order (already exactly 9 labels: the 8
// shared dimensions + whichever of Resale Value / Towing & Payload was
// valid for the vehicleType active when they arranged it), reordered/
// retargeted for a SPECIFIC vehicle's own bodyStyle. This is a thin
// semantic wrapper over retargetPriorityOrderForVehicleType, which
// already does exactly this job (matchmaker-data.ts) -- swaps whichever
// of the two type-dependent labels is present for the one the given body
// style wants, preserving every other label's position, and is a no-op
// if the list already matches. Keying off the vehicle's own bodyStyle
// rather than answers.vehicleType is deliberate: every displayed vehicle
// already satisfies the vehicleType hard filter today, so the two are
// always equal in practice, but reading it off the vehicle itself doesn't
// depend on that continuing to hold true everywhere this gets called from
// (e.g. a future grouped-card toggle showing a different trim's data).
//
// Used by both the compact card (sliced to the top 5) and the full
// detail-modal breakdown (all 9) -- one shared function, so the two
// surfaces can't silently drift apart on ordering.
export function personalizedDimensionOrder(bodyStyle: VehicleType, priorities: string[]): string[] {
  return retargetPriorityOrderForVehicleType(priorities, bodyStyle);
}

// Shared display constants -- moved here (2026-09-02, Step F) from being
// matchmaker.tsx-local so the compact card row and the detail modal's
// full breakdown render the exact same colors/labels/abbreviations for
// the exact same indicator level, rather than two components each
// maintaining their own copy that could quietly drift apart.
export const INDICATOR_CLASSES: Record<IndicatorLevel, string> = {
  green: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  red: "bg-red-500/15 text-red-400 ring-red-500/30",
  gray: "bg-zinc-600/15 text-zinc-500 ring-zinc-600/30",
};

export const INDICATOR_LEVEL_LABEL: Record<IndicatorLevel, string> = {
  green: "Excellent",
  yellow: "Good",
  red: "Below average",
  gray: "No data",
};

// Short, visually distinct abbreviations for the compact card row --
// matches the style reviewed in the approved plan (e.g. "Sf" Safety,
// "T&P" Towing & Payload), not auto-derived from each label, so two
// dimensions can never collide on their first couple letters (e.g.
// Comfort vs. Cargo Space). Not used by the modal's full breakdown, which
// has room for the full label.
export const DIMENSION_ABBREVIATION: Record<string, string> = {
  Safety: "Sf",
  Comfort: "Cf",
  "Cargo Space": "Cg",
  "Fuel Economy": "FE",
  Reliability: "Re",
  Performance: "Pf",
  "Technology & Features": "T&F",
  "Price/Value": "P/V",
  "Resale Value": "RV",
  "Towing & Payload": "T&P",
};
