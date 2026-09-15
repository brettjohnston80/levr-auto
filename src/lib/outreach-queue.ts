import "server-only";
import { createAdminClient } from "./supabase/admin";
import { buildTrimOptions, filterListingsToCommittedYear, type TrimOption } from "./finalize-trims";
import { RESUME_WINDOW_DAYS } from "./vehicle-data";
import { isTestEmail } from "./test-accounts";

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

/**
 * One configurator answer, as an agent needs to read it (step 8 of 9).
 *
 * Read-only surfacing of search_option_selections. The package fields are
 * the reason the table exists: "customer wants a heated steering wheel" is
 * unactionable when that feature is only obtainable inside a $610 package
 * that also carries two other things, and an agent working real inventory
 * needs the name, the contents and the price to search or negotiate
 * correctly.
 */
export interface OutreachSelection {
  id: string;
  category: string;
  questionKind: "ranked" | "feature";
  selection: string;
  /** 1-based position in the ranked list; null when excluded. */
  rankPosition: number | null;
  /**
   * The customer explicitly refused this option. NOT the same as an option
   * they simply did not rank: an exclusion is an instruction ("never offer
   * this"), while an unranked option is merely unremarkable. The agent view
   * must keep the two visibly apart.
   */
  excluded: boolean;
  packageName: string | null;
  packagePriceCents: number | null;
  packageContents: string[] | null;
  /** Price could not be parsed. Must never render as a blank or as $0. */
  priceUnknown: boolean;
}

/**
 * A ranked trim preference (search_trim_preferences).
 *
 * Separate from OutreachSelection because a trim is identified by trim AND
 * model year, and because it is not a configurator_options row. For the
 * agent this list is a SEARCH ORDER: work down it until something is
 * actually in inventory.
 */
export interface OutreachTrimPreference {
  id: string;
  trim: string;
  modelYear: number | null;
  rankPosition: number | null;
  excluded: boolean;
  /**
   * Non-null when this trim resolved to exactly one researched configurator
   * build. Null is the common case -- 34 of 36 makes have no configurator
   * data at all. Surfaced because it tells the agent whether the colour and
   * feature answers below actually describe this trim.
   */
  configuratorTrimId: string | null;
}

/** Reading order: what the car looks like, then what is added to it. */
const SELECTION_CATEGORY_ORDER = [
  "exterior_color",
  "interior",
  "seating",
  "wheels",
  "roof",
  "drivetrain",
  "feature",
];

/**
 * Category first, then rank order within it, with excluded items last.
 *
 * Excluded rows sort to the end of their category rather than being
 * interleaved, because the renderer groups them into their own block --
 * sorting them together here keeps that grouping stable without a second
 * pass.
 */
function compareSelections(a: OutreachSelection, b: OutreachSelection): number {
  const cat =
    SELECTION_CATEGORY_ORDER.indexOf(a.category) - SELECTION_CATEGORY_ORDER.indexOf(b.category);
  if (cat !== 0) return cat;
  if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
  if (a.rankPosition != null && b.rankPosition != null) {
    return a.rankPosition - b.rankPosition;
  }
  return a.selection.localeCompare(b.selection);
}

