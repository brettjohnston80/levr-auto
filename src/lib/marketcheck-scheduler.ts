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

/**
 * Refresh cadence per tier (2026-10-11, approved by Brett, to keep
 * MarketCheck usage inside its quota as real customers arrive). Each tier is
 * a "skip if refreshed within" window handed to syncListingsForMakeModel, so
 * any refresh -- scheduled, at payment, or an agent's "Refresh inventory" --
 * resets a model's clock and nothing is fetched twice:
 *
 * - Live searches: the daily cron refreshes each model once it is ~3 days
 *   old (70h, so the 06:00 run lands every third day despite run jitter).
 * - Searched by a real customer in the last 90 days: the weekly cron
 *   refreshes it every week (6 days, same jitter reasoning).
 * - Everything else already in `listings`: the weekly cron refreshes it only
 *   once it is ~4 weeks old, i.e. monthly.
 */
export const LIVE_SEARCH_REFRESH_HOURS = 70;
export const RECENT_SEARCH_REFRESH_HOURS = 6 * 24;
export const OTHER_MODEL_REFRESH_HOURS = 27 * 24;
const RECENT_SEARCH_DAYS = 90;

function makeModelKey(row: MakeModel): string {
  // Case-insensitive: our names and stored listings agree today, but a
  // capitals-only mismatch (INFINITI vs Infiniti) must never split a model
  // into two refresh tiers.
  return `${row.make.toLowerCase()}::${row.model.toLowerCase()}`;
}

function dedupeMakeModels(rows: MakeModel[]): MakeModel[] {
  const seen = new Map<string, MakeModel>();
  for (const row of rows) {
    seen.set(makeModelKey(row), row);
  }
  return [...seen.values()];
}

function diffMakeModels(all: MakeModel[], exclude: MakeModel[]): MakeModel[] {
  const excluded = new Set(exclude.map(makeModelKey));
  return all.filter((row) => !excluded.has(makeModelKey(row)));
}

/**
 * The demand registry: any make/model with at least one customer actively
 * searching (search_status = 'searching'). The daily cron refreshes these
 * every ~3 days (LIVE_SEARCH_REFRESH_HOURS); one refresh serves every search
 * on the same make/model.
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
 * Make/models a REAL customer (paid, not a test account) searched in the
 * last 90 days: paid in that window, ended (purchased/cancelled) in that
 * window, or still open. Unpaid searches don't count -- a real customer is
 * one with a paid search.
 */
export async function getRecentlySearchedMakeModels(): Promise<MakeModel[]> {
  const supabase = createAdminClient();
  const testCustomerIds = await getTestCustomerIds();
  const since = new Date(Date.now() - RECENT_SEARCH_DAYS * 24 * 3_600_000).toISOString();

  const rows: { make: string | null; model: string | null; customer_id: string }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("customer_searches")
      .select("id, make, model, customer_id")
      .not("paid_at", "is", null)
      .or(
        `paid_at.gte.${since},purchased_at.gte.${since},cancelled_at.gte.${since},search_status.in.(awaiting_finalization,pending_refinement,searching,paused)`,
      )
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load recently searched make/models: ${error.message}`);
    }
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return dedupeMakeModels(
    rows
      .filter((row) => !testCustomerIds.has(row.customer_id) && row.make && row.model)
      .map((row) => ({ make: row.make!, model: row.model! })),
  );
}

/**
 * Everything already known to the system (present in `listings` from a
 * prior sync) but without a live search -- split into the weekly tier
 * (searched by a real customer in the last 90 days) and the monthly tier
 * (everything else). Deliberately scoped to what we already know about, not
 * the universe of all possible makes/models.
 */
export async function getWeeklyAndMonthlyMakeModels(): Promise<{
  weekly: MakeModel[];
  monthly: MakeModel[];
}> {
  const supabase = createAdminClient();

  const known: MakeModel[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, make, model")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load known make/models: ${error.message}`);
    }
    known.push(...((data ?? []) as MakeModel[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const [live, recent] = await Promise.all([getNightlyMakeModels(), getRecentlySearchedMakeModels()]);
  const notLive = diffMakeModels(dedupeMakeModels(known), live);
  const recentKeys = new Set(recent.map(makeModelKey));
  return {
    weekly: notLive.filter((row) => recentKeys.has(makeModelKey(row))),
    monthly: notLive.filter((row) => !recentKeys.has(makeModelKey(row))),
  };
}

export interface BatchSyncResult {
  make: string;
  model: string;
  ok: boolean;
  upserted?: number;
  excludedForYear?: number;
  totalFound?: number;
  /** True when the model was refreshed recently enough that no call was made. */
  skipped?: boolean;
  lastSyncedAt?: string;
  error?: string;
}

/**
 * Runs syncListingsForMakeModel across a batch of make/models sequentially
 * (not in parallel — predictable load against MarketCheck's rate limit, and
 * easier to reason about in logs). A failure on one make/model is recorded
 * and the batch continues rather than aborting the rest.
 */
export async function runBatchSync(
  makeModels: MakeModel[],
  freshWithinHours: number,
): Promise<BatchSyncResult[]> {
  const results: BatchSyncResult[] = [];

  for (const { make, model } of makeModels) {
    try {
      const result = await syncListingsForMakeModel(make, model, { freshWithinHours });
      results.push({
        make,
        model,
        ok: true,
        skipped: result.skipped,
        lastSyncedAt: result.lastSyncedAt,
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
