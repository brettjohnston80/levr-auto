/**
 * ⚠ MASTER OFF-SWITCH FOR LISTING PHOTOS. Currently DISABLED.
 *
 * Real dealer photos of the exact VIN, from a linked MarketCheck listing's
 * stored response (listings.raw_data.media) -- no extra API call. OFF until
 * MarketCheck's terms for displaying these photos to end users have been
 * reviewed (Brett, 2026-09-25). They are dealer images served from
 * MarketCheck's CDN, and can also disappear once the car sells.
 *
 * Gated at the data layer, same as VEHICLE_COLOR_IMAGES_ENABLED: while this
 * is false, listingPhotoUrls() returns nothing, so no caller can render a
 * listing photo by any route. Turning it on is flipping this one line.
 */
export const LISTING_PHOTOS_ENABLED = false;

// A listing can carry up to ~60 photos (1-58 seen, median 10); more than
// this adds page weight without adding anything a customer needs.
const MAX_LISTING_PHOTOS = 30;

/**
 * Photo URLs from a listing's raw_data.media, or [] when the switch is off or
 * nothing usable is there. photo_links was present on every sampled listing
 * (2026-09-25); photo_links_cached is only a fallback -- whether it's the
 * more stable of the two hasn't been verified.
 */
export function listingPhotoUrls(media: unknown): string[] {
  if (!LISTING_PHOTOS_ENABLED) return [];
  if (!media || typeof media !== "object") return [];

  const m = media as { photo_links?: unknown; photo_links_cached?: unknown };
  const pick = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((u): u is string => typeof u === "string" && u.startsWith("https://")) : [];

  const links = pick(m.photo_links);
  return (links.length > 0 ? links : pick(m.photo_links_cached)).slice(0, MAX_LISTING_PHOTOS);
}
