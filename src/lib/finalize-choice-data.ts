import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTrimOptions, filterListingsToCommittedYear, type TrimOption } from "@/lib/finalize-trims";
import { MODEL_YEAR_INVENTORY_BLOCK_ENABLED, computeInventoryBlock, type InventoryBlock } from "@/lib/inventory-block";
import { getConfiguratorQuestionsForTrims } from "@/lib/configurator-questions";
import { hasAnyQuestion, type ConfiguratorQuestions } from "@/lib/configurator-matching";
import {
  getIntakeMakeModelOptions,
  getIntakeModelYearOptions,
  type MakeModelOptions,
  type ModelYearOptions,
} from "@/lib/intake-vehicle-options";

export interface FinalizeChoiceData {
  trimOptions: TrimOption[];
  configuratorQuestions: Record<string, ConfiguratorQuestions>;
  makeModelOptions: MakeModelOptions;
  modelYearOptions: ModelYearOptions;
  inventoryBlock: InventoryBlock | null;
}

/**
 * Everything FinalizeChoice needs, for a search still awaiting
 * finalization. Extracted out of /finalize/[searchId]/page.tsx (2026-09-18)
 * so /account/vehicle -- the new persistent home for this same choice --
 * can render the identical UI from the identical data, without a second,
 * independently-drifting copy of this fetch. /finalize/[searchId]/page.tsx
 * itself is unchanged: same behavior, just calling this instead of
 * inlining it.
 */
export async function getFinalizeChoiceData(search: {
  make: string | null;
  model: string | null;
  model_year: number | null;
}): Promise<FinalizeChoiceData> {
  // Admin client required -- listings has RLS enabled with zero policies
  // for any role (service-role only, by design), so an RLS-subject client
  // always returns empty here regardless of real synced data.
  const admin = createAdminClient();

  // Paginated, not a plain select. PostgREST caps a select at 1,000 rows
  // and truncates SILENTLY -- a popular make/model accumulates listings
  // across repeated syncs (Honda Civic already sits at 569 real rows), and
  // a capped read here would not error, it would quietly drop trim options
  // the customer could have chosen.
  const listingsForModel: {
    trim: string | null;
    price_cents: number | null;
    year: number | null;
    powertrain: string | null;
  }[] = [];
  if (search.make && search.model) {
    const PAGE_SIZE = 1000;
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from("listings")
        .select("id, trim, price_cents, year, powertrain:raw_data->build->>powertrain_type")
        .eq("make", search.make)
        .eq("model", search.model)
        .not("trim", "is", null)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) break;
      listingsForModel.push(...((data ?? []) as unknown as typeof listingsForModel));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }

  // Scoped to the committed model year before anything is derived from it,
  // so the trim list AND the configurator gate below both only ever see
  // that year's inventory.
  const committedYear = search.model_year ?? null;
  const listingsForYear = filterListingsToCommittedYear(listingsForModel, committedYear);
  const trimOptions = buildTrimOptions(listingsForYear);

  const inventoryBlock =
    MODEL_YEAR_INVENTORY_BLOCK_ENABLED && search.make && search.model
      ? computeInventoryBlock(
          listingsForModel.map((l) => l.year),
          committedYear,
        )
      : null;

  const [makeModelOptions, modelYearOptions]: [MakeModelOptions, ModelYearOptions] =
    search.make && search.model
      ? await Promise.all([getIntakeMakeModelOptions(), getIntakeModelYearOptions()])
      : [{}, {}];

  const gating = await getConfiguratorQuestionsForTrims(
    search.make,
    search.model,
    trimOptions,
    listingsForYear,
  );
  const configuratorQuestions: Record<string, ConfiguratorQuestions> = {};
  for (const [optionId, result] of gating) {
    if (result.questions && hasAnyQuestion(result.questions)) {
      configuratorQuestions[optionId] = result.questions;
    }
  }

  return { trimOptions, configuratorQuestions, makeModelOptions, modelYearOptions, inventoryBlock };
}
