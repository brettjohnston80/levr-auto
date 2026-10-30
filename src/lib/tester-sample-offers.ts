import "server-only";
import { createAdminClient } from "./supabase/admin";
import { isTestEmail } from "./test-accounts";
import { solidifySearch } from "./search-solidification";
import { logNotificationEvent } from "./notifications";
import { haversineMiles } from "./geo";
import { travelFromColumns } from "./pickup-travel";
import { deliveryEstimateStandard } from "./delivery-estimate";
import { vehicleColorImageUrl } from "./vehicle-color-images";

// Outside tester round (Brett, 2026-10-10). When a TEST account confirms its
// vehicle details, the search skips the 24-hour change window and goes live
// at once, and three sample offers are logged on it so the tester can try
// Your Deal without waiting for real outreach:
//   - the best value, within their pickup range;
//   - one beyond their range, with a delivery estimate, so that flow shows;
//   - a higher-priced one.
// Offer entry (Chunk 11, 2026-10-29): each one is written the way a sent offer is,
// so testers can try the new screens: interior, model year, good until, the
// customer's ranked options ticked on or off the car (plus an extra on the
// third), doc fee, sales tax and title lines, a removable add-on on the third,
// and an out-the-door total recorded as the dealer's quote (an estimate
// wouldn't let them accept). The figures are sample numbers, never a real quote.
// Locations are real dealer locations from synced listings (city/state/ZIP
// only, for distance and the map), but the dealer names are fictional
// ("Sample Motors of {city}") so no made-up price is attached to a real
// dealership. No listing is linked, so no real dealer's VIN or photos show.
//
// NEVER FOR REAL CUSTOMERS: gated on the signed-in user's auth email ending
// in TEST_EMAIL_SUFFIX (isTestEmail), checked here, not by the caller.
//
// TO TURN OFF when the round ends: set this to false and deploy.
export const TESTER_INSTANT_START_ENABLED = true;

/** Agent-only offer note marking these rows, for the round's cleanup. */
export const SAMPLE_OFFER_NOTE =
  "Sample offer (outside tester round) — not a real dealer quote.";

type Admin = ReturnType<typeof createAdminClient>;

interface Location {
  /** Null for a fallback ZIP (see zipsInBand): only listings carry a city. */
  city: string | null;
  state: string | null;
  zip: string;
  sameModel: boolean;
  sameMake: boolean;
  miles: number;
}

/**
 * Called right after a successful self-service finalize. Returns true when
 * the search was started now (the caller then shows the started copy), false
 * otherwise. Never throws: a failure here must not fail the customer's save.
 */
