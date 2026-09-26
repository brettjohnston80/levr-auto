// Plain (non-"use server") module so both the nearby-inventory count
// (inventory-count.ts, a server-action file that may only export async
// functions) and the offer detail's customer-to-dealer distance share one
// implementation.
//
// Distances here are between ZIP centroids from zip_coordinates (Census
// ZCTA data) -- approximate by construction, which is why the customer-
// facing copy says "about N miles". No external API, no per-call cost.

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
