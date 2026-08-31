import type { Powertrain, VehicleType } from "./matchmaker-data";

// Pure type + display/matching helpers -- deliberately split out of
// matchmaker-vehicles.ts (2026-09-02), which imports createAdminClient and
// is server-only. matchmaker.tsx is a "use client" component: importing
// anything from matchmaker-vehicles.ts there drags the whole module,
// including its server-only Supabase import, into the client bundle,
// which Next.js correctly refuses to build. Nothing in this file touches
// Supabase, so it's safe to import from both client and server code.
//
// The real, scored dataset backing the Matchmaker replacement (see
// matchmaker-data-spec.md, data/matchmaker_scoring_pipeline.py). Replaces
// generated-matchmaker-data.ts / MockVehicle, both deleted in Step 5.
export type MatchmakerVehicle = {
  id: string;
  make: string;
  model: string;
  trim: string;
  modelYear: number;
  isPerformanceTrim: boolean;
  bodyStyle: VehicleType;
  seatingCapacity: number | null;
  drivetrain: string | null;
  // Raw sourced value (Gas/EV/Hybrid/PHEV/Diesel/Hydrogen) -- shown as-is
  // in the UI (more informative than the folded 4-bucket preference).
  // fuelTypeToPowertrain() below does the fold, used only for matching/
  // segmentation logic, never for display.
  fuelType: string | null;
  trueStartingPriceCents: number | null;
  // The rest are display-only fields, not used by hard filters or
  // scoring -- added in Step 5 to build a real per-vehicle rationale line
  // (see buildRationale below) and detail-modal content, replacing the
  // old system's single hand-written `rationale` string, which has no
  // equivalent in the real dataset.
  hasThirdRow: boolean;
  towingCapacityLbs: number | null;
  payloadCapacityLbs: number | null;
  rangeMi: number | null;
  epaCombinedMpg: number | null;
  cargoVolumeSeatsUpCuft: number | null;
  horsepower: number | null;
  zeroToSixtySec: number | null;
  // Keyed by the exact same labels PRIORITIES uses in matchmaker-data.ts,
  // so weightedTotal() in matchmaker-scoring.ts can index straight off a
  // customer's priority-order array with no separate label<->key mapping.
  scores: Record<string, number>;
};

// vehicles columns -> the PRIORITIES label each one corresponds to. Used
// by matchmaker-vehicles.ts's row mapping -- kept here since it's a pure
// lookup table, not a Supabase concern.
export const SCORE_COLUMN_TO_LABEL: Record<string, string> = {
  safety_score: "Safety",
  comfort_score: "Comfort",
  cargo_score: "Cargo Space",
  fuel_economy_score: "Fuel Economy",
  reliability_score: "Reliability",
  performance_score: "Performance",
  tech_features_score: "Technology & Features",
  price_value_score: "Price/Value",
  resale_value_score: "Resale Value",
};

// Folds the dataset's 6 raw sourced fuel types down to the app's 4-button
// powertrain preference (Gas/Diesel/Hybrid/Electric), per the approved
// plan's discrepancy-C decision: PHEV -> Hybrid, Hydrogen -> Electric
// (fuel-cell is an electric drivetrain -- the same fold the old
// 735-vehicle dataset already used). Returns null for anything
// unrecognized rather than guessing -- a defensive fallback, not a live
// gap: every one of the 1,601 real v18 rows has one of the 6 known
// values, confirmed directly against the CSV before this was written.
export function fuelTypeToPowertrain(fuelType: string | null): Powertrain | null {
  switch (fuelType) {
    case "Gas":
      return "Gas";
    case "Diesel":
      return "Diesel";
    case "Hybrid":
    case "PHEV":
      return "Hybrid";
    case "EV":
    case "Hydrogen":
      return "Electric";
    default:
      return null;
  }
}

// Display formatter for trueStartingPriceCents -- "$44,790 est.", matching
// the old system's priceEstimate string format exactly so the UI didn't
// need a restyle. "Price not available" for the ~11 real rows with no
// sourced destination fee (see matchmaker-data-spec.md's known gaps).
export function formatPriceEstimate(trueStartingPriceCents: number | null): string {
  if (trueStartingPriceCents === null) return "Price not available";
  return `$${Math.round(trueStartingPriceCents / 100).toLocaleString()} est.`;
}

// One-sentence rationale per vehicle, built from whichever real spec is
// most likely to matter for that vehicle -- direct continuation of the
// old system's "no marketing language invented, every rationale only
// states a number that's actually in the data" rule (see
// data/matchmaker-integration-notes-2026-08-28.md), just against the
// real v18 columns instead of the old hand-curated set. Checked in a
// fixed priority order so a truck's towing capacity wins over a generic
// mpg line, etc.
export function buildRationale(vehicle: MatchmakerVehicle): string {
  if (vehicle.isPerformanceTrim && vehicle.zeroToSixtySec !== null) {
    return `0-60 mph in ${vehicle.zeroToSixtySec} seconds.`;
  }
  if (vehicle.towingCapacityLbs !== null && vehicle.towingCapacityLbs > 0) {
    return `Tows up to ${vehicle.towingCapacityLbs.toLocaleString()} lbs.`;
  }
  if (vehicle.fuelType === "EV" || vehicle.fuelType === "Hydrogen") {
    if (vehicle.rangeMi !== null) {
      return `${Math.round(vehicle.rangeMi)} miles of real-world range.`;
    }
  }
  if (vehicle.hasThirdRow) {
    return `Seats up to ${vehicle.seatingCapacity ?? "several"} with a third row.`;
  }
  if (vehicle.epaCombinedMpg !== null) {
    return `${Math.round(vehicle.epaCombinedMpg)} mpg combined.`;
  }
  if (vehicle.cargoVolumeSeatsUpCuft !== null) {
    return `${vehicle.cargoVolumeSeatsUpCuft} cu ft of cargo space behind the front seats.`;
  }
  if (vehicle.horsepower !== null) {
    return `${vehicle.horsepower} horsepower.`;
  }
  return formatPriceEstimate(vehicle.trueStartingPriceCents);
}