/** Ranked first in order, then exclusions. */
function compareTrimPreferences(a: OutreachTrimPreference, b: OutreachTrimPreference): number {
  if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
  if (a.rankPosition != null && b.rankPosition != null) {
    return a.rankPosition - b.rankPosition;
  }
  return a.trim.localeCompare(b.trim);
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
  deliveryMethod: string | null;
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
  /** Tester-program row -- flagged, never hidden. See isTest note below. */
  isTest: boolean;
  dealers: OutreachDealer[];
  listings: OutreachListing[];
  offers: OutreachOffer[];
  /**
   * Empty for every search finalized through the generic colour/options
   * flow -- which is all 34 makes without configurator data, and every
   * search predating step 7. `colors`/`trim` above stay the authoritative
   * fields in that case.
   */
  selections: OutreachSelection[];
  /**
   * Empty until the customer ranks trims. A single-trim search (today's
   * behaviour) produces one rank-1 row, not zero.
   */
  trimPreferences: OutreachTrimPreference[];
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
            "qualifying_offer_id, availability_reconfirmed_at, deposit_amount_cents, deposit_confirmed_at, financing_choice, financing_income_range, financing_down_payment_cents, financing_desired_term_months, delivery_method"
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
        deliveryMethod: row.delivery_method,
      });
    }
  }

  // Configurator answers for every search in the queue.
  //
  // PAGINATED. PostgREST caps a plain select at 1,000 rows and truncates
  // silently -- one search can carry several answers, so a busy queue
  // reaches that cap without erroring, and the failure mode is an agent
  // negotiating against a preference list that is quietly missing rows.
  const SELECTION_PAGE_SIZE = 1000;
  const selectionsBySearchId = new Map<string, OutreachSelection[]>();
  for (let from = 0; ; from += SELECTION_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("search_option_selections")
      .select(
        "id, search_id, category, question_kind, selection, rank_position, excluded, package_name, package_price_cents, package_contents, price_unknown",
      )
      .in("search_id", searchIds)
      .order("id")
      .range(from, from + SELECTION_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed to load configurator selections: ${error.message}`);
    }
    for (const row of data ?? []) {
      const list = selectionsBySearchId.get(row.search_id as string) ?? [];
      list.push({
        id: row.id as string,
        category: row.category as string,
        questionKind: row.question_kind as "ranked" | "feature",
        selection: row.selection as string,
        rankPosition: (row.rank_position as number | null) ?? null,
        excluded: row.excluded === true,
        packageName: (row.package_name as string | null) ?? null,
        packagePriceCents: (row.package_price_cents as number | null) ?? null,
        packageContents: (row.package_contents as string[] | null) ?? null,
        priceUnknown: row.price_unknown === true,
      });
      selectionsBySearchId.set(row.search_id as string, list);
    }
    if (!data || data.length < SELECTION_PAGE_SIZE) break;
  }
  for (const list of selectionsBySearchId.values()) {
    list.sort(compareSelections);
  }

  // Ranked trim preferences. Paginated for the same reason as above: a busy
  // queue can exceed PostgREST's silent 1,000-row cap, and a truncated
  // search order would send an agent down a list that is quietly missing
  // entries.
  const trimPrefsBySearchId = new Map<string, OutreachTrimPreference[]>();
  for (let from = 0; ; from += SELECTION_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("search_trim_preferences")
      .select("id, search_id, trim, model_year, rank_position, excluded, configurator_trim_id")
      .in("search_id", searchIds)
      .order("id")
      .range(from, from + SELECTION_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed to load trim preferences: ${error.message}`);
    }
    for (const row of data ?? []) {
      const list = trimPrefsBySearchId.get(row.search_id as string) ?? [];
      list.push({
        id: row.id as string,
        trim: row.trim as string,
        modelYear: (row.model_year as number | null) ?? null,
        rankPosition: (row.rank_position as number | null) ?? null,
        excluded: row.excluded === true,
        configuratorTrimId: (row.configurator_trim_id as string | null) ?? null,
      });
      trimPrefsBySearchId.set(row.search_id as string, list);
    }
    if (!data || data.length < SELECTION_PAGE_SIZE) break;
  }
  for (const list of trimPrefsBySearchId.values()) {
    list.sort(compareTrimPreferences);
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
      isTest: isTestEmail(customerEmailById.get(search.customer_id) ?? null),
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
      selections: selectionsBySearchId.get(search.id) ?? [],
      trimPreferences: trimPrefsBySearchId.get(search.id) ?? [],
    };
  });
}

export interface FinalizationQueueSearch {
  id: string;
  make: string;
  model: string;
  customerEmail: string | null;
  /** Tester-program row -- flagged, never hidden. See isTest note below. */
  isTest: boolean;
  callRequestedAt: string;
  /** Committed model year; trimOptions are already filtered to it when set. */
  modelYear: number | null;
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
    .select("id, make, model, model_year, customer_id, call_requested_at")
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
          .select("trim, price_cents, year")
          .eq("make", make)
          .eq("model", model)
          .not("trim", "is", null);
        return { make, model, listings: data ?? [] };
      })
    ),
  ]);

  const customerEmailById = new Map((customers ?? []).map((c) => [c.id, c.email as string]));
  // Listings are still fetched once per make/model, but trim options are
  // now built PER SEARCH: two searches for the same model can commit to
  // different years, so a make/model-level list would hand one of them the
  // other's trims. Filtered by the same shared function /finalize uses, so
  // the agent and the customer always see the same options for one search.
  const listingsByMakeModel = new Map(
    listingsByPair.map(({ make, model, listings }) => [`${make}::${model}`, listings])
  );

  return searches.map((search) => {
    const modelYear = (search.model_year as number | null) ?? null;
    const listings = listingsByMakeModel.get(`${search.make}::${search.model}`) ?? [];
    return {
      id: search.id,
      make: search.make,
      model: search.model,
      customerEmail: customerEmailById.get(search.customer_id) ?? null,
      isTest: isTestEmail(customerEmailById.get(search.customer_id) ?? null),
      callRequestedAt: search.call_requested_at as string,
      modelYear,
      trimOptions: buildTrimOptions(filterListingsToCommittedYear(listings, modelYear)),
    };
  });
}

export interface SwitchCallQueueSearch {
  id: string;
  make: string;
  model: string;
  customerEmail: string | null;
  /** Tester-program row -- flagged, never hidden. See isTest note below. */
  isTest: boolean;
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
    isTest: isTestEmail(customerEmailById.get(search.customer_id) ?? null),
    switchCallRequestedAt: search.switch_call_requested_at as string,
  }));
}

