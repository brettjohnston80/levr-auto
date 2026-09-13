import "server-only";
import { createAdminClient } from "./supabase/admin";
import { syncListingsForMakeModel } from "./marketcheck-sync";

interface MakeModel {
  make: string;
  model: string;
}

/**
 * PostgREST caps a plain select at 1,000 rows and truncates SILENTLY.
 *
 * Both queries in this file were previously unpaginated, and the weekly one
 * was already losing data in production: `listings` holds 1,761 rows, so
 * the read returned 1,000 and Toyota Camry and Toyota RAV4 never appeared
 * in the weekly set at all (measured 2026-09-12). The failure mode is
 * invisible -- no error, just make/models quietly going stale, which then
 * costs MORE MarketCheck calls later via on-demand syncs. Exactly the
 * resource this file exists to budget.
 */
const PAGE_SIZE = 1000;

function dedupeMakeModels(rows: MakeModel[]): MakeModel[] {
  const seen = new Map<string, MakeModel>();
  for (const row of rows) {
    seen.set(`${row.make}::${row.model}`, row);
  }
  return [...seen.values()];
}

function diffMakeModels(all: MakeModel[], exclude: MakeModel[]): MakeModel[] {
  const excluded = new Set(exclude.map((row) => `${row.make}::${row.model}`));
  return all.filter((row) => !excluded.has(`${row.make}::${row.model}`));
}

/**
 * The demand registry: any make/model with at least one customer actively
 * searching (search_status = 'searching') syncs nightly.
 */
export async function getNightlyMakeModels(): Promise<MakeModel[]> {
  const supabase = createAdminClient();

  const rows: MakeModel[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("customer_searches")
      .select("id, make, model")
      .eq("search_status", "searching")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load nightly make/models: ${error.message}`);
    }
    rows.push(...((data ?? []) as MakeModel[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return dedupeMakeModels(rows);
}

/**
 * Everything else already known to the system (present in `listings` from a
 * prior sync) but not currently in active demand — kept fresh weekly instead
 * of nightly. Deliberately scoped to what we already know about, not the
 * universe of all possible makes/models — a make/model only ever enters
 * `listings` once something (a customer search, or a prior manual sync) has
 * caused a sync for it.
 */
export async function getWeeklyMakeModels(): Promise<MakeModel[]> {
  const supabase = createAdminClient();

  const known: MakeModel[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, make, model")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load weekly make/models: ${error.message}`);
    }
    known.push(...((data ?? []) as MakeModel[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const nightly = await getNightlyMakeModels();

  return diffMakeModels(dedupeMakeModels(known), nightly);
}

export interface BatchSyncResult {
  make: string;
  model: string;
  ok: boolean;
  upserted?: number;
  excludedForYear?: number;
  totalFound?: number;
  error?: string;
}

/**
 * Runs syncListingsForMakeModel across a batch of make/models sequentially
 * (not in parallel — predictable load against MarketCheck's rate limit, and
 * easier to reason about in logs). A failure on one make/model is recorded
 * and the batch continues rather than aborting the rest.
 */
export async function runBatchSync(makeModels: MakeModel[]): Promise<BatchSyncResult[]> {
  const results: BatchSyncResult[] = [];

  for (const { make, model } of makeModels) {
    try {
      const result = await syncListingsForMakeModel(make, model);
      results.push({
        make,
        model,
        ok: true,
        upserted: result.upserted,
        excludedForYear: result.excludedForYear,
        totalFound: result.totalFound,
      });
    } catch (error) {
      results.push({
        make,
        model,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
