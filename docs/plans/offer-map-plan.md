# Map view of offers on Your Deal — plan (2026-09-26)

Status: **APPROVED 2026-09-26, provider changed to Mapbox the same day.** Build order: after pickup/delivery is verified, then the agent-message email, then this.

## Build notes (2026-09-26)

Built and verified on a disposable customer, using the dev token on `127.0.0.1`.

**Where the code lives:**
- Provider-specific: `src/lib/map/config.ts` and `src/components/offer-map.tsx`, the only file that imports `mapbox-gl`. It's loaded only when Map is opened.
- Provider-neutral: `src/lib/map/pins.ts` (pin data, approved copy, geodesic circle) and `src/components/offer-map-view.tsx` (legend and no-location note).

**Dealer coordinates** come from MarketCheck `raw_data.dealer.latitude` / `longitude`. These were present on 500 of 500 sampled listings and are stored as strings. They fall back to the dealer ZIP's centroid.

**Deviations to review:**
1. **Highlighted pins** show as a thicker amber outline, not a star badge. The map style's font may not include a ★ glyph, so a text symbol risked rendering as an empty box. The legend swatch matches.
2. **The no-location note** uses proper singular/plural wording ("1 offer can't…", "2 offers can't…") instead of the literal "offer(s)".

**Fit behaviour:** the initial view fits the pins plus the customer's area. It doesn't try to fit the whole range circle, so a large range can extend past the edges.

**Clustering:** pins at the identical spot (e.g. two offers on one ZIP centroid) open a list instead of zooming. A first version zoomed to street level and stacked them; that was caught in verification and fixed.

**Not verifiable in automation:**
- Two-finger gestures on real touch screens.
- Real 60 Hz rendering. Scripted tabs pause animation frames, so verification drove frames with a timer.

Both want a check on a real phone.

## Brett's decisions (2026-09-26)

1. **Provider: Mapbox GL JS, for now.** Supabase stays on the Free plan, whose 50 MB file cap rules out self-hosting a US basemap. MapLibre + a self-hosted Protomaps basemap stays the target if Supabase is upgraded later.
2. **All map-provider code lives in one module** (`src/lib/map/` plus one client component), behind a small interface, so moving to MapLibre later only touches that module. MapLibre is an API-compatible fork of Mapbox GL JS, so the switch amounts to changing the library, the tile source and the attribution.
3. **Placement:** a List | Map toggle next to "Sort by", defaulting to List.
4. **Copy:** approved as written, except the legend reads **"Declined or withdrawn"**, matching the offer cards.

## 1. Map provider (researched 2026-09-26)

| Option | Free allowance | Beyond free | Commercial use | Notes |
|---|---|---|---|---|
| **Google Maps** (Dynamic Maps) | 10,000 loads/mo | $7.00 per 1,000 | Yes | Most expensive per load. Billing account required. |
| **Mapbox GL JS** | 50,000 loads/mo | $5.00 per 1,000 (50k–100k), cheaper at volume | Yes | Polished and quick to build. Needs a public token and Mapbox attribution. Lock-in: its styles and tiles are Mapbox's. |
| **MapTiler Cloud** | 5,000 sessions/mo | Flex plan $30/mo (25k sessions) | **Free plan is non-commercial only** | Would need the paid plan from day one. |
| **MapLibre GL JS + Protomaps basemap, self-hosted** | No per-load fee | Storage plus bandwidth only | Yes (ODbL; OpenStreetMap attribution required) | Open-source renderer (a Mapbox GL fork). One tile file (PMTiles) served with HTTP range requests from our own storage. The planet is ~120 GB; a US extract at a capped zoom level is much smaller, measured at build time. |
| Public OpenStreetMap tiles | — | — | Not suitable | Their policy is best-effort, with no SLA; heavy or commercial use can be blocked without notice, and they point production apps elsewhere. **Excluded.** |

**Our likely scale:** each map view is one "load". Even 1,000 active customers opening the map about 10 times a month is roughly 10,000 loads, which fits every free tier except MapTiler's (non-commercial) and sits at Google's free cap.

**Original recommendation (superseded by decision 1): MapLibre GL JS + a self-hosted Protomaps US basemap.**
- **Cost:** no per-load pricing, ever, and no vendor account or API key. Expected cost is a few dollars a month for storage and bandwidth at this scale.
- **Other benefits:** no lock-in, and the renderer and styling are the same as Mapbox's if we ever switch.
- **Trade-off:** a one-time setup: generate the US extract with the `pmtiles` CLI and upload it to storage that supports range requests, such as a public Supabase Storage bucket or Vercel Blob.

**Mapbox: chosen for now (decision 1).** It's the fastest to ship and free up to 50,000 loads a month, then $5 per 1,000.

## 1b. Mapbox setup (what Brett does)

**Account:** sign up at mapbox.com. Mapbox may ask for a payment method.
- The first 50,000 map loads a month are free; above that it's usage-billed, starting at $5 per 1,000.
- A "map load" is one map initialization. Tile requests within it are unlimited.
- The map only initializes when the customer opens the Map view, so loads stay well under the free tier at our scale.
- Setting a billing or usage alert in the account, if offered, is a sensible backstop.

**Two public tokens** (Account → Tokens → Create a token). The default public token can't be URL-restricted, so don't use it.
1. **Production token** "levr-web-prod":
   - Public scopes only: `styles:read`, `fonts:read` (defaults are fine). No secret scopes.
   - URL restrictions: add `levrauto.com`. Subdomains are included automatically, so `www.levrauto.com` is covered.
   - Mapbox doesn't support wildcards or IP addresses in URL restrictions. **Vercel preview URLs won't be allowed**, so the map won't load on preview deployments unless a specific preview URL is added. Accepted.