export interface CancellationCallQueueSearch {
  id: string;
  customerId: string;
  make: string;
  model: string;
  customerEmail: string | null;
  /** Tester-program row -- flagged, never hidden. See isTest note below. */
  isTest: boolean;
  cancellationCallRequestedAt: string;
}

/**
 * Searches where the customer chose "Request a call with an agent" on
 * CancellationChoice instead of (or before) self-service cancelling.
 * Same shape as getSwitchCallQueue -- excludes search_status = 'cancelled'
 * so a request naturally drops off once an agent has already resolved it
 * (via AgentCancellationResolutionForm, which calls cancel_search()).
 */
export async function getCancellationCallQueue(): Promise<CancellationCallQueueSearch[]> {
  const supabase = createAdminClient();

  const { data: searches, error: searchesError } = await supabase
    .from("customer_searches")
    .select("id, make, model, customer_id, cancellation_call_requested_at")
    .not("cancellation_call_requested_at", "is", null)
    .neq("search_status", "cancelled")
    .order("cancellation_call_requested_at", { ascending: true });

  if (searchesError) {
    throw new Error(`Failed to load cancellation call queue: ${searchesError.message}`);
  }

  if (!searches || searches.length === 0) {
    return [];
  }

  const customerIds = [...new Set(searches.map((s) => s.customer_id))];
  const { data: customers } = await supabase.from("customers").select("id, email").in("id", customerIds);
  const customerEmailById = new Map((customers ?? []).map((c) => [c.id, c.email as string]));

  return searches.map((search) => ({
    id: search.id,
    customerId: search.customer_id,
    make: search.make,
    model: search.model,
    customerEmail: customerEmailById.get(search.customer_id) ?? null,
    isTest: isTestEmail(customerEmailById.get(search.customer_id) ?? null),
    cancellationCallRequestedAt: search.cancellation_call_requested_at as string,
  }));
}

const OVERDUE_FOLLOW_UP_HOURS = 48;

export interface OverdueFollowUpSearch {
  id: string;
  make: string;
  model: string;
  customerEmail: string | null;
  /** Tester-program row -- flagged, never hidden. See isTest note below. */
  isTest: boolean;
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
    isTest: isTestEmail(customerEmailById.get(search.customer_id) ?? null),
    paidAt: search.paid_at as string,
  }));
}

export interface PausedSearch {
  id: string;
  make: string;
  model: string;
  customerEmail: string | null;
  /** Tester-program row -- flagged, never hidden. See isTest note below. */
  isTest: boolean;
  pausedAt: string;
  // Negative once a search is past its resume window -- e.g. -3 means 3
  // days overdue. Callers sort ascending on this to surface the most
  // urgent rows (most overdue, then soonest-to-expire) first.
  daysRemaining: number;
}

/**
 * Every currently paused search (search_status = 'paused'), each with a
 * live days-remaining figure computed against RESUME_WINDOW_DAYS -- agents
 * stay aware throughout the window, not just alerted once it's already
 * stale. Broadens the original getStalePausedSearchesQueue (which only
 * surfaced rows already past the window) -- see CLAUDE.md's Day-60
 * paused-state policy, Pass 2. What an agent actually does with a given row
 * (comp an extension, write it off, etc.) is a decision for a later pass,
 * not this one -- no action form yet.
 */
