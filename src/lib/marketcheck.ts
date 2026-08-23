import "server-only";

const SEARCH_URL = "https://mc-api.marketcheck.com/v2/search/car/active";

export interface MarketCheckListing {
  vin: string;
  price: number | null;
  msrp: number | null;
  exterior_color?: string | null;
  dealer?: {
    name?: string;
    phone?: string;
    website?: string;
    city?: string;
    state?: string;
    zip?: string;
    dealer_type?: string;
  };
  // NOT the same as dealer.id (which is actually MarketCheck's
  // mc_website_id) -- mc_dealership.mc_dealer_id is MarketCheck's real,
  // stable dealer identifier, confirmed directly against the live API.
  // See the dealer_mc_ids migration's header comment for the full story.
  mc_dealership?: {
    mc_dealer_id?: number;
  };
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
  };
  [key: string]: unknown;
}

interface MarketCheckSearchResponse {
  num_found: number;
  listings: MarketCheckListing[];
}

/**
 * Testing showed MarketCheck defaults to mostly used inventory without an
 * explicit car_type=new filter — this is always passed, never left to the
 * API's default.
 */
export async function searchActiveListings(params: {
  make: string;
  model: string;
  rows?: number;
  start?: number;
}): Promise<MarketCheckSearchResponse> {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) {
    throw new Error("MARKETCHECK_API_KEY is not set");
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("car_type", "new");
  url.searchParams.set("make", params.make);
  url.searchParams.set("model", params.model);
  url.searchParams.set("country", "US");
  url.searchParams.set("rows", String(params.rows ?? 50));
  url.searchParams.set("start", String(params.start ?? 0));
  // Explicit, not relied on as a default -- same "never trust an
  // undocumented API default" precedent as car_type=new above. Testing
  // showed dealer/mc_dealership are present in the response either way in
  // the current API version, but this future-proofs against that changing.
  url.searchParams.set("include_dealer_object", "true");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MarketCheck search failed (${res.status}): ${body}`);
  }

  return res.json();
}
