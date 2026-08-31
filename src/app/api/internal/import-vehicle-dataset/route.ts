import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { createAdminClient } from "@/lib/supabase/admin";

// Durable, reusable import mechanism -- not a one-off scratch route. The
// Matchmaker vehicle dataset is explicitly not static (unlike the old
// generated-matchmaker-data.ts), so this is meant to be hit again whenever
// a new matchmaker_scoring_pipeline.py run lands a new CSV. Each call
// creates one new vehicle_dataset_batches row and inserts that CSV's rows
// under it -- it never touches an existing batch, so a bad run can't
// corrupt whatever's currently live. Promotion (making a batch the one the
// live site reads) is a separate, explicit step -- see
// promote_vehicle_dataset_batch.
//
// *** Passing promote: true here (or calling promote_vehicle_dataset_batch
// directly) does NOT update the live site by itself. *** /matchmaker is a
// fully static route with no revalidate/ISR config -- see the long
// comment on promote_vehicle_dataset_batch in
// supabase/migrations/20260830120000_vehicles_dataset.sql for why. A
// promotion only takes effect on the NEXT deploy. Promote, then deploy --
// in that order, every time.

const DEFAULT_FILENAME = "matchmaker-vehicle-dataset-2026-v19-scored.csv";

// Accepts both boolean-string conventions the pipeline actually produces:
// "yes"/"no" for source-researched flags (is_performance_trim,
// has_third_row -- sourced as literal strings, never touched by pandas'
// bool dtype) and "true"/"false" for pipeline-computed flags (the *_has_data
// columns, added 2026-09-02 -- these come from pandas .notna() boolean
// Series, which pandas serializes to CSV as "True"/"False", not "yes"/"no").
// Confirmed directly against a real pipeline run before writing this --
// the original "yes"-only check would have silently parsed every
// *_has_data value to false.
function toBool(v: string): boolean {
  const normalized = v.trim().toLowerCase();
  return normalized === "yes" || normalized === "true";
}

