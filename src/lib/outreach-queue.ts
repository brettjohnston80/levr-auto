import "server-only";
import { createAdminClient } from "./supabase/admin";
import { buildTrimOptions, type TrimOption } from "./finalize-trims";

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

export interface OutreachAddon {
  id: string;
  description: string;
  amountCents: number;
  removalStatus: string;
  removalRequestedAt: string | null;
  dealerResponse: string | null;
}

export interface OutreachDealProgress {
  availabilityReconfirmedAt: string | null;
  depositAmountCents: number | null;
  depositConfirmedAt: string | null;
  financingChoice: string | null;
  financingIncomeRange: string | null;
  financingDownPaymentCents: number | null;
  financingDesiredTermMonths: number | null;
  financingProofUrl: string | null;
}

export interface OutreachOffer {
  id: string;
  dealerName: string;
  offerPriceCents: number;
  msrpCents: number;
  isBelowMsrp: boolean;
  status: string;
  receivedAt: string;
  deliveredAt: string | null;
  customerRespondedAt: string | null;
  vehicleSoldAt: string | null;
  addons: OutreachAddon[];
  dealProgress: OutreachDealProgress | null;
  serviceAgreementSignedAt: string | null;
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
      .select(
        "id, customer_search_id, dealer_name, offer_price_cents, msrp_cents, is_below_msrp, status, received_at, delivered_at, customer_responded_at, vehicle_sold_at"
      )
      .in("customer_search_id", searchIds),
  ]);

  if (offersError) {
    throw new Error(`Failed to load qualifying offers: ${offersError.message}`);
  }

  const offerIds = (offers ?? []).map((o) => o.id);
  const addonsByOfferId = new Map<string, OutreachAddon[]>();

  if (offerIds.length > 0) {
    const { data: addons, error: addonsError } = await supabase
      .from("offer_addons")
      .select(
        "id, qualifying_offer_id, description, amount_cents, removal_status, removal_requested_at, dealer_response"
      )
      .in("qualifying_offer_id", offerIds);

    if (addonsError) {
      throw new Error(`Failed to load offer add-ons: ${addonsError.message}`);
    }

    for (const addon of addons ?? []) {
      const list = addonsByOfferId.get(addon.qualifying_offer_id) ?? [];
      list.push({
        id: addon.id,
        description: addon.description,
        amountCents: addon.amount_cents,
        removalStatus: addon.removal_status,
        removalRequestedAt: addon.removal_requested_at,
        dealerResponse: addon.dealer_response,
      });
      addonsByOfferId.set(addon.qualifying_offer_id, list);
    }
  }

  const dealProgressByOfferId = new Map<string, OutreachDealProgress>();
  const serviceAgreementSignedAtByOfferId = new Map<string, string>();

  if (offerIds.length > 0) {
    const [{ data: progressRows, error: progressError }, { data: docs, error: docsError }] =
      await Promise.all([
        supabase
          .from("deal_progress")
          .select(
            "qualifying_offer_id, availability_reconfirmed_at, deposit_amount_cents, deposit_confirmed_at, financing_choice, financing_income_range, financing_down_payment_cents, financing_desired_term_months"
          )
          .in("qualifying_offer_id", offerIds),
        supabase
          .from("documents")
          .select("qualifying_offer_id, type, storage_path, uploaded_at, signed_at")
          .in("type", ["financing_proof", "service_agreement"])
          .in("qualifying_offer_id", offerIds)
          .order("uploaded_at", { ascending: false }),
      ]);

    if (progressError) {
      throw new Error(`Failed to load deal progress: ${progressError.message}`);
    }
    if (docsError) {
      throw new Error(`Failed to load documents: ${docsError.message}`);
    }

    // Most recent upload per offer, if the customer resubmitted more than once.
    const latestFinancingProofByOfferId = new Map<string, string>();
    for (const doc of docs ?? []) {
      if (
        doc.type === "financing_proof" &&
        doc.storage_path &&
        !latestFinancingProofByOfferId.has(doc.qualifying_offer_id)
      ) {
        latestFinancingProofByOfferId.set(doc.qualifying_offer_id, doc.storage_path);
      }
      if (doc.type === "service_agreement" && doc.signed_at) {
        serviceAgreementSignedAtByOfferId.set(doc.qualifying_offer_id, doc.signed_at);
      }
    }

    const signedUrlByOfferId = new Map<string, string>();
    await Promise.all(
      [...latestFinancingProofByOfferId.entries()].map(async ([offerId, path]) => {
        const { data } = await supabase.storage.from("documents").createSignedUrl(path, 900);
        if (data?.signedUrl) {
          signedUrlByOfferId.set(offerId, data.signedUrl);
        }
      })
    );

    for (const row of progressRows ?? []) {
      dealProgressByOfferId.set(row.qualifying_offer_id, {
        availabilityReconfirmedAt: row.availability_reconfirmed_at,
        depositAmountCents: row.deposit_amount_cents,
        depositConfirmedAt: row.deposit_confirmed_at,
        financingChoice: row.financing_choice,
        financingIncomeRange: row.financing_income_range,
        financingDownPaymentCents: row.financing_down_payment_cents,
        financingDesiredTermMonths: row.financing_desired_term_months,
        financingProofUrl: signedUrlByOfferId.get(row.qualifying_offer_id) ?? null,
      });
    }
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
      deliveredAt: offer.delivered_at,
      customerRespondedAt: offer.customer_responded_at,
      vehicleSoldAt: offer.vehicle_sold_at,
      addons: addonsByOfferId.get(offer.id) ?? [],
      dealProgress: dealProgressByOfferId.get(offer.id) ?? null,
      serviceAgreementSignedAt: serviceAgreementSignedAtByOfferId.get(offer.id) ?? null,
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

export interface FinalizationQueueSearch {
  id: string;
  make: string;
  model: string;
  customerEmail: string | null;
  callRequestedAt: string;
  trimOptions: TrimOption[];
}

/**
 * Searches where the customer chose "Schedule a call" on /finalize instead
 * of self-service (finalize-actions.ts requestFinalizationCall). Manual
 * outreach only, deliberately -- there's no calendar/scheduling integration
 * yet (roadmap note: "manual for now, later build into a calendar app"), so
 * this queue is how an agent knows who to call and, once the call happens,
 * finalizeSearchByAgent (outreach-actions.ts) is how they record the result.
 */
export async function getFinalizationQueue(): Promise<FinalizationQueueSearch[]> {
  const supabase = createAdminClient();

  const { data: searches, error: searchesError } = await supabase
    .from("customer_searches")
    .select("id, make, model, customer_id, call_requested_at")
    .eq("search_status", "awaiting_finalization")
    .not("call_requested_at", "is", null)
    .order("call_requested_at", { ascending: true });

  if (searchesError) {
    throw new Error(`Failed to load finalization queue: ${searchesError.message}`);
  }

  if (!searches || searches.length === 0) {
    return [];
  }

  const customerIds = [...new Set(searches.map((s) => s.customer_id))];
  const distinctMakeModels = [
    ...new Map(searches.map((s) => [`${s.make}::${s.model}`, { make: s.make, model: s.model }])).values(),
  ];

  const [{ data: customers }, listingsByPair] = await Promise.all([
    supabase.from("customers").select("id, email").in("id", customerIds),
    Promise.all(
      distinctMakeModels.map(async ({ make, model }) => {
        const { data } = await supabase
          .from("listings")
          .select("trim, price_cents")
          .eq("make", make)
          .eq("model", model)
          .not("trim", "is", null);
        return { make, model, listings: data ?? [] };
      })
    ),
  ]);

  const customerEmailById = new Map((customers ?? []).map((c) => [c.id, c.email as string]));
  const trimOptionsByMakeModel = new Map(
    listingsByPair.map(({ make, model, listings }) => [`${make}::${model}`, buildTrimOptions(listings)])
  );

  return searches.map((search) => ({
    id: search.id,
    make: search.make,
    model: search.model,
    customerEmail: customerEmailById.get(search.customer_id) ?? null,
    callRequestedAt: search.call_requested_at as string,
    trimOptions: trimOptionsByMakeModel.get(`${search.make}::${search.model}`) ?? [],
  }));
}

export interface SwitchCallQueueSearch {
  id: string;
  make: string;
  model: string;
  customerEmail: string | null;
  switchCallRequestedAt: string;
}

/**
 * Searches where the customer chose "have an agent handle it" on the
 * self-service switch flow (switch-self-service-actions.ts,
 * requestSwitchCall) instead of picking a new make/model themselves.
 * Manual outreach only, same as the finalization-call queue above -- an
 * agent works this list and performs the actual switch via
 * AgentSwitchSearchForm (switch-actions.ts), the same form already used
 * for agent-initiated switches with no prior request.
 *
 * Unlike the finalization queue, this isn't scoped to one search_status --
 * a switch request can come in from any live, paid search (awaiting
 * finalization, mid-refinement-window, or already searching). Excludes
 * search_status = 'switched' so a request naturally drops off the list
 * once an agent has already acted on it.
 */
export async function getSwitchCallQueue(): Promise<SwitchCallQueueSearch[]> {
  const supabase = createAdminClient();

  const { data: searches, error: searchesError } = await supabase
    .from("customer_searches")
    .select("id, make, model, customer_id, switch_call_requested_at")
    .not("switch_call_requested_at", "is", null)
    .neq("search_status", "switched")
    .order("switch_call_requested_at", { ascending: true });

  if (searchesError) {
    throw new Error(`Failed to load switch call queue: ${searchesError.message}`);
  }

  if (!searches || searches.length === 0) {
    return [];
  }

  const customerIds = [...new Set(searches.map((s) => s.customer_id))];
  const { data: customers } = await supabase.from("customers").select("id, email").in("id", customerIds);
  const customerEmailById = new Map((customers ?? []).map((c) => [c.id, c.email as string]));

  return searches.map((search) => ({
    id: search.id,
    make: search.make,
    model: search.model,
    customerEmail: customerEmailById.get(search.customer_id) ?? null,
    switchCallRequestedAt: search.switch_call_requested_at as string,
  }));
}

const OVERDUE_FOLLOW_UP_HOURS = 48;

export interface OverdueFollowUpSearch {
  id: string;
  make: string;
  model: string;
  customerEmail: string | null;
  paidAt: string;
}

/**
 * Paid searches nobody has acted on -- no self-service finalization, no
 * call requested -- 48+ hours after payment. Single clock anchored to
 * paid_at, covers both original signups and switches (both set paid_at,
 * see the switch_fee_flow migration's p_paid_at param). Manual outreach
 * only, same as the finalization/switch-call queues above.
 *
 * Filters on search_status = 'awaiting_finalization' as an allow-list
 * (not a switched/paused/closed block-list) -- search_status's CHECK
 * constraint allows 6 values, but only 4 are ever actually written
 * anywhere in this codebase (confirmed by grep, not inferred); paused/
 * closed are legal but written by nobody today, reserved for not-yet-built
 * admin views. An allow-list fails closed (excludes) rather than open
 * (includes) if a 7th value is ever introduced without this query being
 * revisited -- deliberately more defensive than mirroring the other
 * queues' block-list style.
 */
export async function getOverdueFollowUpQueue(): Promise<OverdueFollowUpSearch[]> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - OVERDUE_FOLLOW_UP_HOURS * 60 * 60 * 1000).toISOString();

  const { data: searches, error: searchesError } = await supabase
    .from("customer_searches")
    .select("id, make, model, customer_id, paid_at")
    .eq("search_status", "awaiting_finalization")
    .not("paid_at", "is", null)
    .lte("paid_at", cutoff)
    .is("finalized_at", null)
    .is("call_requested_at", null)
    .order("paid_at", { ascending: true });

  if (searchesError) {
    throw new Error(`Failed to load overdue follow-up queue: ${searchesError.message}`);
  }

  if (!searches || searches.length === 0) {
    return [];
  }

  const customerIds = [...new Set(searches.map((s) => s.customer_id))];
  const { data: customers } = await supabase.from("customers").select("id, email").in("id", customerIds);
  const customerEmailById = new Map((customers ?? []).map((c) => [c.id, c.email as string]));

  return searches.map((search) => ({
    id: search.id,
    make: search.make,
    model: search.model,
    customerEmail: customerEmailById.get(search.customer_id) ?? null,
    paidAt: search.paid_at as string,
  }));
}
