"use server";

import { createAdminClient } from "./supabase/admin";
import { INVENTORY_RADIUS_MILES } from "./inventory-radius";

// Real nearby-inventory count for the intake page, replacing the fabricated
// estimate match-counter.ts used to produce. Radius, not a nationwide count
// -- per the Step 2 pricing-pivot decision (see CLAUDE.md "Pricing Pivot
// Tracking"), local sourcing keeps transport cost/coordination lowest, so
// what a customer sees here is "how much is actually near you," not "how
// much exists somewhere in the country."

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type InventoryCountResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * Counts real synced listings for make+model within INVENTORY_RADIUS_MILES
 * of the customer's zip. listings is admin-only (no client-facing select
 * policy, same as every other read of it in this codebase), so this has to
 * be a server action rather than a direct client query.
 *
 * Listings whose dealer_zip has no match in zip_coordinates are excluded
 * from the count rather than treated as an error -- the data is clean today
 * (every dealer_zip currently resolves), but sourced third-party data can
 * drift, and a missing coordinate shouldn't take down the whole count.
 *
 * Returns { ok: false } only for the customer's own zip failing to resolve
 * (not every 5-digit ZIP code is a Census ZCTA -- PO-box-only zips and a
 * handful of others aren't) or a real query failure -- never as a stand-in
 * for zero. Zero is a legitimate, honestly-reported result.
 */
export async function countNearbyInventory(
  make: string,
  model: string,
  zip: string
): Promise<InventoryCountResult> {
  const admin = createAdminClient();

  const { data: listings, error: listingsError } = await admin
    .from("listings")
    .select("dealer_zip")
    .eq("make", make)
    .eq("model", model);

  if (listingsError) {
    return { ok: false, error: listingsError.message };
  }

  const dealerZips = Array.from(
    new Set((listings ?? []).map((l) => l.dealer_zip).filter((z): z is string => !!z))
  );
  const zipsToLookup = Array.from(new Set([...dealerZips, zip]));

  const { data: coords, error: coordsError } = await admin
    .from("zip_coordinates")
    .select("zip, latitude, longitude")
    .in("zip", zipsToLookup);

  if (coordsError) {
    return { ok: false, error: coordsError.message };
  }

  const coordByZip = new Map((coords ?? []).map((c) => [c.zip, { lat: c.latitude, lon: c.longitude }]));

  const customerCoord = coordByZip.get(zip);
  if (!customerCoord) {
    return { ok: false, error: `No coordinates found for zip ${zip}` };
  }

  const count = (listings ?? []).reduce((total, listing) => {
    const dealerCoord = listing.dealer_zip ? coordByZip.get(listing.dealer_zip) : undefined;
    if (!dealerCoord) return total;

    const distance = haversineMiles(customerCoord.lat, customerCoord.lon, dealerCoord.lat, dealerCoord.lon);
    return distance <= INVENTORY_RADIUS_MILES ? total + 1 : total;
  }, 0);

  return { ok: true, count };
}