export async function startTesterSearchNow(
  searchId: string,
  authEmail: string | null,
): Promise<boolean> {
  if (!TESTER_INSTANT_START_ENABLED || !isTestEmail(authEmail)) return false;
  try {
    const started = await solidifySearch(searchId);
    if (!started) return false;
    await logSampleOffers(searchId);
    return true;
  } catch (e) {
    console.error(
      "[tester-sample-offers] failed",
      searchId,
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

async function logSampleOffers(searchId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: search } = await admin
    .from("customer_searches")
    .select(
      "id, make, model, model_year, trim, colors, zip, pickup_travel_choice, pickup_travel_miles, search_status",
    )
    .eq("id", searchId)
    .maybeSingle();
  if (
    !search ||
    search.search_status !== "searching" ||
    !search.make ||
    !search.model
  )
    return;

  // Once per search, even if this is somehow reached twice.
  const { count } = await admin
    .from("qualifying_offers")
    .select("id", { count: "exact", head: true })
    .eq("customer_search_id", searchId)
    .eq("notes", SAMPLE_OFFER_NOTE);
  if ((count ?? 0) > 0) return;

  const make = search.make as string;
  const model = search.model as string;
  const trim = (search.trim as string | null) || null;
  const msrpCents = await sampleMsrpCents(
    admin,
    make,
    model,
    (search.model_year as number | null) ?? null,
    trim,
  );
  if (!msrpCents) return;

  const travel = travelFromColumns(
    search.pickup_travel_choice as string | null,
    search.pickup_travel_miles as number | null,
  );
  const found = await nearbyLocations(
    admin,
    (search.zip as string | null) ?? null,
    make,
    model,
  );
  if (!found) return;
  const { home, locations } = found;

  const range = travel?.choice === "distance" ? travel.miles : 100;
  const within = locations
    .filter((l) => l.miles <= range)
    .sort(preferSameModelThenNearest);
  const beyond = locations
    .filter((l) => l.miles > range * 1.25 && l.miles <= range + 600)
    .sort((a, b) => a.miles - b.miles);
  const nearest = [...locations].sort((a, b) => a.miles - b.miles);

  // Synced listings cover only ~170 dealer ZIPs, so many customers have no
  // real dealer location inside their range. Then the in-range offers use a
  // real ZIP inside it (no city name), so "within range" still holds.
  const nearFallback =
    within.length > 0
      ? []
      : await zipsInBand(admin, home, range * 0.3, range * 0.7);
  const near = within[0] ?? nearFallback[0] ?? nearest[0];
  if (!near) return;
  const nearSecond =
    within.find((l) => l.city !== near.city || l.state !== near.state) ??
    nearFallback[1] ??
    near;
  const far =
    beyond[0] ??
    nearest.find((l) => l.miles > range) ??
    (await zipsInBand(admin, home, range * 1.5, range * 2.5))[0] ??
    near;

  const { data: picks } = await admin
    .from("search_option_selections")
    .select("id, category, selection, rank_position")
    .eq("search_id", searchId)
    .eq("excluded", false)
    .in("category", ["interior", "feature"])
    .order("rank_position");
  const interiors = (picks ?? []).filter((p) => p.category === "interior").map((p) => p.selection as string);
  const features = (picks ?? []).filter((p) => p.category === "feature").slice(0, 3);

  const colors = ((search.colors as string[] | null) ?? []).filter(Boolean);
  const withPhoto = colors.filter((c) =>
    vehicleColorImageUrl(make, model, "exterior_color", c),
  );
  const color1 = withPhoto[0] ?? colors[0] ?? null;
  const color2 = withPhoto[1] ?? colors[1] ?? color1;

  const offers = [
    {
      location: near,
      name: sampleName("Sample Motors", near),
      pct: 0.91,
      color: color1,
      interior: interiors[0] ?? null,
      optionsOn: features.length,
      extra: false,
      forceDelivery: false,
    },
    {
      location: far,
      name: sampleName("Sample Motors", far),
      pct: 0.935,
      color: color2,
      interior: interiors[1] ?? interiors[0] ?? null,
      optionsOn: Math.min(1, features.length),
      extra: false,
      forceDelivery: true,
    },
    {
      location: nearSecond,
      name: sampleName("Sample Auto Group", nearSecond),
      pct: 0.975,
      color: color1,
      interior: interiors[0] ?? null,
      optionsOn: features.length,
      extra: true,
      forceDelivery: false,
    },
  ];

  for (const o of offers) {
    const offerPriceCents = roundTo50Dollars(msrpCents * o.pct);
    const delivery =
      o.forceDelivery || deliveryEstimateStandard(travel, o.location.miles)
        ? {
            delivery_estimate_status: "provided",
            delivery_estimate_cents: deliveryFeeCents(o.location.miles),
            delivery_estimate_note: null,
            delivery_estimate_provided_at: new Date().toISOString(),
          }
        : {};
    const addons = o.extra ? [{ description: "Nitrogen-filled tires", amountCents: 14900 }] : [];
    const fees = [
      { kind: "doc_fee", cents: 39900 },
      { kind: "sales_tax", cents: Math.round((offerPriceCents * 0.07) / 100) * 100 },
      { kind: "title_registration", cents: 25000 },
    ];
    const otdTotalCents = offerPriceCents + addons.reduce((t, a) => t + a.amountCents, 0) + fees.reduce((t, f) => t + f.cents, 0);
    const now = new Date().toISOString();
    const { data: inserted, error } = await admin.from("qualifying_offers").insert({
      customer_search_id: searchId,
      listing_id: null,
      dealer_name: o.name,
      dealer_contact: null,
      offer_price_cents: offerPriceCents,
      msrp_cents: msrpCents,
      notes: SAMPLE_OFFER_NOTE,
      vehicle_trim: trim,
      vehicle_exterior_color: o.color,
      dealer_street: null,
      dealer_city: o.location.city,
      dealer_state: o.location.state,
      dealer_zip: o.location.zip,
      vin: null,
      stock_number: null,
      vehicle_interior_color: o.interior,
      vehicle_model_year: (search.model_year as number | null) ?? null,
      sent_to_customer_at: now,
      good_until: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
      trim_match_confirmed: true,
      addons_none_confirmed: addons.length === 0,
      other_fees_none_confirmed: true,
      otd_source: "dealer_quote",
      otd_total_cents: otdTotalCents,
      otd_recorded_at: now,
      ...delivery,
    }).select("id").single();
    if (!error && inserted) {
      const offerId = inserted.id as string;
      const writes = await Promise.all([
        admin.from("offer_fees").insert(fees.map((f) => ({ qualifying_offer_id: offerId, fee_kind: f.kind, fee_amount_cents: f.cents }))),
        addons.length
          ? admin.from("offer_addons").insert(addons.map((a) => ({
              qualifying_offer_id: offerId, description: a.description, amount_cents: a.amountCents,
              addon_customer_wanted: false, addon_dealer_says_removable: true,
            })))
          : Promise.resolve({ error: null }),
        (() => {
          // Every row carries the same keys (a mixed-shape insert sends null for missing ones).
          const rows = [
            ...features.map((f, i) => ({
              qualifying_offer_id: offerId, vehicle_option_name: f.selection as string, search_option_selection_id: f.id as string,
              customer_asked_for: true, on_the_car: i < o.optionsOn, sticker_price_cents: null, install_kind: null,
            })),
            ...(o.extra
              ? [{ qualifying_offer_id: offerId, vehicle_option_name: "All-weather floor mats", search_option_selection_id: null,
                   customer_asked_for: false, on_the_car: true, sticker_price_cents: 15000, install_kind: "port" }]
              : []),
          ];
          return rows.length ? admin.from("offer_vehicle_options").insert(rows) : Promise.resolve({ error: null });
        })(),
      ]);
      const failed = writes.find((w) => w.error);
      if (failed?.error) console.error("[tester-sample-offers] detail insert failed", searchId, failed.error.message);
    }
    if (error) {
      console.error(
        "[tester-sample-offers] insert failed",
        searchId,
        error.message,
      );
      return;
    }
    // Same event the agent's Log offer writes (emails to test addresses are
    // suppressed in sendEmail; the event still feeds the daily update view).
    await logNotificationEvent({
      customerSearchId: searchId,
      eventType: "offer_logged",
      eventData: { dealerName: o.name, offerPriceCents, msrpCents, sentFlow: true, otdTotalCents, otdSource: "dealer_quote" },
    });
  }
}

function sampleName(prefix: string, loc: Location): string {
  return loc.city ? `${prefix} of ${loc.city}` : `${prefix} Nearby`;
}

/**
 * Real ZIPs (zip_coordinates) between `minMiles` and `maxMiles` of home,
 * closest to the middle of the band first. Used only when no synced dealer
 * location fits.
 */
async function zipsInBand(
  admin: Admin,
  home: { lat: number; lon: number },
  minMiles: number,
  maxMiles: number,
): Promise<Location[]> {
  const dLat = maxMiles / 69;
  const dLon =
    maxMiles / (69 * Math.max(0.2, Math.cos((home.lat * Math.PI) / 180)));
  const { data } = await admin
    .from("zip_coordinates")
    .select("zip, latitude, longitude")
    .gte("latitude", home.lat - dLat)
    .lte("latitude", home.lat + dLat)
    .gte("longitude", home.lon - dLon)
    .lte("longitude", home.lon + dLon)
    .limit(1000);
  const mid = (minMiles + maxMiles) / 2;
  return (data ?? [])
    .map((c) => ({
      city: null,
      state: null,
      zip: c.zip as string,
      sameModel: false,
      sameMake: false,
      miles: haversineMiles(
        home.lat,
        home.lon,
        c.latitude as number,
        c.longitude as number,
      ),
    }))
    .filter((l) => l.miles >= minMiles && l.miles <= maxMiles)
    .sort((a, b) => Math.abs(a.miles - mid) - Math.abs(b.miles - mid))
    .slice(0, 2);
}

function preferSameModelThenNearest(a: Location, b: Location): number {
  if (a.sameModel !== b.sameModel) return a.sameModel ? -1 : 1;
  if (a.sameMake !== b.sameMake) return a.sameMake ? -1 : 1;
  return a.miles - b.miles;
}

function roundTo50Dollars(cents: number): number {
  return Math.round(cents / 5000) * 5000;
}

/** About $1.10 a mile, $350–$1,500, rounded to $25. */
function deliveryFeeCents(miles: number): number {
  const dollars = Math.min(1500, Math.max(350, miles * 1.1));
  return Math.round(dollars / 25) * 25 * 100;
}

/**
 * Total SRP for the sample offers: the live Matchmaker dataset's starting
 * price (MSRP + destination) for this trim and year, else the model's median
 * for the year, else any year.
 */
async function sampleMsrpCents(
  admin: Admin,
  make: string,
  model: string,
  modelYear: number | null,
  trim: string | null,
): Promise<number | null> {
  const { data: batch } = await admin
    .from("vehicle_dataset_batches")
    .select("id")
    .eq("is_live", true)
    .maybeSingle();
  if (!batch) return null;
  const { data } = await admin
    .from("vehicles")
    .select("trim, model_year, msrp_cents, true_starting_price_cents")
    .eq("dataset_batch_id", batch.id)
    .eq("make", make)
    .eq("model", model);
  const rows = (data ?? [])
    .map((r) => ({
      trim: (r.trim as string | null) ?? "",
      year: r.model_year as number | null,
      cents:
        ((r.true_starting_price_cents as number | null) ??
          (r.msrp_cents as number | null)) ||
        null,
    }))
    .filter((r) => r.cents);
  const sameYear = modelYear ? rows.filter((r) => r.year === modelYear) : rows;
  const pool = sameYear.length > 0 ? sameYear : rows;
  const exact = trim
    ? pool.find((r) => r.trim.toLowerCase() === trim.toLowerCase())
    : undefined;
  if (exact) return exact.cents;
  const sorted = pool.map((r) => r.cents as number).sort((a, b) => a - b);
  return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;
}

/**
 * Distinct real dealer locations from synced listings, with miles from the
 * customer's ZIP. Null when the customer's ZIP has no coordinates.
 */
async function nearbyLocations(
  admin: Admin,
  customerZip: string | null,
  make: string,
  model: string,
): Promise<{
  home: { lat: number; lon: number };
  locations: Location[];
} | null> {
  if (!customerZip) return null;
  const byZip = new Map<
    string,
    {
      city: string;
      state: string;
      zip: string;
      sameModel: boolean;
      sameMake: boolean;
    }
  >();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("listings")
      .select("make, model, dealer_city, dealer_state, dealer_zip")
      .not("dealer_zip", "is", null)
      .not("dealer_city", "is", null)
      .order("vin")
      .range(from, from + 999);
    if (error || !data) break;
    for (const l of data) {
      const zip = l.dealer_zip as string;
      if (!/^[0-9]{5}$/.test(zip)) continue;
      const sameMake = l.make === make;
      const sameModel = sameMake && l.model === model;
      const prev = byZip.get(zip);
      if (
        !prev ||
        (sameModel && !prev.sameModel) ||
        (sameMake && !prev.sameMake)
      ) {
        byZip.set(zip, {
          city: titleCase(l.dealer_city as string),
          state: ((l.dealer_state as string | null) ?? "").toUpperCase(),
          zip,
          sameModel,
          sameMake,
        });
      }
    }
    if (data.length < 1000) break;
  }

  const zips = [customerZip, ...byZip.keys()];
  const coords = new Map<string, { lat: number; lon: number }>();
  for (let i = 0; i < zips.length; i += 200) {
    const { data } = await admin
      .from("zip_coordinates")
      .select("zip, latitude, longitude")
      .in("zip", zips.slice(i, i + 200));
    for (const c of data ?? [])
      coords.set(c.zip as string, {
        lat: c.latitude as number,
        lon: c.longitude as number,
      });
  }
  const home = coords.get(customerZip);
  if (!home) return null;

  const out: Location[] = [];
  for (const loc of byZip.values()) {
    const c = coords.get(loc.zip);
    if (!c || loc.zip === customerZip) continue;
    out.push({
      ...loc,
      miles: haversineMiles(home.lat, home.lon, c.lat, c.lon),
    });
  }
  return { home, locations: out };
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}
