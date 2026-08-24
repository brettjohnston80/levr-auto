import "server-only";
import { createAdminClient } from "./supabase/admin";

interface DealerIdentity {
  dealer_name: string | null;
  dealer_city: string | null;
  dealer_state: string | null;
  mc_dealer_id?: number | null;
  dealer_phone?: string | null;
  dealer_website?: string | null;
  dealer_type?: string | null;
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
 * Returns dealership_id for every mc_dealer_id (from the given set) that's
 * already linked to a confirmed dealer_aliases row. Shared between the
 * sync-time auto-link below (new aliases only) and the one-time backfill's
 * retroactive reconciliation pass (all existing aliases) -- one source of
 * truth for "which mc_dealer_ids are already confirmed," not two parallel
 * implementations.
 */
export async function getDealershipIdsByMcDealerId(mcDealerIds: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (mcDealerIds.length === 0) return result;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dealer_aliases")
    .select("mc_dealer_id, dealership_id")
    .in("mc_dealer_id", mcDealerIds)
    .not("dealership_id", "is", null);

  if (error) {
    console.error("getDealershipIdsByMcDealerId failed:", error.message);
    return result;
  }

  for (const row of data ?? []) {
    if (row.mc_dealer_id != null && row.dealership_id) {
      result.set(row.mc_dealer_id, row.dealership_id);
    }
  }
  return result;
}

/**
 * LEVRating Phase A. Insert-if-new, no-op if already tracked -- this is what
 * naturally builds the /internal/dealerships unconfirmed queue as real
 * syncs run, no separate backfill needed for new data going forward (the
 * one-time backfill for pre-existing listings ran directly in the
 * dealerships migration). Never touches dealership_id/confirmed_at on an
 * existing row -- ignoreDuplicates means a genuinely new tuple is inserted
 * unconfirmed (or system-auto-linked, see below), and an already-known
 * tuple (confirmed or not) is left alone.
 *
 * LEVRating Phase A follow-up: a genuinely new alias whose mc_dealer_id
 * already matches a confirmed alias elsewhere is inserted pre-linked to
 * that same dealership (confirmed_via: 'system') instead of landing in the
 * unconfirmed queue. Deliberately never merges two dealerships that are
 * already independently confirmed, even if they later turn out to share an
 * mc_dealer_id -- that's a bigger, consequential structural change, left to
 * an agent via the existing Merge-into-existing UI.
 *
 * Deliberately non-blocking: called from the sync path, where a bookkeeping
 * failure here shouldn't fail the actual listings sync, same standard as
 * every other secondary side effect in this codebase (e.g. the webhook's
 * on-demand MarketCheck sync).
 */
export async function ensureDealerAliasesForListings(rows: DealerIdentity[]): Promise<void> {
  const seen = new Set<string>();
  const aliasRows: {
    dealer_name: string;
    dealer_city: string | null;
    dealer_state: string | null;
    mc_dealer_id: number | null;
    dealer_phone: string | null;
    dealer_website: string | null;
    dealer_type: string | null;
  }[] = [];

  for (const row of rows) {
    if (!row.dealer_name) continue;
    const key = dealerIdentityKey(row.dealer_name, row.dealer_city, row.dealer_state);
    if (seen.has(key)) continue;
    seen.add(key);
    aliasRows.push({
      dealer_name: row.dealer_name,
      dealer_city: row.dealer_city,
      dealer_state: row.dealer_state,
      mc_dealer_id: row.mc_dealer_id ?? null,
      dealer_phone: row.dealer_phone ?? null,
      dealer_website: row.dealer_website ?? null,
      dealer_type: row.dealer_type ?? null,
    });
  }

  if (aliasRows.length === 0) return;

  const mcDealerIds = [...new Set(aliasRows.map((r) => r.mc_dealer_id).filter((id): id is number => id != null))];
  const dealershipByMcDealerId = await getDealershipIdsByMcDealerId(mcDealerIds);

  const insertRows = aliasRows.map((r) => {
    const matchedDealershipId = r.mc_dealer_id != null ? dealershipByMcDealerId.get(r.mc_dealer_id) : undefined;
    if (!matchedDealershipId) return r;
    return {
      ...r,
      dealership_id: matchedDealershipId,
      confirmed_at: new Date().toISOString(),
      confirmed_via: "system" as const,
    };
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("dealer_aliases")
    .upsert(insertRows, { onConflict: "dealer_name,dealer_city_key,dealer_state_key", ignoreDuplicates: true });

  if (error) {
    console.error("ensureDealerAliasesForListings failed:", error.message);
  }
}

/**
 * LEVRating Phase B. Resolves a dealer identity to a dealer_aliases row id,
 * creating one if it doesn't exist yet -- unlike ensureDealerAliasesForListings
 * (fire-and-forget, called from the sync path), this is a synchronous
 * resolve-or-create used by the post-deal survey's dealer resolution, which
 * needs the actual id back, not just an eventual side effect. Reuses the
 * exact same insert/auto-link logic (ensureDealerAliasesForListings) rather
 * than duplicating it, so an off-lot offer's dealer (no listing, so no
 * dealer_city/dealer_state at all) still goes through the identical
 * null-safe identity-key matching and mc_dealer_id auto-link path as every
 * listing-sourced alias.
 */
export async function getOrCreateDealerAlias(
  name: string,
  city: string | null,
  state: string | null,
  mcDealerId: number | null
): Promise<string> {
  const admin = createAdminClient();

  const { data: existing, error: selectError } = await admin
    .from("dealer_aliases")
    .select("id")
    .eq("dealer_name", name)
    .eq("dealer_city_key", city ?? "")
    .eq("dealer_state_key", state ?? "")
    .maybeSingle();

  if (selectError) {
    throw new Error(`getOrCreateDealerAlias select failed: ${selectError.message}`);
  }
  if (existing) {
    return existing.id;
  }

  await ensureDealerAliasesForListings([
    { dealer_name: name, dealer_city: city, dealer_state: state, mc_dealer_id: mcDealerId },
  ]);

  const { data: created, error: recheckError } = await admin
    .from("dealer_aliases")
    .select("id")
    .eq("dealer_name", name)
    .eq("dealer_city_key", city ?? "")
    .eq("dealer_state_key", state ?? "")
    .maybeSingle();

  if (recheckError) {
    throw new Error(`getOrCreateDealerAlias recheck failed: ${recheckError.message}`);
  }
  if (!created) {
    throw new Error(`getOrCreateDealerAlias: alias not found after insert for "${name}"`);
  }
  return created.id;
}
