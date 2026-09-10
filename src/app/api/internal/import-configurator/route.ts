import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseConfiguratorRow, type ParsedOption } from "@/lib/configurator-parse";

// Durable import for the Toyota/Honda configurator datasets (step 4 of 9),
// same shape as import-vehicle-dataset: CRON_SECRET-gated, one new
// configurator_batches row per call, never touching an existing batch, so
// a bad run cannot corrupt whatever is currently live.
//
// Promotion is deliberately NOT part of this route. Unlike
// import-vehicle-dataset there is no `promote` flag at all -- promotion is
// step 9 and happens by calling promote_configurator_batch explicitly.
// Nothing here can make a batch live, by construction rather than by
// default value.
//
// Parsing/normalization lives entirely in configurator-parse.ts (pure
// functions, verified against the real CSVs in step 3). This route only
// reads files, calls that parser, and writes rows.

const DEFAULT_FILES = [
  "toyota-configurator-full-2026-09-09.csv",
  "honda-configurator-full-2026-09-09.csv",
];

const INSERT_CHUNK_SIZE = 500;

type CsvRow = Record<string, string>;

/** Shape returned for each dropped item so the response can be audited. */
interface DroppedItem {
  make: string;
  model: string;
  trim: string;
  modelYear: number;
  category: string;
  name: string;
  packageRefNote: string | null;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const files: string[] = Array.isArray(body.files) && body.files.length > 0 ? body.files : DEFAULT_FILES;

  // --- read + parse every file before touching the DB -------------------
  const parsedRows = [];
  for (const filename of files) {
    let csvText: string;
    try {
      csvText = readFileSync(join(process.cwd(), "data", filename), "utf-8");
    } catch {
      return NextResponse.json({ error: `could not read data/${filename}` }, { status: 400 });
    }
    // `trim: false` on purpose: the delimited option strings carry
    // meaningful leading/trailing spaces around ' | ' and ' ;; ', and the
    // parser handles its own trimming per field.
    const rawRows: CsvRow[] = parse(csvText, { columns: true, skip_empty_lines: true, trim: false });
    for (const raw of rawRows) parsedRows.push(parseConfiguratorRow(raw));
  }

  // --- aggregate counts + the audit trail for dropped items -------------
  const dropped: DroppedItem[] = [];
  const droppedByCategory: Record<string, number> = {};
  const availabilityMethod: Record<string, number> = {
    exact: 0,
    prefix: 0,
    forced_unavailable: 0,
  };
  const availability: Record<string, number> = {
    standard: 0,
    standalone: 0,
    package_only: 0,
    unavailable: 0,
  };
  let keptOptions = 0;

  for (const row of parsedRows) {
    for (const option of row.options) {
      keptOptions += 1;
      availabilityMethod[option.availabilityMethod] += 1;
      availability[option.availability] += 1;
    }
    for (const d of row.droppedUnresolvedPackage as ParsedOption[]) {
      availabilityMethod[d.availabilityMethod] += 1;
      droppedByCategory[d.category] = (droppedByCategory[d.category] ?? 0) + 1;
      dropped.push({
        make: row.make,
        model: row.model,
        trim: row.trim,
        modelYear: row.modelYear,
        category: d.category,
        name: d.name,
        packageRefNote: d.notes,
      });
    }
  }

  const admin = createAdminClient();

  // --- batch ------------------------------------------------------------
  const { data: batch, error: batchError } = await admin
    .from("configurator_batches")
    .insert({ source_files: files })
    .select()
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? "batch insert failed" }, { status: 500 });
  }

  // Any failure past this point deletes the batch, which cascades to every
  // trim and option already written under it -- never leave a
  // half-imported batch behind that could later be promoted.
  const abort = async (message: string, extra: Record<string, unknown> = {}) => {
    await admin.from("configurator_batches").delete().eq("id", batch.id);
    return NextResponse.json({ error: message, ...extra }, { status: 500 });
  };

  // --- trims ------------------------------------------------------------
  const trimRows = parsedRows.map((row) => ({
    batch_id: batch.id,
    make: row.make,
    model: row.model,
    trim: row.trim,
    model_year: row.modelYear,
    drivetrain: row.drivetrain,
    fuel_type: row.fuelType,
    body_style: row.bodyStyle,
  }));

  const insertedTrimIds: string[] = [];
  for (let i = 0; i < trimRows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = trimRows.slice(i, i + INSERT_CHUNK_SIZE);
    const { data, error } = await admin.from("configurator_trims").insert(chunk).select("id");
    if (error || !data) {
      return abort(error?.message ?? "trim insert failed", { failedAtChunkStart: i });
    }
    // .select() returns rows in insert order, so index i+n corresponds to
    // trimRows[i+n] -- which is what lets options be tied back to their
    // trim without a second lookup round-trip per row.
    for (const r of data) insertedTrimIds.push(r.id as string);
  }

  if (insertedTrimIds.length !== parsedRows.length) {
    return abort(
      `trim insert count mismatch: inserted ${insertedTrimIds.length}, expected ${parsedRows.length}`,
    );
  }

  // --- options ----------------------------------------------------------
  const optionRows: Record<string, unknown>[] = [];
  parsedRows.forEach((row, index) => {
    const trimId = insertedTrimIds[index];
    for (const o of row.options) {
      optionRows.push({
        trim_id: trimId,
        category: o.category,
        name: o.name,
        availability_raw: o.availabilityRaw === "" ? null : o.availabilityRaw,
        availability: o.availability,
        price_cents: o.priceCents,
        price_is_included: o.priceIsIncluded,
        package_name: o.packageName,
        package_price_cents: o.packagePriceCents,
        package_contents: o.packageContents,
        notes: o.notes,
      });
    }
  });

  for (let i = 0; i < optionRows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = optionRows.slice(i, i + INSERT_CHUNK_SIZE);
    const { error } = await admin.from("configurator_options").insert(chunk);
    if (error) {
      return abort(error.message, { failedAtChunkStart: i });
    }
  }

  return NextResponse.json({
    ok: true,
    batchId: batch.id,
    isLive: batch.is_live === true,
    files,
    trimsInserted: insertedTrimIds.length,
    optionsInserted: optionRows.length,
    keptOptions,
    droppedUnresolvedPackage: dropped.length,
    droppedByCategory,
    dropped,
    availability,
    availabilityMethod,
  });
}
