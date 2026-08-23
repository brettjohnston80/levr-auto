import "server-only";
import { createAdminClient } from "./supabase/admin";

interface DealerIdentity {
  dealer_name: string | null;
  dealer_city: string | null;
  dealer_state: string | null;
}

/**
 * Shared key shape for matching a listings row's raw dealer identity
 * against a dealer_aliases row -- must stay in sync with dealer_aliases'
 * own dealer_city_key/dealer_state_key generated columns (coalesce null to
 * ""), since dealership-queue.ts uses this same key to compute listing
 * counts by grouping listings in application code rather than via a FK.
 */
export function dealerIdentityKey(name: string, city: string | null, state: string | null): string {
  return `${name}|${city ?? ""}|${state ?? ""}`;
}

/**
 * LEVRating Phase A. Insert-if-new, no-op if already tracked -- this is what
 * naturally builds the /internal/dealerships unconfirmed queue as real
 * syncs run, no separate backfill needed for new data going forward (the
 * one-time backfill for pre-existing listings ran directly in the
 * dealerships migration). Never touches dealership_id/confirmed_at on an
 * existing row -- ignoreDuplicates means a genuinely new tuple is inserted
 * unconfirmed, and an already-known tuple (confirmed or not) is left alone.
 *
 * Deliberately non-blocking: called from the sync path, where a bookkeeping
 * failure here shouldn't fail the actual listings sync, same standard as
 * every other secondary side effect in this codebase (e.g. the webhook's
 * on-demand MarketCheck sync).
 */
export async function ensureDealerAliasesForListings(rows: DealerIdentity[]): Promise<void> {
  const seen = new Set<string>();
  const aliasRows: { dealer_name: string; dealer_city: string | null; dealer_state: string | null }[] = [];

  for (const row of rows) {
    if (!row.dealer_name) continue;
    const key = dealerIdentityKey(row.dealer_name, row.dealer_city, row.dealer_state);
    if (seen.has(key)) continue;
    seen.add(key);
    aliasRows.push({ dealer_name: row.dealer_name, dealer_city: row.dealer_city, dealer_state: row.dealer_state });
  }

  if (aliasRows.length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("dealer_aliases")
    .upsert(aliasRows, { onConflict: "dealer_name,dealer_city_key,dealer_state_key", ignoreDuplicates: true });

  if (error) {
    console.error("ensureDealerAliasesForListings failed:", error.message);
  }
}
