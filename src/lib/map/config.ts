// Map provider settings (2026-09-26). The ONLY provider-specific values in
// the app live here and in src/components/offer-map.tsx, so a later move to
// MapLibre + a self-hosted Protomaps basemap (docs/plans/offer-map-plan.md)
// only touches those two files:
//  - library:     mapbox-gl            -> maplibre-gl (+ pmtiles protocol)
//  - style:       MAP_STYLE_URL        -> a Protomaps style pointing at our PMTiles
//  - token:       NEXT_PUBLIC_MAPBOX_TOKEN -> none
//  - attribution: Mapbox's own control -> "© OpenStreetMap contributors"

/** Public, browser-side token (pk.*). Unset => the Map toggle is hidden. */
export const MAP_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export function mapAvailable(): boolean {
  return MAP_TOKEN.startsWith("pk.");
}

/** Dark style to match the site. */
export const MAP_STYLE_URL = "mapbox://styles/mapbox/dark-v11";

/** Initial fit never zooms past city level (single offer / one city). */
export const MAP_FIT_MAX_ZOOM = 11;
