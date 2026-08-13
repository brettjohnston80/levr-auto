import "server-only";
import { createAdminClient } from "./supabase/admin";

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
}

export interface DashboardSearch {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  colors: string[];
  requiredOptions: string[];
  searchStatus: string;
  guaranteeStatus: string;
  paidAt: string | null;
  finalizedAt: string | null;
  solidifiedAt: string | null;
  callRequestedAt: string | null;
  offers: DashboardOffer[];
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
 * a dead end while a search sits in awaiting_finalization.
 */
export async function getCustomerDashboard(customerId: string): Promise<DashboardSearch[]> {
  const supabase = createAdminClient();

  const { data: searches, error: searchesError } = await supabase
    .from("customer_searches")
    .select(
      "id, make, model, trim, colors, required_options, search_status, guarantee_status, paid_at, finalized_at, solidified_at, call_requested_at"
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

  const { data: offers, error: offersError } = await supabase
    .from("qualifying_offers")
    .select(
      "id, customer_search_id, dealer_name, offer_price_cents, msrp_cents, is_below_msrp, status, received_at, delivered_at, customer_responded_at"
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
          .select("qualifying_offer_id, type, uploaded_at, signed_at")
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

    const latestUploadByOfferId = new Map<string, string>();
    for (const doc of docs ?? []) {
      if (doc.type === "financing_proof" && doc.uploaded_at && !latestUploadByOfferId.has(doc.qualifying_offer_id)) {
        latestUploadByOfferId.set(doc.qualifying_offer_id, doc.uploaded_at);
      }
      if (doc.type === "service_agreement" && doc.signed_at) {
        serviceAgreementSignedAtByOfferId.set(doc.qualifying_offer_id, doc.signed_at);
      }
    }

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
      });
    }
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
      customerRespondedAt: offer.customer_responded_at,
      addons: addonsByOfferId.get(offer.id) ?? [],
      dealProgress: dealProgressByOfferId.get(offer.id) ?? null,
      serviceAgreementSignedAt: serviceAgreementSignedAtByOfferId.get(offer.id) ?? null,
    });
    offersBySearchId.set(offer.customer_search_id, list);
  }

  return searches.map((search) => ({
    id: search.id,
    make: search.make,
    model: search.model,
    trim: search.trim,
    colors: search.colors,
    requiredOptions: search.required_options,
    searchStatus: search.search_status,
    guaranteeStatus: search.guarantee_status,
    paidAt: search.paid_at,
    finalizedAt: search.finalized_at,
    solidifiedAt: search.solidified_at,
    callRequestedAt: search.call_requested_at,
    offers: offersBySearchId.get(search.id) ?? [],
  }));
}