export async function getPausedSearchesQueue(): Promise<PausedSearch[]> {
  const supabase = createAdminClient();

  const { data: searches, error: searchesError } = await supabase
    .from("customer_searches")
    .select("id, make, model, customer_id, paused_at")
    .eq("search_status", "paused")
    .not("paused_at", "is", null);

  if (searchesError) {
    throw new Error(`Failed to load paused searches: ${searchesError.message}`);
  }

  if (!searches || searches.length === 0) {
    return [];
  }

  const customerIds = [...new Set(searches.map((s) => s.customer_id))];
  const { data: customers } = await supabase.from("customers").select("id, email").in("id", customerIds);
  const customerEmailById = new Map((customers ?? []).map((c) => [c.id, c.email as string]));

  const now = Date.now();

  const withDaysRemaining: PausedSearch[] = searches.map((search) => {
    const pausedAt = search.paused_at as string;
    const windowEnds = new Date(pausedAt);
    windowEnds.setUTCDate(windowEnds.getUTCDate() + RESUME_WINDOW_DAYS);
    const daysRemaining = Math.ceil((windowEnds.getTime() - now) / (24 * 60 * 60 * 1000));

    return {
      id: search.id,
      make: search.make,
      model: search.model,
      customerEmail: customerEmailById.get(search.customer_id) ?? null,
      isTest: isTestEmail(customerEmailById.get(search.customer_id) ?? null),
      pausedAt,
      daysRemaining,
    };
  });

  return withDaysRemaining.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export interface VehicleConsultationQueueSearch {
  id: string;
  customerEmail: string | null;
  /** Tester-program row -- flagged, never hidden. See isTest note below. */
  isTest: boolean;
  paidAt: string;
}

/**
 * Searches where the customer paid without knowing what vehicle they want
 * yet (the "not sure yet" intake path -- saveUndecidedIntakeSearch).
 * Always needs an agent consultation call, unlike the other call queues
 * which are opt-in requests -- there's no self-service path here since
 * make/model don't exist yet. Worked via finalizeUndecidedSearch /
 * AgentUndecidedFinalizeForm, which sets make/model and finalizes
 * trim/color/options together in one action.
 */
export async function getVehicleConsultationQueue(): Promise<VehicleConsultationQueueSearch[]> {
  const supabase = createAdminClient();

  const { data: searches, error: searchesError } = await supabase
    .from("customer_searches")
    .select("id, customer_id, paid_at")
    .is("make", null)
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: true });

  if (searchesError) {
    throw new Error(`Failed to load vehicle consultation queue: ${searchesError.message}`);
  }

  if (!searches || searches.length === 0) {
    return [];
  }

  const customerIds = [...new Set(searches.map((s) => s.customer_id))];
  const { data: customers } = await supabase.from("customers").select("id, email").in("id", customerIds);
  const customerEmailById = new Map((customers ?? []).map((c) => [c.id, c.email as string]));

  return searches.map((search) => ({
    id: search.id,
    customerEmail: customerEmailById.get(search.customer_id) ?? null,
    isTest: isTestEmail(customerEmailById.get(search.customer_id) ?? null),
    paidAt: search.paid_at as string,
  }));
}

export interface NotificationCallbackQueueItem {
  id: string;
  customerEmail: string | null;
  /** Tester-program row -- flagged, never hidden. See isTest note below. */
  isTest: boolean;
  make: string | null;
  model: string | null;
  eventType: string;
  reason: "callback_requested" | "no_deliverable_channel";
  createdAt: string;
}

/**
 * Real notification-sending system's agent-facing side. Two distinct
 * reasons share one queue, kept visually distinct on the page (per Brett):
 * 'callback_requested' (notify_by_agent_callback was on for this customer
 * when the event fired) and 'no_deliverable_channel' (notify_by_text was
 * the customer's only enabled channel -- no SMS provider exists, so
 * nothing actually reached them). Both resolved the same way
 * (resolveNotificationCallback, outreach-actions.ts), guarded by the shared
 * flag_resolved_at column -- see the notification_events migration for why
 * one column covers both rather than two near-identical ones.
 *
 * Fetches the broader still-unresolved set and filters in application
 * code rather than a .or() PostgREST filter string, same "fetch a small
 * bounded set, compute in JS" convention used throughout this codebase
 * (Day-60's date math, inventory-count's Haversine pass, etc.) -- avoids
 * relying on PostgREST's or-filter string grammar for what's expected to
 * always be a small set.
 */
export async function getNotificationCallbackQueue(): Promise<NotificationCallbackQueueItem[]> {
  const supabase = createAdminClient();

  const { data: allUnresolved, error } = await supabase
    .from("notification_events")
    .select("id, customer_id, customer_search_id, event_type, agent_callback_requested_at, flagged_no_deliverable_channel, created_at")
    .is("flag_resolved_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load notification callback queue: ${error.message}`);
  }

  const events = (allUnresolved ?? []).filter((e) => e.agent_callback_requested_at || e.flagged_no_deliverable_channel);
  if (events.length === 0) return [];

  const searchIds = [...new Set(events.map((e) => e.customer_search_id))];
  const { data: searches } = await supabase.from("customer_searches").select("id, make, model").in("id", searchIds);
  const searchById = new Map((searches ?? []).map((s) => [s.id, s]));

  const customerIds = [...new Set(events.map((e) => e.customer_id))];
  const { data: customers } = await supabase.from("customers").select("id, email").in("id", customerIds);
  const customerEmailById = new Map((customers ?? []).map((c) => [c.id, c.email as string]));

  return events.map((e) => {
    const search = searchById.get(e.customer_search_id);
    return {
      id: e.id,
      customerEmail: customerEmailById.get(e.customer_id) ?? null,
      isTest: isTestEmail(customerEmailById.get(e.customer_id) ?? null),
      make: search?.make ?? null,
      model: search?.model ?? null,
      eventType: e.event_type,
      reason: (e.agent_callback_requested_at ? "callback_requested" : "no_deliverable_channel") as
        | "callback_requested"
        | "no_deliverable_channel",
      createdAt: e.created_at,
    };
  });
}
