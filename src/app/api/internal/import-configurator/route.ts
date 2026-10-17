import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseConfiguratorRow, type ParsedOption } from "@/lib/configurator-parse";
import { engineFactsFromRows, heldModelsFromJson, mapConfiguratorRows, type MappingReport } from "@/lib/configurator-mapping";
import { applyDealerInstalledRule, dealerInstalledPackagesFromRows, type DealerInstalledPackage, type DealerInstalledReport } from "@/lib/configurator-dealer-installed";

// Durable import for the Toyota/Honda configurator datasets (step 4 of 9),
// same shape as import-vehicle-dataset: CRON_SECRET-gated, one new
// configurator_batches row per call, never touching an existing batch, so
// a bad run cannot corrupt whatever is currently live.
//
// Promotion is deliberately NOT part of this route. Unlike
// import-vehicle-dataset there is no `promote` flag at all -- a make goes
// live only by calling promote_configurator_batch_make(batch, make)
// explicitly (one live batch per make since 2026-10-10).
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
  // Optional make filter, so one file holding several makes can be imported
  // as one batch per make (Chevrolet/Ford, 2026-10-10).
  const makes: string[] | null =
    Array.isArray(body.makes) && body.makes.length > 0 ? body.makes.map((m: unknown) => String(m)) : null;
  // See parsePrice: a blank price means "not published" in this source.
  const parseOptions = { blankPriceUnknown: body.blankPriceUnknown === true };
  // The mechanical D2 rules (configurator-mapping.ts), opt-in so every
  // existing import (Toyota/Honda, Wave 1) behaves exactly as before.
  // engineFactsFile: the Cowork re-pass's official hp/size table (data/...csv).
  const useMapping = body.mapping === true;
  let engineFacts: ReturnType<typeof engineFactsFromRows> | undefined;
  // One file or a list (pass 3 added its own facts file, 2026-10-16); later files win on the same engine.
  const factsFiles: string[] = typeof body.engineFactsFile === "string" ? [body.engineFactsFile] : Array.isArray(body.engineFactsFile) ? body.engineFactsFile.map(String) : [];
  if (useMapping && factsFiles.length > 0) {
    const factRows: Record<string, string>[] = [];
    for (const f of factsFiles) {
      try {
        factRows.push(...(parse(readFileSync(join(process.cwd(), "data", f), "utf-8"), { columns: true, skip_empty_lines: true }) as Record<string, string>[]));
      } catch {
        return NextResponse.json({ error: `could not read data/${f}` }, { status: 400 });
      }
    }
    engineFacts = engineFactsFromRows(factRows);
  }
  // Models held out of the import until released (shared with the Matchmaker
  // dataset build). Read every time the mapping runs; a missing or broken
  // file stops the import rather than letting held rows through.
  let heldModels: ReturnType<typeof heldModelsFromJson> = [];
  if (useMapping) {
    try {
      heldModels = heldModelsFromJson(readFileSync(join(process.cwd(), "data", "held-models.json"), "utf-8"));
    } catch (e) {
      return NextResponse.json({ error: `could not read data/held-models.json: ${(e as Error).message}` }, { status: 400 });
    }
  }
  // GM's dealer-installed packages (restored from pass 3, 2026-10-17).
  // Read with the mapping, like held models; a missing file stops the import.
  let dealerInstalledPackages: DealerInstalledPackage[] = [];
  if (useMapping) {
    try {
      const diText = readFileSync(join(process.cwd(), "data", "configurator-dealer-installed-packages-2026-10.csv"), "utf-8");
      dealerInstalledPackages = dealerInstalledPackagesFromRows(parse(diText, { columns: true, skip_empty_lines: true, trim: true }));
    } catch (e) {
      return NextResponse.json({ error: `could not read data/configurator-dealer-installed-packages-2026-10.csv: ${(e as Error).message}` }, { status: 400 });
    }
  }
  const mappingReports: Record<string, MappingReport> = {};

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
    let rawRows: CsvRow[] = parse(csvText, { columns: true, skip_empty_lines: true, trim: false });
    if (useMapping) {
      const mapped = mapConfiguratorRows(rawRows, { engineFacts, heldModels });
      mappingReports[filename] = mapped.report;
      rawRows = mapped.rows;
    }
    for (const raw of rawRows) {
      const row = parseConfiguratorRow(raw, parseOptions);
      if (makes && !makes.includes(row.make)) continue;
      parsedRows.push(row);
    }
  }
  if (parsedRows.length === 0) {
    return NextResponse.json({ error: "no rows matched" }, { status: 400 });
  }
  // GM's LPO code on any import; the listed packages only with the mapping.
  const dealerInstalled: DealerInstalledReport = applyDealerInstalledRule(parsedRows, dealerInstalledPackages);
  // Two rows with the same trim identity would fail the unique constraint
  // half-way; refuse before anything is written.
  const collisions = Object.values(mappingReports).flatMap((r) => r.collisions);
  if (collisions.length > 0) {
    return NextResponse.json({ error: "mapping produced duplicate trims", collisions }, { status: 400 });
  }

  // --- aggregate counts + the audit trail for dropped items -------------
  const dropped: DroppedItem[] = [];
  const droppedByCategory: Record<string, number> = {};
  const availabilityMethod: Record<string, number> = {
    exact: 0,
    prefix: 0,
    blank_unknown: 0,
    forced_unavailable: 0,
  };
  const availability: Record<string, number> = {
    standard: 0,
    standalone: 0,
    package_only: 0,
    unavailable: 0,
    unknown: 0,
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
        dealer_installed: o.dealerInstalled,
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
    makes,
    blankPriceUnknown: parseOptions.blankPriceUnknown,
    trimsInserted: insertedTrimIds.length,
    optionsInserted: optionRows.length,
    keptOptions,
    droppedUnresolvedPackage: dropped.length,
    droppedByCategory,
    dropped,
    availability,
    availabilityMethod,
    dealerInstalled,
    mapping: useMapping
      ? Object.fromEntries(
          Object.entries(mappingReports).map(([file, r]) => [
            file,
            { rowsIn: r.rowsIn, rowsOut: r.rowsOut, changed: r.changed, unmapped: r.unmapped, dropped: r.dropped, corrections: r.corrections, held: r.held },
          ]),
        )
      : null,
  });
}