2. **Development token** "levr-web-dev", same scopes. Two options:
   - **(Recommended) No URL restrictions.** Local verification runs on `127.0.0.1`, so Brett's `localhost` review session stays untouched, and Mapbox rejects IP addresses in URL restrictions. It only ever lives in `.env.local` and is a public `pk.` token, never a secret-scope one.
   - **Restricted to `localhost`.** Add `localhost:3000` (a port must be listed when it isn't 80/443). This works for Brett's own local use, but the map then won't load on `127.0.0.1`. Map verification would have to run on `localhost`, which means signing the review session out during it.

**Where the tokens go (Brett sets them; never pasted into chat):**
- `.env.local`: `NEXT_PUBLIC_MAPBOX_TOKEN=<levr-web-dev token>`
- Vercel → Project → Settings → Environment Variables: `NEXT_PUBLIC_MAPBOX_TOKEN=<levr-web-prod token>` for **Production**. Leave Preview unset, or set it to the prod token knowing previews won't load the map.
- It's `NEXT_PUBLIC_` because the browser needs it. That's expected for a Mapbox public token; the URL restriction is what protects the production one.
- If the variable is missing, the Map toggle is hidden and the list works as before.

**Style:** Mapbox's dark style (`mapbox://styles/mapbox/dark-v11`), to match the site.

## 2. Coordinates

**Dealer pins, in order of preference:**
1. The linked listing's dealer latitude/longitude from MarketCheck `raw_data`. The field names get confirmed against real rows at build time.
2. Otherwise, the ZIP centroid from `zip_coordinates` for the offer's `dealer_zip` (ZIP+4 trimmed).
3. Otherwise, no pin. Under the map: "{N} offer(s) can't be shown on the map because the dealer's location isn't on file." These offers still appear in the list view.

**Customer pin:** the search ZIP's centroid only, never a street address (we don't collect one). It's labelled as an area, not a point.

**ZIP-centroid pins are approximate.** The preview says "Approximate location" when a pin comes from a ZIP rather than a listing.

## 3. Clustering and overlap

- Use the map library's built-in GeoJSON clustering (identical in Mapbox GL JS and MapLibre). Nearby pins merge into a count bubble, and tapping it zooms in.
- Pins can share exact coordinates: two dealers in one ZIP, or ZIP-centroid fallbacks. If a cluster still can't split at max zoom, tapping it opens a small list of those offers instead of zooming further.

## 4. Where it lives — decided: List | Map toggle

**Recommended: a List | Map toggle** next to "Sort by" on Your Deal.
- Default is **List**. The choice lives in the URL (`?view=map`), like sort.
- The map's JavaScript loads only when the map is opened, so the page stays fast for everyone else.

**Alternative: the map always above the list.** It's more discoverable, but it pushes the offers below the fold on phones, and loads the map on every visit.

## 5. Behaviour

- **Preview (hover on desktop, tap on mobile):** car photo (same rules as the card: listing photo when enabled, otherwise the labelled stock photo, otherwise the placeholder), dealer name, price, distance, and a "View details" button. The button opens the same offer detail view the card uses.
- **Mobile:**
  - The map takes about 60% of the screen height, and tapping a pin shows the preview as a bottom sheet.
  - Two-finger pan and zoom ("cooperative gestures"), so a one-finger swipe still scrolls the page.
- **Zoom:** +/- controls plus scroll or pinch.
- **Initial view:** fits all pins plus the customer's area.
- **Single offer:** fits the customer and that one dealer, with a zoom cap so it isn't street-level.
- **No offers:** the Map toggle is hidden.
- **All offers in one city:** the fit is capped at city zoom, and clustering handles overlaps.
- **Pickup range:** a translucent circle of the given radius around the customer's area, only when they gave a distance. It's drawn as a geodesic polygon computed in code, with no extra library.

## 6. Pin status

- **Pending:** emerald outline.
- **Accepted:** solid emerald with a check mark.
- **Highlighted:** amber star badge.
- **Declined or withdrawn:** muted gray, drawn beneath the others.
- **Beyond pickup range:** an amber ring, using the same rule as the list flag (`isBeyondPickupRange`), so the map and the list can't disagree.
- A small legend explains all five.

## 7. Customer-facing copy — APPROVED 2026-09-26 (legend wording changed per decision 4)

- Toggle: "List" · "Map"
- Customer pin label: "Your area"
- Range circle label: "Your pickup range: {R} miles"
- Legend: "Pending" · "Accepted" · "Highlighted" · "Declined or withdrawn" · "Beyond your pickup range"
- Preview: "{N} miles away" (or nothing when unknown), "Approximate location" (ZIP-based pins), "View details" (existing, already approved)
- No-location note: "{N} offer(s) can't be shown on the map because the dealer's location isn't on file."
- ~~Map attribution: "© OpenStreetMap contributors"~~ — **no longer our copy.** With Mapbox, the map's built-in attribution control renders the required elements itself: the Mapbox logo (which may not be restyled) and the linked text "© Mapbox © OpenStreetMap Improve this map", bottom-right. It can't be hidden. We only adjust its colour and size to stay legible on the dark map. On a later MapLibre + Protomaps switch this goes back to "© OpenStreetMap contributors" (ODbL), also rendered by the map's attribution control.

## Decisions needed

All answered 2026-09-26 (see the top). Waiting on Brett's Mapbox tokens.
