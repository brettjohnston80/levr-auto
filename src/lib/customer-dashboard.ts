import "server-only";
import { createAdminClient } from "./supabase/admin";
import {
  computeCategoryAvailability,
  groupIntoPackages,
  type ConfiguratorChoice,
  type ConfiguratorQuestions,
  type ConfiguratorSelection,
} from "./configurator-matching";
import { getConfiguratorQuestionsForResolvedTrimIds } from "./configurator-questions";
import { vehicleColorImageUrl } from "./vehicle-color-images";

export interface DashboardAddon {
  id: string;
  description: string;
  amountCents: number;
  removalStatus: string;
  dealerResponse: string | null;
}

export interface DashboardDealProgress {
  availabilityReconfirmedAt: string | null;
  depositAmountCents: number | null;
  depositConfirmedAt: string | null;
  financingChoice: string | null;
  financingIncomeRange: string | null;
  financingDownPaymentCents: number | null;
  financingDesiredTermMonths: number | null;
  financingProofUploadedAt: string | null;
  deliveryMethod: string | null;
}

export interface DashboardOffer {
  id: string;
  dealerName: string;
  offerPriceCents: number;
  msrpCents: number;
  isBelowMsrp: boolean;
  status: string;
  receivedAt: string;
  deliveredAt: string;
  customerRespondedAt: string | null;
  addons: DashboardAddon[];
  dealProgress: DashboardDealProgress | null;
  serviceAgreementSignedAt: string | null;
  offerSheetUrl: string | null;
  /**
   * Denormalized snapshot of what the dealer is offering, agent-entered at
   * log time -- see the migration header on qualifying_offers.vehicle_trim/
   * vehicle_exterior_color for why these are never live-joined against a
   * listing. Both null on most offers today (most real offers aren't
   * listing-backed and the AI offer-parser never extracts a vehicle
   * description) -- that's the expected, common case, not a bug.
   */
  vehicleTrim: string | null;
  vehicleExteriorColor: string | null;
  /**
   * Resolved server-side (vehicleColorImageUrl needs fs access, so this
   * can't be resolved from a client component) against the PARENT SEARCH's
   * make/model -- an offer has no make/model of its own. Null whenever no
   * color is on file, or when we simply don't have a photo for this
   * make/model/color (the overwhelmingly common case -- only Camry/Civic
   * are covered today). OfferPhoto renders the honest silhouette
   * placeholder for null, never a broken image.
   */
  photoUrl: string | null;
}

export interface DashboardSearch {
  id: string;
  // Nullable as of 2026-08-19 -- the "not sure yet" undecided intake path
  // (saveUndecidedIntakeSearch) creates a paid row with no vehicle picked
  // yet. Always set together once an agent runs finalizeUndecidedSearch.
  make: string | null;
  model: string | null;
  /** Committed model year; null on undecided searches and rows predating 2026-09-14. */
  modelYear: number | null;
  trim: string | null;
  colors: string[];
  requiredOptions: string[];
  searchStatus: string;
  guaranteeStatus: string;
  paidAt: string | null;
  finalizedAt: string | null;
  solidifiedAt: string | null;
  callRequestedAt: string | null;
  switchCallRequestedAt: string | null;
  pausedAt: string | null;
  searchDeadlineAt: string | null;
  autoRenewEnabled: boolean;
  cancellationCallRequestedAt: string | null;
  purchasedAt: string | null;
  survey: { id: string; submittedAt: string | null } | null;
  offers: DashboardOffer[];
  /**
   * Real read-only view of what the customer actually selected on the rich
   * Toyota/Honda configurator flow (colors/interior/seating/features) --
   * empty for the 34 makes with no configurator data, or a search that
   * hasn't been finalized yet. Feeds SelectionSummary (configurator-
   * questions.tsx) directly on /account, the exact same component the
   * Review step itself already uses -- one rendering, can't drift between
   * what the customer saw at Review and what /account shows back later.
   */
  configuratorSelections: ConfiguratorSelection[];
}

