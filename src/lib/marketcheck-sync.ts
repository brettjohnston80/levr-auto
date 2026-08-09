import "server-only";
import { createAdminClient } from "./supabase/admin";
import { searchActiveListings, type MarketCheckListing } from "./marketcheck";

const PAGE_SIZE = 50;

function toListingRow(listing: MarketCheckListing, fallbackMake: string, fallbackModel: string) {
  return {
    vin: listing.vin,
    make: listing.build?.make ?? fallbackMake,
    model: listing.build?.model ?? fallbackModel,
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
    raw_data: listing,
    synced_at: new Date().toISOString(),
  };
}

/**
 * Syncs active new-inventory listings for a single make/model into the
 * `listings` table, upserting on VIN so re-syncs never create duplicates.
 *
 * `maxPages` caps API usage per call (50 listings/page) — MarketCheck's free
 * tier is 500 calls/mo, and a popular model can have thousands of national
 * listings. The full demand-driven scheduler (next up) will decide real
 * per-make/model budgets; this default is deliberately conservative.
 */
export async function syncListingsForMakeModel(
  make: string,
  model: string,
  maxPages = 3
) {
  const supabase = createAdminClient();
  let start = 0;
  let totalFound = 0;
  let upserted = 0;
  let pages = 0;

  for (let page = 0; page < maxPages; page++) {
    const result = await searchActiveListings({ make, model, rows: PAGE_SIZE, start });
    totalFound = result.num_found;
    pages++;

    if (result.listings.length === 0) break;

    const rows = result.listings
      .filter((listing) => !!listing.vin)
      .map((listing) => toListingRow(listing, make, model));

    if (rows.length > 0) {
      const { error } = await supabase.from("listings").upsert(rows, { onConflict: "vin" });
      if (error) {
        throw new Error(`Listings upsert failed: ${error.message}`);
      }
      upserted += rows.length;
    }

    start += PAGE_SIZE;
    if (start >= totalFound) break;
  }

  return { make, model, totalFound, upserted, pages };
}
