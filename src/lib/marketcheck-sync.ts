import "server-only";
import { createAdminClient } from "./supabase/admin";
import { ensureDealerAliasesForListings } from "./dealer-aliases";
import { searchActiveListings, type MarketCheckListing } from "./marketcheck";
import { marketCheckModelRule } from "./marketcheck-models";

const PAGE_SIZE = 50;

/**
 * MarketCheck's own car_type=new filter isn't fully reliable on its own —
 * verified against real data that it still lets through listings for older
 * model years (e.g. a 2019 model tagged car_type: new). A model year of the
 * current year or one year ahead (accounts for early release of next-model-
 * year vehicles) is the trustworthiness bar; anything older, or missing a
 * year entirely, is excluded rather than stored as if it were real new
 * inventory.
 */
function isTrustworthyNewListingYear(year: number | null | undefined): boolean {
  if (year == null) return false;
  const currentYear = new Date().getFullYear();
  return year === currentYear || year === currentYear + 1;
}

function sameIgnoringCase(a: string | undefined, b: string): boolean {
  return (a ?? "").toLowerCase() === b.toLowerCase();
}

function toListingRow(
  listing: MarketCheckListing,
  fallbackMake: string,
  fallbackModel: string,
  forceOurNames = false,
) {
  return {
    vin: listing.vin,
    // A mapped model (marketcheck-models.ts) is stored under OUR names, so
    // everything reading listings by make/model finds it. So is a name that
    // differs only in capitals (MarketCheck "INFINITI" vs our "Infiniti",
    // 2026-10-11) -- reads match make/model exactly.
    make:
      forceOurNames || sameIgnoringCase(listing.build?.make, fallbackMake)
        ? fallbackMake
        : (listing.build?.make ?? fallbackMake),
    model:
      forceOurNames || sameIgnoringCase(listing.build?.model, fallbackModel)
        ? fallbackModel
        : (listing.build?.model ?? fallbackModel),
    trim: listing.build?.trim ?? null,
    year: listing.build?.year ?? null,
    color: listing.exterior_color ?? null,
    price_cents: listing.price != null ? Math.round(listing.price * 100) : null,
    msrp_cents: listing.msrp != null ? Math.round(listing.msrp * 100) : null,
    car_type: "new" as const,
    dealer_name: listing.dealer?.name ?? null,
    dealer_phone: listing.dealer?.phone ?? null,
    dealer_website: listing.dealer?.website ?? null,
    dealer_city: listing.dealer?.city ?? null,
    dealer_state: listing.dealer?.state ?? null,
    dealer_zip: listing.dealer?.zip ?? null,
    dealer_type: listing.dealer?.dealer_type ?? null,
    mc_dealer_id: listing.mc_dealership?.mc_dealer_id ?? null,
    raw_data: listing,
    synced_at: new Date().toISOString(),
  };
}

/**
 * A sync is skipped when the make/model was refreshed this recently
 * (2026-10-11, approved by Brett). Payment, a vehicle change, a switch and
 * the agent forms each sync on demand, and before this they always called
 * MarketCheck even if the same model had been refreshed minutes earlier.
 * The scheduled tiers (marketcheck-scheduler.ts) pass their own, longer
 * windows.
 */
export const DEFAULT_FRESH_WITHIN_HOURS = 24;

/**
 * When this make/model was last refreshed: the newest `synced_at` among its
 * listings (every sync stamps every row it upserts, stored under OUR
 * make/model names). Null when nothing is stored -- a model whose last sync
 * found no listings is indistinguishable from one never synced, so it is
 * simply synced again.
 */
export async function getLastSyncedAt(make: string, model: string): Promise<Date | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .select("synced_at")
    .eq("make", make)
    .eq("model", model)
    .order("synced_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Failed to read last sync time: ${error.message}`);
  const value = data?.[0]?.synced_at as string | undefined;
  return value ? new Date(value) : null;
}

export interface SyncOptions {
  /** Caps API usage per MarketCheck model name (50 listings/page). */
  maxPages?: number;
  /** Skip when refreshed within this many hours. Default 24. */
  freshWithinHours?: number;
  /** Sync regardless of the last refresh (manual internal route only). */
  force?: boolean;
}

/**
 * Syncs active new-inventory listings for a single make/model into the
 * `listings` table, upserting on VIN so re-syncs never create duplicates.
 *
 * `maxPages` caps API usage per call (50 listings/page) — MarketCheck's free
 * tier is 500 calls/mo, and a popular model can have thousands of national
 * listings.
 *
 * Returns `skipped: true` (and makes NO MarketCheck call) when the model was
 * refreshed within `freshWithinHours`.
 */
export async function syncListingsForMakeModel(
  make: string,
  model: string,
  { maxPages = 3, freshWithinHours = DEFAULT_FRESH_WITHIN_HOURS, force = false }: SyncOptions = {},
) {
  if (!force) {
    const lastSyncedAt = await getLastSyncedAt(make, model);
    if (lastSyncedAt && Date.now() - lastSyncedAt.getTime() < freshWithinHours * 3_600_000) {
      return {
        make,
        model,
        skipped: true as const,
        lastSyncedAt: lastSyncedAt.toISOString(),
        totalFound: 0,
        upserted: 0,
        excludedForYear: 0,
        pages: 0,
      };
    }
  }

  const supabase = createAdminClient();
  let totalFound = 0;
  let upserted = 0;
  let excludedForYear = 0;
  let pages = 0;

  // MarketCheck's own model name(s) for ours (2026-10-10); usually just ours.
  const rule = marketCheckModelRule(make, model);
  for (const mcModel of rule?.mcModels ?? [model]) {
    let start = 0;
    for (let page = 0; page < maxPages; page++) {
      const result = await searchActiveListings({
        make,
        model: mcModel,
        rows: PAGE_SIZE,
        start,
      });
      totalFound += page === 0 ? result.num_found : 0;
      pages++;

      if (result.listings.length === 0) break;

      const withVin = result.listings.filter((listing) => !!listing.vin);
      const trusted = withVin.filter((listing) =>
        isTrustworthyNewListingYear(listing.build?.year),
      );
      excludedForYear += withVin.length - trusted.length;

      const rows = trusted
        .filter((listing) => !rule?.keep || rule.keep(listing))
        .map((listing) => toListingRow(listing, make, model, !!rule));

      if (rows.length > 0) {
        const { error } = await supabase
          .from("listings")
          .upsert(rows, { onConflict: "vin" });
        if (error) {
          throw new Error(`Listings upsert failed: ${error.message}`);
        }
        upserted += rows.length;

        // LEVRating Phase A -- keeps dealer_aliases current with every sync,
        // non-blocking (see dealer-aliases.ts for why).
        await ensureDealerAliasesForListings(rows);
      }

      start += PAGE_SIZE;
      if (start >= result.num_found) break;
    }
  }

  return {
    make,
    model,
    skipped: false as const,
    lastSyncedAt: new Date().toISOString(),
    totalFound,
    upserted,
    excludedForYear,
    pages,
  };
}