/**
 * Loads a customer's searches and offers, and — per the guarantee rule —
 * marks any not-yet-delivered offer as delivered the moment it's shown here.
 * `delivered_at` is the 24h response-window clock start, not raw dealer
 * receipt (see the comment on qualifying_offers in the schema). The
 * WHERE delivered_at IS NULL guard makes this idempotent: revisiting the
 * page, or a concurrent load, never re-fires or double-sets it.
 *
 * finalized_at, solidified_at, and call_requested_at are surfaced here so
 * /account can render the post-payment finalize/self-edit UI: finalized_at
 * anchors the 24h self-edit countdown (see finalize-actions.ts), solidified_at
 * tells us the window already closed (search-solidification.ts), and
 * call_requested_at lets the page show "an agent will reach out" instead of
 * a dead end while a search sits in awaiting_finalization. switch_call_requested_at
 * is the same idea for the switch flow (SwitchChoice) -- lets /account show
 * the locked call-request confirmation instead of the picker again.
 * paused_at anchors the paused-state countdown/expired copy (RESUME_WINDOW_DAYS,
 * see account/page.tsx's getPausedStatusCopy).
 */
export async function getCustomerDashboard(customerId: string): Promise<DashboardSearch[]> {
  const supabase = createAdminClient();

  const { data: searches, error: searchesError } = await supabase
    .from("customer_searches")
    .select(
      "id, make, model, model_year, trim, colors, required_options, search_status, guarantee_status, paid_at, finalized_at, solidified_at, call_requested_at, switch_call_requested_at, paused_at, search_deadline_at, auto_renew_enabled, cancellation_call_requested_at, purchased_at"
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });

  if (searchesError) {
    throw new Error(`Failed to load customer searches: ${searchesError.message}`);
  }

  if (!searches || searches.length === 0) {
    return [];
  }

  const searchIds = searches.map((s) => s.id);

  // LEVRating Phase B -- created by the daily post-deal-survey cron, not
  // here. Existence of the row (not any local date math) is what unlocks
  // the /account prompt card, same 2-day trigger as the email.
  const { data: surveys, error: surveysError } = await supabase
    .from("post_deal_surveys")
    .select("id, customer_search_id, submitted_at")
    .in("customer_search_id", searchIds);

  if (surveysError) {
    throw new Error(`Failed to load post-deal surveys: ${surveysError.message}`);
  }

  const surveyBySearchId = new Map((surveys ?? []).map((s) => [s.customer_search_id, s]));

  // Needed to resolve each offer's photo below -- vehicleColorImageUrl is
  // keyed on make/model, which lives on the search, not the offer itself.
  const makeModelBySearchId = new Map(searches.map((s) => [s.id, { make: s.make, model: s.model }]));

  const { data: offers, error: offersError } = await supabase
    .from("qualifying_offers")
    .select(
      "id, customer_search_id, dealer_name, offer_price_cents, msrp_cents, is_below_msrp, status, received_at, delivered_at, customer_responded_at, vehicle_trim, vehicle_exterior_color"
    )
    .in("customer_search_id", searchIds)
    .order("received_at", { ascending: false });

  if (offersError) {
    throw new Error(`Failed to load qualifying offers: ${offersError.message}`);
  }

  const offerIds = (offers ?? []).map((o) => o.id);
  const addonsByOfferId = new Map<string, DashboardAddon[]>();

  if (offerIds.length > 0) {
    const { data: addons, error: addonsError } = await supabase
      .from("offer_addons")
      .select("id, qualifying_offer_id, description, amount_cents, removal_status, dealer_response")
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
        dealerResponse: addon.dealer_response,
      });
      addonsByOfferId.set(addon.qualifying_offer_id, list);
    }
  }

  const dealProgressByOfferId = new Map<string, DashboardDealProgress>();
  const serviceAgreementSignedAtByOfferId = new Map<string, string>();
  const offerSheetUrlByOfferId = new Map<string, string>();

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
          .select("qualifying_offer_id, type, uploaded_at, signed_at, storage_path")
          .in("type", ["financing_proof", "service_agreement", "offer_sheet"])
          .is("deleted_at", null)
          .in("qualifying_offer_id", offerIds)
          .order("uploaded_at", { ascending: false }),
      ]);

    if (progressError) {
      throw new Error(`Failed to load deal progress: ${progressError.message}`);
    }
    if (docsError) {
      throw new Error(`Failed to load documents: ${docsError.message}`);
    }

    const latestUploadByOfferId = new Map<string, string>();
    // Offer-sheet PDFs never get a customer-browser-usable URL from
    // storage_path directly (storage.objects has no RLS policies at all,
    // service_role only) -- signed fresh below, same 15-minute TTL and
    // "mint on every page load, never persist" convention already used for
    // financing_proof on the agent side (getOutreachQueue).
    const offerSheetPathByOfferId = new Map<string, string>();
    for (const doc of docs ?? []) {
      if (doc.type === "financing_proof" && doc.uploaded_at && !latestUploadByOfferId.has(doc.qualifying_offer_id)) {
        latestUploadByOfferId.set(doc.qualifying_offer_id, doc.uploaded_at);
      }
      if (doc.type === "service_agreement" && doc.signed_at) {
        serviceAgreementSignedAtByOfferId.set(doc.qualifying_offer_id, doc.signed_at);
      }
      if (doc.type === "offer_sheet" && doc.storage_path && !offerSheetPathByOfferId.has(doc.qualifying_offer_id)) {
        offerSheetPathByOfferId.set(doc.qualifying_offer_id, doc.storage_path);
      }
    }

    await Promise.all(
      [...offerSheetPathByOfferId.entries()].map(async ([offerId, path]) => {
        const { data } = await supabase.storage.from("documents").createSignedUrl(path, 900);
        if (data?.signedUrl) {
          offerSheetUrlByOfferId.set(offerId, data.signedUrl);
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
        financingProofUploadedAt: latestUploadByOfferId.get(row.qualifying_offer_id) ?? null,
        deliveryMethod: row.delivery_method,
      });
    }
  }

  // Not paginated, unlike getOutreachQueue's equivalent read -- that one
  // spans every active search across every customer and can realistically
  // near PostgREST's 1,000-row cap; this is scoped to one customer's own
  // searches, which never approaches that.
  const { data: configuratorSelectionRows, error: selectionsError } = await supabase
    .from("search_option_selections")
    .select(
      "search_id, category, question_kind, selection, rank_position, excluded, package_name, package_price_cents, package_contents, price_unknown"
    )
    .in("search_id", searchIds)
    .order("id");

  if (selectionsError) {
    throw new Error(`Failed to load configurator selections: ${selectionsError.message}`);
  }

  const configuratorSelectionsBySearchId = new Map<string, ConfiguratorSelection[]>();
  for (const row of configuratorSelectionRows ?? []) {
    const list = configuratorSelectionsBySearchId.get(row.search_id) ?? [];
    list.push({
      category: row.category as ConfiguratorSelection["category"],
      questionKind: row.question_kind as ConfiguratorSelection["questionKind"],
      selection: row.selection,
      rankPosition: row.rank_position,
      excluded: row.excluded,
      packageName: row.package_name,
      packagePriceCents: row.package_price_cents,
      packageContents: row.package_contents,
      priceUnknown: row.price_unknown,
    });
    configuratorSelectionsBySearchId.set(row.search_id, list);
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
    const { make, model } = makeModelBySearchId.get(offer.customer_search_id) ?? {
      make: null,
      model: null,
    };
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
      customerRespondedAt: offer.customer_responded_at,
      addons: addonsByOfferId.get(offer.id) ?? [],
      dealProgress: dealProgressByOfferId.get(offer.id) ?? null,
      serviceAgreementSignedAt: serviceAgreementSignedAtByOfferId.get(offer.id) ?? null,
      offerSheetUrl: offerSheetUrlByOfferId.get(offer.id) ?? null,
      vehicleTrim: offer.vehicle_trim,
      vehicleExteriorColor: offer.vehicle_exterior_color,
      photoUrl: offer.vehicle_exterior_color
        ? vehicleColorImageUrl(make, model, "exterior_color", offer.vehicle_exterior_color)
        : null,
    });
    offersBySearchId.set(offer.customer_search_id, list);
  }

  return searches.map((search) => ({
    id: search.id,
    make: search.make,
    model: search.model,
    modelYear: search.model_year,
    trim: search.trim,
    colors: search.colors,
    requiredOptions: search.required_options,
    searchStatus: search.search_status,
    guaranteeStatus: search.guarantee_status,
    paidAt: search.paid_at,
    finalizedAt: search.finalized_at,
    solidifiedAt: search.solidified_at,
    callRequestedAt: search.call_requested_at,
    switchCallRequestedAt: search.switch_call_requested_at,
    pausedAt: search.paused_at,
    searchDeadlineAt: search.search_deadline_at,
    autoRenewEnabled: search.auto_renew_enabled,
    cancellationCallRequestedAt: search.cancellation_call_requested_at,
    purchasedAt: search.purchased_at,
    survey: (() => {
      const s = surveyBySearchId.get(search.id);
      return s ? { id: s.id, submittedAt: s.submitted_at } : null;
    })(),
    offers: offersBySearchId.get(search.id) ?? [],
    configuratorSelections: configuratorSelectionsBySearchId.get(search.id) ?? [],
  }));
}

