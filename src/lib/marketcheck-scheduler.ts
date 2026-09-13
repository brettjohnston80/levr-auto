import "server-only";
import { createAdminClient } from "./supabase/admin";
import { syncListingsForMakeModel } from "./marketcheck-sync";
import { getTestCustomerIds } from "./test-accounts";

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

  // Tester-program accounts are excluded here, at the scheduler, rather
  // than at the two cron call sites. One place to get right, and it fails
  // in the safe direction: a filter that misses costs API quota, never
  // correctness of what a real customer sees.
  //
  // MarketCheck's quota is the binding constraint on this project -- the
  // trim-reconciliation audit exhausted it mid-run and that work is still
  // blocked on the reset. Ten testers each picking a different vehicle
  // would otherwise multiply nightly calls directly, for inventory nobody
  // is really buying.
  const testCustomerIds = await getTestCustomerIds();

  const rows: { make: string; model: string; customer_id: string }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("customer_searches")
      .select("id, make, model, customer_id")
      .eq("search_status", "searching")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load nightly make/models: ${error.message}`);
    }
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < PAGE_SIZE) break;
  }

  // Filtered in application code rather than via a .not(...in...) clause:
  // the id list is built at runtime and an empty set makes that clause
  // awkward to express, while these rows are already in memory. Same
  // convention as inventory-count.ts's Haversine pass.
  const realRows = rows.filter((row) => !testCustomerIds.has(row.customer_id));

  // A row with no make/model is the "not sure yet" intake path -- there is
  // nothing to sync for it until an agent fills those in, and letting it
  // through produces a null::null dedupe key that reaches runBatchSync.
  return dedupeMakeModels(realRows.filter((row) => row.make && row.model));
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
