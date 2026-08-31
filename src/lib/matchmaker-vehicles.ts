import { createAdminClient } from "@/lib/supabase/admin";
import type { VehicleType } from "./matchmaker-data";
import { SCORE_COLUMN_TO_LABEL, type MatchmakerVehicle } from "./matchmaker-vehicle-display";

export type { MatchmakerVehicle } from "./matchmaker-vehicle-display";

// Server-only data fetching for the real, scored dataset backing the
// Matchmaker replacement (see matchmaker-data-spec.md,
// data/matchmaker_scoring_pipeline.py). Pure type/display helpers live in
// matchmaker-vehicle-display.ts, which has no Supabase import and is safe
// to use from the client "use client" component too -- see that file's
// header comment for why the split exists.

type VehicleRow = {
  id: string;
  make: string;
  model: string;
  trim: string;
  model_year: number;
  is_performance_trim: boolean;
  body_style: string;
  seating_capacity: number | null;
  drivetrain: string | null;
  fuel_type: string | null;
  true_starting_price_cents: number | null;
  has_third_row: boolean;
  towing_capacity_lbs: number | null;
  payload_capacity_lbs: number | null;
  range_mi: number | null;
  epa_combined_mpg: number | null;
  cargo_volume_seats_up_cuft: number | null;
  horsepower: number | null;
  zero_to_60_sec: number | null;
  safety_score: number;
  comfort_score: number;
  cargo_score: number;
  fuel_economy_score: number;
  reliability_score: number;
  performance_score: number;
  tech_features_score: number;
  price_value_score: number;
  resale_value_score: number;
  // Nullable -- rows from batches imported before migration 20260902120000
  // have no value here (see that migration's comment).
  towing_payload_score: number | null;
};

function mapRowToVehicle(row: VehicleRow): MatchmakerVehicle {
  const scores: Record<string, number> = {};
  for (const [column, label] of Object.entries(SCORE_COLUMN_TO_LABEL)) {
    scores[label] = (row as unknown as Record<string, number>)[column];
  }
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    trim: row.trim,
    modelYear: row.model_year,
    isPerformanceTrim: row.is_performance_trim,
    // Safe cast -- body_style is DB-constrained to the same 9 values
    // VehicleType allows (see the vehicles table's check constraint).
    bodyStyle: row.body_style as VehicleType,
    seatingCapacity: row.seating_capacity,
    drivetrain: row.drivetrain,
    fuelType: row.fuel_type,
    trueStartingPriceCents: row.true_starting_price_cents,
    hasThirdRow: row.has_third_row,
    towingCapacityLbs: row.towing_capacity_lbs,
    payloadCapacityLbs: row.payload_capacity_lbs,
    rangeMi: row.range_mi,
    epaCombinedMpg: row.epa_combined_mpg,
    cargoVolumeSeatsUpCuft: row.cargo_volume_seats_up_cuft,
    horsepower: row.horsepower,
    zeroToSixtySec: row.zero_to_60_sec,
    scores,
  };
}

// Migration 20260902120000 confirmed applied (2026-09-02) before adding
// towing_payload_score here.
const SELECT_COLUMNS =
  "id, make, model, trim, model_year, is_performance_trim, body_style, seating_capacity, " +
  "drivetrain, fuel_type, true_starting_price_cents, has_third_row, towing_capacity_lbs, " +
  "payload_capacity_lbs, range_mi, epa_combined_mpg, cargo_volume_seats_up_cuft, horsepower, " +
  "zero_to_60_sec, safety_score, comfort_score, cargo_score, fuel_economy_score, " +
  "reliability_score, performance_score, tech_features_score, price_value_score, " +
  "resale_value_score, towing_payload_score";

const PAGE_SIZE = 1000;

// PostgREST caps a single unbounded select at 1,000 rows by default --
// confirmed directly during Step 1 verification (a naive select silently
// truncated at 1,000 of 1,601 rows). This pages through explicitly rather
// than relying on any one batch/body-style slice staying under the cap by
// coincidence, so it stays correct even if a future re-import pushes a
// single body style past 1,000 rows.
export async function getVehiclesForBatch(batchId: string): Promise<MatchmakerVehicle[]> {
  const admin = createAdminClient();
  const rows: VehicleRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from("vehicles")
      .select(SELECT_COLUMNS)
      .eq("dataset_batch_id", batchId)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`getVehiclesForBatch: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as VehicleRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows.map(mapRowToVehicle);
}

// The real entry point the live site uses (wired in Step 5) -- reads
// whichever batch vehicle_dataset_batches.is_live currently points at.
// Returns [] (not an error) if no batch has been promoted yet, which is
// the real, honest current state -- see promote_vehicle_dataset_batch.
export async function getLiveVehicles(): Promise<MatchmakerVehicle[]> {
  const admin = createAdminClient();
  const { data: liveBatch, error } = await admin
    .from("vehicle_dataset_batches")
    .select("id")
    .eq("is_live", true)
    .maybeSingle();
  if (error) throw new Error(`getLiveVehicles: ${error.message}`);
  if (!liveBatch) return [];
  return getVehiclesForBatch(liveBatch.id);
}
