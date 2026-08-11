import "server-only";
import { createAdminClient } from "./supabase/admin";

export interface DashboardOffer {
  id: string;
  dealerName: string;
  offerPriceCents: number;
  msrpCents: number;
  isBelowMsrp: boolean;
  status: string;
  receivedAt: string;
  deliveredAt: string;
}

export interface DashboardSearch {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  colors: string[];
  searchStatus: string;
  guaranteeStatus: string;
  paidAt: string | null;
  offers: DashboardOffer[];
}

/**
 * Loads a customer's searches and offers, and — per the guarantee rule —
 * marks any not-yet-delivered offer as delivered the moment it's shown here.
 * `delivered_at` is the 24h response-window clock start, not raw dealer
 * receipt (see the comment on qualifying_offers in the schema). The
 * WHERE delivered_at IS NULL guard makes this idempotent: revisiting the
 * page, or a concurrent load, never re-fires or double-sets it.
 */
export async function getCustomerDashboard(customerId: string): Promise<DashboardSearch[]> {
  const supabase = createAdminClient();

  const { data: searches, error: searchesError } = await supabase
    .from("customer_searches")
    .select("id, make, model, trim, colors, search_status, guarantee_status, paid_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });

  if (searchesError) {
    throw new Error(`Failed to load customer searches: ${searchesError.message}`);
  }

  if (!searches || searches.length === 0) {
    return [];
  }

  const searchIds = searches.map((s) => s.id);

  const { data: offers, error: offersError } = await supabase
    .from("qualifying_offers")
    .select(
      "id, customer_search_id, dealer_name, offer_price_cents, msrp_cents, is_below_msrp, status, received_at, delivered_at"
    )
    .in("customer_search_id", searchIds)
    .order("received_at", { ascending: false });

  if (offersError) {
    throw new Error(`Failed to load qualifying offers: ${offersError.message}`);
  }

  const undelivered = (offers ?? []).filter((o) => !o.delivered_at).map((o) => o.id);
  let deliveredAtNow: string | null = null;

  if (undelivered.length > 0) {
    deliveredAtNow = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("qualifying_offers")
      .update({ delivered_at: deliveredAtNow })
      .in("id", undelivered)
      .is("delivered_at", null);

    if (updateError) {
      throw new Error(`Failed to mark offers delivered: ${updateError.message}`);
    }
  }

  const offersBySearchId = new Map<string, DashboardOffer[]>();
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
      deliveredAt: offer.delivered_at ?? deliveredAtNow!,
    });
    offersBySearchId.set(offer.customer_search_id, list);
  }

  return searches.map((search) => ({
    id: search.id,
    make: search.make,
    model: search.model,
    trim: search.trim,
    colors: search.colors,
    searchStatus: search.search_status,
    guaranteeStatus: search.guarantee_status,
    paidAt: search.paid_at,
    offers: offersBySearchId.get(search.id) ?? [],
  }));
}
