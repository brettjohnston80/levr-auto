import "server-only";
import { createAdminClient } from "./supabase/admin";

export interface OutreachDealer {
  name: string;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  listingCount: number;
}

export interface OutreachListing {
  id: string;
  vin: string;
  trim: string | null;
  year: number | null;
  color: string | null;
  priceCents: number | null;
  msrpCents: number | null;
  dealerName: string | null;
  dealerPhone: string | null;
}

export interface OutreachOffer {
  id: string;
  dealerName: string;
  offerPriceCents: number;
  msrpCents: number;
  isBelowMsrp: boolean;
  status: string;
  receivedAt: string;
}

export interface OutreachSearch {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  colors: string[];
  zip: string | null;
  customerEmail: string | null;
  dealers: OutreachDealer[];
  listings: OutreachListing[];
  offers: OutreachOffer[];
}

/**
 * Everything a human agent needs to work outreach for currently-active
 * searches: who's asking, which dealers have matching new inventory (from
 * `listings`, exact make/model match only — no zip/radius filtering), and
 * what's already been logged in `qualifying_offers` so nothing gets
 * duplicated.
 */
export async function getOutreachQueue(): Promise<OutreachSearch[]> {
  const supabase = createAdminClient();

  const { data: searches, error: searchesError } = await supabase
    .from("customer_searches")
    .select("id, make, model, trim, colors, zip, customer_id")
    .eq("search_status", "searching")
    .order("created_at", { ascending: true });

  if (searchesError) {
    throw new Error(`Failed to load outreach queue: ${searchesError.message}`);
  }

  if (!searches || searches.length === 0) {
    return [];
  }

  const customerIds = [...new Set(searches.map((s) => s.customer_id))];
  const searchIds = searches.map((s) => s.id);
  const distinctMakeModels = [
    ...new Map(searches.map((s) => [`${s.make}::${s.model}`, { make: s.make, model: s.model }])).values(),
  ];

  const [{ data: customers }, listingsByPair, { data: offers, error: offersError }] = await Promise.all([
    supabase.from("customers").select("id, email").in("id", customerIds),
    Promise.all(
      distinctMakeModels.map(async ({ make, model }) => {
        const { data } = await supabase
          .from("listings")
          .select(
            "id, vin, trim, year, color, price_cents, msrp_cents, dealer_name, dealer_phone, dealer_website, dealer_city, dealer_state"
          )
          .eq("make", make)
          .eq("model", model);
        return { make, model, listings: data ?? [] };
      })
    ),
    supabase
      .from("qualifying_offers")
      .select("id, customer_search_id, dealer_name, offer_price_cents, msrp_cents, is_below_msrp, status, received_at")
      .in("customer_search_id", searchIds),
  ]);

  if (offersError) {
    throw new Error(`Failed to load qualifying offers: ${offersError.message}`);
  }

  const customerEmailById = new Map((customers ?? []).map((c) => [c.id, c.email as string]));
  const listingsByMakeModel = new Map(
    listingsByPair.map(({ make, model, listings }) => [`${make}::${model}`, listings])
  );
  const offersBySearchId = new Map<string, OutreachOffer[]>();
  for (const offer of offers ?? []) {
    const list = offersBySearchId.get(offer.customer_search_id) ?? [];
    list.push({
      id: offer.id,
      dealerName: offer.dealer_name,
      offerPriceCents: offer.offer_price_cents,
      msrpCents: offer.msrp_cents,
      isBelowMsrp: offer.is_below_msrp,
      status: offer.status,
      receivedAt: offer.received_at,
    });
    offersBySearchId.set(offer.customer_search_id, list);
  }

  return searches.map((search) => {
    const rawListings = listingsByMakeModel.get(`${search.make}::${search.model}`) ?? [];

    const dealerMap = new Map<string, OutreachDealer>();
    for (const listing of rawListings) {
      if (!listing.dealer_name) continue;
      const existing = dealerMap.get(listing.dealer_name);
      if (existing) {
        existing.listingCount += 1;
      } else {
        dealerMap.set(listing.dealer_name, {
          name: listing.dealer_name,
          phone: listing.dealer_phone,
          website: listing.dealer_website,
          city: listing.dealer_city,
          state: listing.dealer_state,
          listingCount: 1,
        });
      }
    }
    const dealers = [...dealerMap.values()].sort((a, b) => b.listingCount - a.listingCount);

    return {
      id: search.id,
      make: search.make,
      model: search.model,
      trim: search.trim,
      colors: search.colors,
      zip: search.zip,
      customerEmail: customerEmailById.get(search.customer_id) ?? null,
      dealers,
      listings: rawListings.map((l) => ({
        id: l.id,
        vin: l.vin,
        trim: l.trim,
        year: l.year,
        color: l.color,
        priceCents: l.price_cents,
        msrpCents: l.msrp_cents,
        dealerName: l.dealer_name,
        dealerPhone: l.dealer_phone,
      })),
      offers: offersBySearchId.get(search.id) ?? [],
    };
  });
}
