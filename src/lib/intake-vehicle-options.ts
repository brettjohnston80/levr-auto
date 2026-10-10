import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Make -> models map powering the intake form's two cascading selects.
 *
 * Replaces the hardcoded MAKES_AND_MODELS constant in vehicle-data.ts
 * ("choose this car" handoff, step 1). That constant was a curated
 * 13-make shortlist written before any real vehicle dataset existed; it
 * has no relationship to what Matchmaker actually recommends from, so a
 * customer could be shown a vehicle in Matchmaker and then not find it in
 * intake, or vice versa.
 *
 * SCOPE: the currently-promoted (is_live) batch only, not every batch
 * ever imported. Same source Matchmaker itself reads (getLiveVehicles),
 * which is the whole point -- the two surfaces must agree. Including
 * superseded batches would resurface data that later corrective passes
 * deliberately replaced (v18/v19 were superseded by v20), i.e. it would
 * offer make/models from a dataset the business has already rejected.
 *
 * Server-only: imports the service-role admin client, same as
 * matchmaker-vehicles.ts. Call this from a server component and pass the
 * result down as props -- never import it into a "use client" module.
 */
export type MakeModelOptions = Record<string, string[]>;

/**
 * make -> model -> the model years the live dataset offers, ascending.
 *
 * A SEPARATE shape rather than widening MakeModelOptions, on purpose:
 * MakeModelOptions is consumed by six components and two server files
 * (intake, both finalize surfaces, /account, the agent forms), none of
 * which need years yet. Reshaping it would ripple through every one of
 * them for a feature that today only intake uses.
 *
 * The researched dataset, not synced inventory, is the source -- the same
 * answer at every touchpoint. Inventory only exists for make/models
 * someone has already paid for, so an inventory-driven picker would offer
 * nothing for ~98% of models at intake.
 */
export type ModelYearOptions = Record<string, Record<string, number[]>>;

const PAGE_SIZE = 1000;

type LiveRow = { make: string; model: string; model_year: number | null };

/**
 * The one scan both lookups share. React cache(), so a request that needs
 * make/models AND years (the intake page) or re-validates a year (the save
 * action) reads the live batch once, not once per lookup. No arguments by
 * design -- cache() memoises on argument identity.
 */
/** Cache tag for the live vehicle-dataset rows; the import route revalidates
 *  it when a batch is promoted. */
export const LIVE_VEHICLE_ROWS_TAG = "live-vehicle-rows";

const fetchLiveVehicleRows = async (): Promise<LiveRow[]> => {
  const admin = createAdminClient();

  const { data: liveBatch, error: batchError } = await admin
    .from("vehicle_dataset_batches")
    .select("id")
    .eq("is_live", true)
    .maybeSingle();
  if (batchError) throw new Error(`loadLiveVehicleRows: ${batchError.message}`);
  // No promoted batch is a real, if unusual, state (nothing imported yet).
  // Callers fall back to the static list rather than rendering empty selects.
  if (!liveBatch) return [];

  const rows: LiveRow[] = [];
  let from = 0;
  while (true) {
    // .order("id") for the same reason getVehiclesForBatch needs it:
    // .range() compiles to OFFSET/LIMIT, which has no guaranteed row
    // order across separate requests without an explicit sort key, so
    // consecutive pages could otherwise overlap or leave gaps.
    const { data, error } = await admin
      .from("vehicles")
      .select("make, model, model_year")
      .eq("dataset_batch_id", liveBatch.id)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`loadLiveVehicleRows: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as LiveRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
};

// Cached across requests for 15 minutes (2026-10-10). The full scan is
// ~2,270 rows over several round trips and changes only when a dataset batch
// is promoted -- yet every /account load, intake, Your Car and the agent page
// re-read it per request. The import route clears it on promote; a promotion
// run by hand in SQL reaches these dropdowns within 15 minutes. React's
// cache() still dedupes within one request.
const loadLiveVehicleRows = cache(
  unstable_cache(fetchLiveVehicleRows, ["live-vehicle-rows"], { revalidate: 900, tags: [LIVE_VEHICLE_ROWS_TAG] }),
);

/**
 * Make/models customers can no longer choose, even though the researched
 * dataset still has them. Ford Escape (Brett, 2026-10-10): Ford is
 * discontinuing it and it can't be bought in CA, MA, OR, NY, WA or VT.
 * Applied after the cache, so a change here takes effect on the next deploy
 * rather than waiting for the 15-minute cache. Every picker that uses these
 * options (intake, the switch forms, the agent forms) and the server-side
 * year check drop them together.
 */
const NOT_OFFERED_MODELS = new Set(["Ford|Escape"]);

const loadOfferedVehicleRows = async (): Promise<LiveRow[]> =>
  (await loadLiveVehicleRows()).filter((r) => !NOT_OFFERED_MODELS.has(`${r.make}|${r.model}`));

export async function getIntakeMakeModelOptions(): Promise<MakeModelOptions> {
  const rows = await loadOfferedVehicleRows();

  // The vehicles table is one row per make/model/trim/model_year, so the
  // same make/model repeats many times over -- dedupe to the distinct
  // pairs the selects actually need.
  const byMake = new Map<string, Set<string>>();
  for (const { make, model } of rows) {
    if (!make || !model) continue;
    const models = byMake.get(make) ?? new Set<string>();
    models.add(model);
    byMake.set(make, models);
  }

  const options: MakeModelOptions = {};
  for (const make of [...byMake.keys()].sort((a, b) => a.localeCompare(b))) {
    options[make] = [...byMake.get(make)!].sort((a, b) => a.localeCompare(b));
  }
  return options;
}

export async function getIntakeModelYearOptions(): Promise<ModelYearOptions> {
  const rows = await loadOfferedVehicleRows();

  const years = new Map<string, Map<string, Set<number>>>();
  for (const { make, model, model_year } of rows) {
    if (!make || !model || model_year == null) continue;
    const models = years.get(make) ?? new Map<string, Set<number>>();
    const set = models.get(model) ?? new Set<number>();
    set.add(model_year);
    models.set(model, set);
    years.set(make, models);
  }

  const options: ModelYearOptions = {};
  for (const [make, models] of years) {
    options[make] = {};
    for (const [model, set] of models) {
      options[make][model] = [...set].sort((a, b) => a - b);
    }
  }
  return options;
}

/**
 * Whether the live dataset genuinely offers this make/model in this year.
 *
 * The server-side gate for a committed year. The intake select only ever
 * offers real years, but a stale tab or a crafted request can send
 * anything, and this value decides which car an agent negotiates for.
 */
export async function isOfferedModelYear(
  make: string,
  model: string,
  modelYear: number,
): Promise<boolean> {
  const options = await getIntakeModelYearOptions();
  return options[make]?.[model]?.includes(modelYear) ?? false;
}
