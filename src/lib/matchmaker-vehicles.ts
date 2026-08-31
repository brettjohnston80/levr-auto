import { createAdminClient } from "@/lib/supabase/admin";
import type { VehicleType } from "./matchmaker-data";

// The real, scored dataset backing the Matchmaker replacement (see
// matchmaker-data-spec.md, data/matchmaker_scoring_pipeline.py). Entirely
// separate from MockVehicle/GeneratedVehicle in matchmaker-data.ts /
// generated-matchmaker-data.ts, which stay present-but-unused until the
// Step 5 cutover deletes them.
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
  // Raw sourced value (Gas/EV/Hybrid/PHEV/Diesel/Hydrogen) -- folding this
  // into the app's 4-button powertrain preference (PHEV->Hybrid,
  // Hydrogen->Electric) is a Step 4 display-layer concern, not done here.
  fuelType: string | null;
  trueStartingPriceCents: number | null;
  // Keyed by the exact same labels PRIORITIES uses in matchmaker-data.ts,
  // so weightedTotal() in matchmaker-scoring.ts can index straight off a
  // customer's priority-order array with no separate label<->key mapping.
  scores: Record<string, number>;
};

// vehicles columns -> the PRIORITIES label each one corresponds to.
const SCORE_COLUMN_TO_LABEL: Record<string, string> = {
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
  safety_score: number;
  comfort_score: number;
  cargo_score: number;
  fuel_economy_score: number;
  reliability_score: number;
  performance_score: number;
  tech_features_score: number;
  price_value_score: number;
  resale_value_score: number;
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
    scores,
  };
}

const SELECT_COLUMNS =
  "id, make, model, trim, model_year, is_performance_trim, body_style, seating_capacity, " +
  "drivetrain, fuel_type, true_starting_price_cents, safety_score, comfort_score, cargo_score, " +
  "fuel_economy_score, reliability_score, performance_score, tech_features_score, " +
  "price_value_score, resale_value_score";

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

// The real entry point the live site will use once wired in (Step 5) --
// reads whichever batch vehicle_dataset_batches.is_live currently points
// at. Returns [] (not an error) if no batch has been promoted yet, which
// is the real, honest current state -- see promote_vehicle_dataset_batch.
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