export interface VehicleDetailsRankedTrim {
  trim: string;
  modelYear: number | null;
  rankPosition: number;
}

export interface VehicleDetailsCategory {
  /** Real ConfiguratorChoice per ranked (non-excluded) selection, in the
   *  customer's own rank order -- real price/package data resolved via
   *  computeCategoryAvailability's existing tie-break, same rule the
   *  customer's own ranking UI used when they made the choice. Never
   *  re-derived independently, so this can't disagree with what they saw. */
  ranked: ConfiguratorChoice[];
  /** Names only -- an exclusion has no price/package info worth showing. */
  excludedNames: string[];
}

export interface VehicleDetails {
  searchId: string;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  trim: string | null;
  searchStatus: string;
  rankedTrims: VehicleDetailsRankedTrim[];
  excludedTrims: VehicleDetailsRankedTrim[];
  exteriorColor: VehicleDetailsCategory;
  interior: VehicleDetailsCategory;
  feature: VehicleDetailsCategory;
}

/**
 * Real specs for ONE finalized search -- feeds /account/vehicle's full
 * read-only detail view. Scoped to a single search (unlike
 * getCustomerDashboard, which loads every search plus offers/addons/deal
 * progress this page has no use for).
 *
 * Ownership is enforced at the query itself (customer_id = the id passed
 * in), not just trusted from the caller -- same discipline every other
 * customer-scoped read in this file already follows.
 *
 * Returns null if the search doesn't exist, isn't owned by this customer,
 * or has no real vehicle yet (undecided intake).
 */
