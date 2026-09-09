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

const PAGE_SIZE = 1000;

export async function getIntakeMakeModelOptions(): Promise<MakeModelOptions> {
  const admin = createAdminClient();

  const { data: liveBatch, error: batchError } = await admin
    .from("vehicle_dataset_batches")
    .select("id")
    .eq("is_live", true)
    .maybeSingle();
  if (batchError) throw new Error(`getIntakeMakeModelOptions: ${batchError.message}`);
  // No promoted batch is a real, if unusual, state (nothing imported yet).
  // Callers fall back to the static list rather than rendering empty selects.
  if (!liveBatch) return {};

  const pairs: { make: string; model: string }[] = [];
  let from = 0;
  while (true) {
    // .order("id") for the same reason getVehiclesForBatch needs it:
    // .range() compiles to OFFSET/LIMIT, which has no guaranteed row
    // order across separate requests without an explicit sort key, so
    // consecutive pages could otherwise overlap or leave gaps.
    const { data, error } = await admin
      .from("vehicles")
      .select("make, model")
      .eq("dataset_batch_id", liveBatch.id)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`getIntakeMakeModelOptions: ${error.message}`);
    if (!data || data.length === 0) break;
    pairs.push(...(data as { make: string; model: string }[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // The vehicles table is one row per make/model/trim/model_year, so the
  // same make/model repeats many times over -- dedupe to the distinct
  // pairs the selects actually need.
  const byMake = new Map<string, Set<string>>();
  for (const { make, model } of pairs) {
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