function toNullableText(v: string | undefined): string | null {
  if (v === undefined) return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function toNum(v: string | undefined): number | null {
  const text = toNullableText(v);
  if (text === null) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function toInt(v: string | undefined): number | null {
  const n = toNum(v);
  return n === null ? null : Math.round(n);
}

function toCents(v: string | undefined): number | null {
  const n = toNum(v);
  return n === null ? null : Math.round(n * 100);
}

type CsvRow = Record<string, string>;

function transformRow(row: CsvRow) {
  return {
    make: row.make,
    model: row.model,
    trim: row.trim,
    model_year: toInt(row.model_year),
    is_performance_trim: toBool(row.is_performance_trim),
    body_style: row.body_style,
    doors: toInt(row.doors),
    seating_capacity: toInt(row.seating_capacity),
    drivetrain: toNullableText(row.drivetrain),
    fuel_type: toNullableText(row.fuel_type),
    msrp_cents: toCents(row.msrp),
    destination_fee_cents: toCents(row.destination_fee),
    true_starting_price_cents: toCents(row.true_starting_price),
    epa_city_mpg: toNum(row.epa_city_mpg),
    epa_hwy_mpg: toNum(row.epa_hwy_mpg),
    epa_combined_mpg: toNum(row.epa_combined_mpg),
    range_mi: toNum(row.range_mi),
    nhtsa_overall_stars: toInt(row.nhtsa_overall_stars),
    passenger_volume_cuft: toNum(row.passenger_volume_cuft),
    front_legroom_in: toNum(row.front_legroom_in),
    rear_legroom_in: toNum(row.rear_legroom_in),
    third_row_legroom_in: toNum(row.third_row_legroom_in),
    front_headroom_in: toNum(row.front_headroom_in),
    rear_headroom_in: toNum(row.rear_headroom_in),
    third_row_headroom_in: toNum(row.third_row_headroom_in),
    has_third_row: toBool(row.has_third_row),
    cargo_volume_seats_up_cuft: toNum(row.cargo_volume_seats_up_cuft),
    max_cargo_volume_cuft: toNum(row.max_cargo_volume_cuft),
    // Added 2026-09-02, requires migration 20260902140000
    // (vehicles_bed_length_ft) to be applied first. Was always present in
    // the raw/scored CSV (used internally by the pipeline to compute
    // cargo_score/cargo_has_data for Trucks) but never persisted until
    // now -- see that migration's comment.
    bed_length_ft: toNum(row.bed_length_ft),
    towing_capacity_lbs: toInt(row.towing_capacity_lbs),
    payload_capacity_lbs: toInt(row.payload_capacity_lbs),
    reliability_rating: toNum(row.reliability_rating),
    horsepower: toInt(row.horsepower),
    torque_lbft: toInt(row.torque_lbft),
    zero_to_60_sec: toNum(row.zero_to_60_sec),
    top_speed_mph: toInt(row.top_speed_mph),
    tech_score: toInt(row.tech_score),
    warranty_basic_years: toInt(row.warranty_basic_years),
    warranty_basic_miles: toInt(row.warranty_basic_miles),
    warranty_powertrain_years: toInt(row.warranty_powertrain_years),
    warranty_powertrain_miles: toInt(row.warranty_powertrain_miles),
    resale_depreciation_pct: toNum(row.resale_depreciation_pct),
    manufacturer_link: toNullableText(row.manufacturer_link),
    safety_source: toNullableText(row.safety_source),
    fuel_tank_capacity_gal: toNum(row.fuel_tank_capacity_gal),
    resale_source: toNullableText(row.resale_source),
    reliability_source_note: toNullableText(row.reliability_source_note),
    safety_score: toNum(row["Safety Score"]),
    comfort_score: toNum(row["Comfort Score"]),
    cargo_score: toNum(row["Cargo Score"]),
    fuel_economy_score: toNum(row["Fuel Economy Score"]),
    reliability_score: toNum(row["Reliability Score"]),
    tech_features_score: toNum(row["Technology & Features Score"]),
    price_value_score: toNum(row["Price Value Score"]),
    resale_value_score: toNum(row["Resale Value Score"]),
    performance_score: toNum(row["Performance Score"]),
    // Added 2026-09-02, requires migration 20260902120000 to be applied
    // first (see that migration and matchmaker-vehicles.ts's own note).
    towing_payload_score: toNum(row["Towing & Payload Score"]),
    // Added 2026-09-02, requires migration 20260902130000
    // (vehicles_has_data_flags) to be applied first. Companion booleans to
    // the 9 (+Towing & Payload) score columns above -- see that
    // migration's comments for what "true"/"false" means per dimension.
    // toBool() handles the "True"/"False" string convention these come in
    // as (pandas boolean serialization), distinct from the "yes"/"no"
    // convention used by the source-researched flags above.
    safety_has_data: toBool(row["Safety Has Data"]),
    comfort_has_data: toBool(row["Comfort Has Data"]),
    cargo_has_data: toBool(row["Cargo Has Data"]),
    fuel_economy_has_data: toBool(row["Fuel Economy Has Data"]),
    reliability_has_data: toBool(row["Reliability Has Data"]),
    tech_features_has_data: toBool(row["Technology & Features Has Data"]),
    price_value_has_data: toBool(row["Price Value Has Data"]),
    resale_value_has_data: toBool(row["Resale Value Has Data"]),
    performance_has_data: toBool(row["Performance Has Data"]),
    towing_payload_has_data: toBool(row["Towing & Payload Has Data"]),
  };
}

const INSERT_CHUNK_SIZE = 500;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const filename: string = body.filename ?? DEFAULT_FILENAME;
  const promote: boolean = body.promote === true;

  const csvPath = join(process.cwd(), "data", filename);
  let csvText: string;
  try {
    csvText = readFileSync(csvPath, "utf-8");
  } catch {
    return NextResponse.json({ error: `could not read data/${filename}` }, { status: 400 });
  }

  const rawRows: CsvRow[] = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  const transformed = rawRows.map(transformRow);

  const admin = createAdminClient();

  const { data: batch, error: batchError } = await admin
    .from("vehicle_dataset_batches")
    .insert({ source_filename: filename, row_count: transformed.length })
    .select()
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? "batch insert failed" }, { status: 500 });
  }

  const rowsWithBatch = transformed.map((row) => ({ ...row, dataset_batch_id: batch.id }));

  for (let i = 0; i < rowsWithBatch.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rowsWithBatch.slice(i, i + INSERT_CHUNK_SIZE);
    const { error: insertError } = await admin.from("vehicles").insert(chunk);
    if (insertError) {
      // Clean up the partial batch rather than leaving a half-imported,
      // never-promotable batch behind -- cascades to any vehicles rows
      // already inserted under it.
      await admin.from("vehicle_dataset_batches").delete().eq("id", batch.id);
      return NextResponse.json(
        { error: insertError.message, failedAtChunkStart: i },
        { status: 500 },
      );
    }
  }

  let promoted = false;
  if (promote) {
    const { error: promoteError } = await admin.rpc("promote_vehicle_dataset_batch", {
      p_batch_id: batch.id,
    });
    if (promoteError) {
      return NextResponse.json(
        { error: promoteError.message, batchId: batch.id, rowsInserted: rowsWithBatch.length },
        { status: 500 },
      );
    }
    promoted = true;
  }

  return NextResponse.json({
    batchId: batch.id,
    sourceFilename: filename,
    rowsInserted: rowsWithBatch.length,
    promoted,
  });
}