export async function getVehicleDetails(
  searchId: string,
  customerId: string,
): Promise<VehicleDetails | null> {
  const supabase = createAdminClient();

  const { data: search, error: searchError } = await supabase
    .from("customer_searches")
    .select("id, make, model, model_year, trim, search_status")
    .eq("id", searchId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (searchError) {
    throw new Error(`Failed to load search: ${searchError.message}`);
  }
  if (!search || !search.make || !search.model) {
    return null;
  }

  const { data: trimPrefRows, error: trimPrefError } = await supabase
    .from("search_trim_preferences")
    .select("trim, model_year, rank_position, excluded, configurator_trim_id")
    .eq("search_id", searchId)
    .order("rank_position", { ascending: true, nullsFirst: false });

  if (trimPrefError) {
    throw new Error(`Failed to load trim preferences: ${trimPrefError.message}`);
  }

  const rankedTrims: VehicleDetailsRankedTrim[] = [];
  const excludedTrims: VehicleDetailsRankedTrim[] = [];
  const rankedResolvedTrimIds: string[] = [];
  const trimDisplayNameById: Record<string, string> = {};

  for (const row of trimPrefRows ?? []) {
    const label = { trim: row.trim as string, modelYear: row.model_year as number | null };
    if (row.excluded) {
      excludedTrims.push({ ...label, rankPosition: 0 });
      continue;
    }
    rankedTrims.push({ ...label, rankPosition: row.rank_position as number });
    const configuratorTrimId = row.configurator_trim_id as string | null;
    if (configuratorTrimId) {
      rankedResolvedTrimIds.push(configuratorTrimId);
      trimDisplayNameById[configuratorTrimId] =
        row.model_year != null ? `${row.trim} ${row.model_year}` : (row.trim as string);
    }
  }

  const { data: selectionRows, error: selectionError } = await supabase
    .from("search_option_selections")
    .select(
      "category, selection, rank_position, excluded, package_name, package_price_cents, package_contents, price_unknown",
    )
    .eq("search_id", searchId)
    .order("id");

  if (selectionError) {
    throw new Error(`Failed to load configurator selections: ${selectionError.message}`);
  }

  const configuratorQuestions: Record<string, ConfiguratorQuestions> =
    rankedResolvedTrimIds.length > 0
      ? await getConfiguratorQuestionsForResolvedTrimIds(rankedResolvedTrimIds, search.make, search.model)
      : {};

  const rawChoicesFor: Record<string, (q: ConfiguratorQuestions) => ConfiguratorChoice[]> = {
    exterior_color: (q) => q.exteriorColorRaw,
    interior: (q) => q.interiorRaw,
    feature: (q) => groupIntoPackages(q.features),
  };

  const buildCategory = (category: "exterior_color" | "interior" | "feature"): VehicleDetailsCategory => {
    const mine = (selectionRows ?? []).filter((r) => r.category === category);
    const ranked = mine
      .filter((r) => !r.excluded && r.rank_position != null)
      .sort((a, b) => (a.rank_position as number) - (b.rank_position as number));
    const excludedNames = mine.filter((r) => r.excluded).map((r) => r.selection as string);

    if (rankedResolvedTrimIds.length === 0) {
      return { ranked: [], excludedNames };
    }

    // Same real per-choice data (price, package name/contents, photo,
    // swatch) the customer's own ranking UI showed them, resolved by the
    // exact same tie-break -- never re-derived, so this can't quietly
    // disagree on which trim's price to show for a package priced
    // differently across the customer's ranked trims.
    const { rankable } = computeCategoryAvailability(
      rankedResolvedTrimIds,
      rankedResolvedTrimIds,
      configuratorQuestions,
      rawChoicesFor[category],
      trimDisplayNameById,
    );
    const byName = new Map(rankable.map((c) => [c.name, c]));

    const choices: ConfiguratorChoice[] = ranked.map((r) => {
      const live = byName.get(r.selection as string);
      if (live) return live;
      // Fallback for a name that's no longer live-resolvable (e.g. the
      // option was dropped from a later dataset re-import). The selection
      // row itself carries its own package snapshot from write time
      // (search_option_selections denormalizes package_name/price/
      // contents, same convention as search_trim_preferences' trim
      // column) -- real historical price/package data, not a guess, just
      // not re-validated against the current live dataset the way the
      // common (live) case above is.
      return {
        name: r.selection as string,
        availability: r.package_name ? "package_only" : "standalone",
        priceCents: null,
        priceIsIncluded: false,
        packageName: (r.package_name as string | null) ?? null,
        packagePriceCents: (r.package_price_cents as number | null) ?? null,
        packageContents: (r.package_contents as string[] | null) ?? null,
      };
    });

    return { ranked: choices, excludedNames };
  };

  return {
    searchId: search.id,
    make: search.make,
    model: search.model,
    modelYear: search.model_year as number | null,
    trim: search.trim as string | null,
    searchStatus: search.search_status as string,
    rankedTrims,
    excludedTrims,
    exteriorColor: buildCategory("exterior_color"),
    interior: buildCategory("interior"),
    feature: buildCategory("feature"),
  };
}
