import "server-only";
import { createAdminClient } from "./supabase/admin";
import { logAgentActivity } from "./agent-activity";
import { logNotificationEvent } from "./notifications";
import { resolveOfferDealerAlias } from "./offer-dealer-alias";
import { zipDistanceMiles } from "./zip-distance";
import { travelFromColumns } from "./pickup-travel";
import { deliveryEstimateStandard } from "./delivery-estimate";
import { destinationAddonRefusal } from "./offer-parse-normalize";
import { amountProblems, checkOutTheDoorTotal, type OfferFeeKind } from "./offer-pricing";
import { offerWarnings, unconfirmedWarnings, type ExistingOffer, type OfferWarning } from "./offer-warnings";
import { checkVin } from "./vin-check";

/**
 * Offer entry, Chunk 3: save a draft, send it to the customer, discard a dealer's submission.
 * The core logic, keyed by the agent's id; offer-submission-actions.ts wraps it with the
 * signed-in agent. Every refusal is a code; the page shows its wording (offer-entry-copy.ts).
 *
 * Nothing here writes a qualifying_offers row except through send_offer_submission (OE-2b),
 * so a draft never reaches the customer, and a send writes everything in one transaction.
 */

/** What the agent's page sends: the offer, in the shape send_offer_submission reads. */
export interface OfferPayload {
  dealer_name: string;
  dealer_contact?: string | null;
  listing_id?: string | null;
  dealer_street?: string | null;
  dealer_city?: string | null;
  dealer_state?: string | null;
  dealer_zip?: string | null;
  vin?: string | null;
  stock_number?: string | null;
  vehicle_trim?: string | null;
  vehicle_exterior_color?: string | null;
  vehicle_interior_color?: string | null;
  vehicle_model_year?: number | null;
  offer_price_cents: number;
  msrp_cents: number;
  notes?: string | null;
  good_until?: string | null; // YYYY-MM-DD
  note_to_customer?: string | null;
  delivery_estimate_status?: "requested" | "provided" | "unavailable" | null;
  delivery_estimate_cents?: number | null;
  delivery_estimate_note?: string | null;
  otd_source?: "estimate" | "dealer_quote" | null;
  otd_total_cents?: number | null;
  addons: { description: string; amount_cents: number; customer_wanted?: boolean; dealer_says_removable?: boolean | null }[];
  addons_none_confirmed: boolean;
  fees: { kind: OfferFeeKind; label?: string | null; amount_cents: number; note?: string | null }[];
  other_fees_none_confirmed: boolean;
  options: {
    name: string;
    search_option_selection_id?: string | null;
    customer_asked_for: boolean;
    on_the_car: boolean;
    sticker_price_cents?: number | null;
    install_kind?: "factory" | "dealer" | "port" | null;
  }[];
  trim_match_confirmed: boolean;
  tax_paid_at_registration: boolean;
  /** The warnings the agent ticked. Only warnings that actually apply are stored. */
  warnings_confirmed: string[];
}

export type Refusal = { ok: false; code: string; warnings?: OfferWarning[] };

const MAX_GOOD_UNTIL_DAYS = 60;

type Admin = ReturnType<typeof createAdminClient>;

/** Today's date in the US (America/Chicago), as YYYY-MM-DD. */
function todayChicago(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---- Save draft --------------------------------------------------------------------------

export type SaveDraftResult = { ok: true; submissionId: string } | Refusal;

/**
 * Saves the agent's working copy. Creates an agent draft when there's no submission yet, or
 * updates an existing draft / dealer submission still awaiting review (the dealer's original
 * submitted_payload is never touched). Nothing reaches the customer.
 */
export async function saveOfferDraftFor(
  agentId: string,
  searchId: string,
  submissionId: string | null,
  payload: Partial<OfferPayload>,
): Promise<SaveDraftResult> {
  const admin = createAdminClient();
  const { data: search } = await admin.from("customer_searches").select("id, customer_id").eq("id", searchId).maybeSingle();
  if (!search) return { ok: false, code: "search_not_found" };

  let id = submissionId;
  if (id) {
    const { data: updated, error } = await admin
      .from("offer_submissions")
      .update({ working_payload: payload })
      .eq("id", id)
      .eq("customer_search_id", searchId)
      .in("submission_status", ["draft", "awaiting_review"])
      .select("id");
    if (error) throw new Error(`saveOfferDraft: ${error.message}`);
    if (!updated || updated.length === 0) return { ok: false, code: "submission_not_sendable" };
  } else {
    const { data: created, error } = await admin
      .from("offer_submissions")
      .insert({
        customer_search_id: searchId,
        submission_source: "agent",
        submission_status: "draft",
        working_payload: payload,
        created_by_agent_id: agentId,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(`saveOfferDraft: ${error?.message}`);
    id = created.id as string;
  }

  await logAgentActivity(
    agentId,
    "offer_draft_saved",
    { searchId, customerId: search.customer_id as string },
    { submission_id: id, dealer_name: payload.dealer_name ?? null },
  );
  return { ok: true, submissionId: id };
}

// ---- Send ----------------------------------------------------------------------------------

export type SendResult =
  | { ok: true; offerId: string; submissionId: string; customerFirstName: string | null; otdMissing: boolean }
  | Refusal;

/** The server's checks before calling send_offer_submission. Returns a refusal or null. */
export async function checkOfferBeforeSend(
  admin: Admin,
  searchId: string,
  payload: OfferPayload,
  now = new Date(),
): Promise<{ refusal: Refusal | null; warnings: OfferWarning[]; dealerAliasId: string | null; customerId: string; firstName: string | null }> {
  const empty = { warnings: [] as OfferWarning[], dealerAliasId: null, customerId: "", firstName: null };
  const { data: search } = await admin
    .from("customer_searches")
    .select("id, customer_id, search_status, zip, pickup_travel_choice, pickup_travel_miles")
    .eq("id", searchId)
    .maybeSingle();
  if (!search) return { ...empty, refusal: { ok: false, code: "search_not_found" } };

  const dealerName = payload.dealer_name?.trim();
  if (!dealerName) return { ...empty, refusal: { ok: false, code: "dealer_name_missing" } };

  const lines = {
    stickerCents: payload.msrp_cents,
    priceCents: payload.offer_price_cents,
    addons: payload.addons.map((a) => ({ amountCents: a.amount_cents })),
    fees: payload.fees.map((f) => ({
      kind: f.kind,
      amountCents: f.amount_cents,
      paidAtRegistration: f.kind === "sales_tax" && payload.tax_paid_at_registration,
    })),
  };
  if (amountProblems(lines).length > 0) return { ...empty, refusal: { ok: false, code: "amounts_invalid" } };
  if (payload.addons.some((a) => !a.description?.trim())) return { ...empty, refusal: { ok: false, code: "amounts_invalid" } };
  // Destination is never an add-on: it's already in Total SRP (2026-10-17).
  if (destinationAddonRefusal(payload.addons.map((a) => a.description))) {
    return { ...empty, refusal: { ok: false, code: "amounts_invalid" } };
  }
  if (payload.otd_source) {
    if (!payload.otd_total_cents || !checkOutTheDoorTotal(lines, payload.otd_total_cents).ok) {
      return { ...empty, refusal: { ok: false, code: "otd_mismatch" } };
    }
  }
  if (payload.vin && !checkVin(payload.vin).ok) return { ...empty, refusal: { ok: false, code: "vin_invalid" } };
  if (payload.good_until) {
    const today = todayChicago(now);
    if (payload.good_until < today || payload.good_until > addDays(today, MAX_GOOD_UNTIL_DAYS)) {
      return { ...empty, refusal: { ok: false, code: "good_until_invalid" } };
    }
  }

  // Delivery estimate: standard when the dealer is beyond the pickup range (same rule as Log Offer).
  if (!payload.delivery_estimate_status) {
    const travel = travelFromColumns(
      search.pickup_travel_choice as string | null,
      search.pickup_travel_miles as number | null,
    );
    const miles = await zipDistanceMiles(admin, (search.zip as string | null) ?? null, payload.dealer_zip ?? null);
    if (deliveryEstimateStandard(travel, miles)) {
      return { ...empty, refusal: { ok: false, code: "delivery_estimate_needed" } };
    }
  }

  const dealerAliasId = await resolveOfferDealerAlias(
    admin,
    payload.listing_id ?? null,
    dealerName,
    payload.dealer_city ?? null,
    payload.dealer_state ?? null,
  );

  const { data: offers } = await admin
    .from("qualifying_offers")
    .select("id, vin, dealer_alias_id, dealer_name, status, created_at")
    .eq("customer_search_id", searchId);
  const existing: ExistingOffer[] = (offers ?? []).map((o) => ({
    id: o.id as string,
    vin: (o.vin as string | null) ?? null,
    dealerAliasId: (o.dealer_alias_id as string | null) ?? null,
    dealerName: o.dealer_name as string,
    status: o.status as ExistingOffer["status"],
    createdAt: o.created_at as string,
  }));
  const warnings = offerWarnings(
    {
      stickerCents: payload.msrp_cents,
      priceCents: payload.offer_price_cents,
      vin: payload.vin ?? null,
      dealerAliasId,
      dealerName,
      searchStatus: search.search_status as string,
    },
    existing,
  );
  const { data: customer } = await admin.from("customers").select("first_name").eq("id", search.customer_id).maybeSingle();
  const base = { warnings, dealerAliasId, customerId: search.customer_id as string, firstName: (customer?.first_name as string | null) ?? null };
  if (unconfirmedWarnings(warnings, payload.warnings_confirmed).length > 0) {
    return { ...base, refusal: { ok: false, code: "warnings_unconfirmed", warnings } };
  }
  return { ...base, refusal: null };
}

/**
 * Sends an offer to the customer. With no submission yet, the agent's draft is created first.
 * The checks run on the server; the database function then writes the offer, its lines and the
 * activity rows in one transaction. The new-offer notification goes out only after that commits.
 */
export async function sendOfferFor(
  agentId: string,
  searchId: string,
  submissionId: string | null,
  payload: OfferPayload,
): Promise<SendResult> {
  const admin = createAdminClient();

  // The submission's own state first: an already-sent or discarded one is refused as such,
  // before the warnings (which its own offer would otherwise set off).
  if (submissionId) {
    const { data: sub } = await admin
      .from("offer_submissions")
      .select("id, customer_search_id, submission_status")
      .eq("id", submissionId)
      .maybeSingle();
    if (!sub || sub.customer_search_id !== searchId) return { ok: false, code: "submission_not_found" };
    if (sub.submission_status !== "draft" && sub.submission_status !== "awaiting_review") {
      return { ok: false, code: "submission_not_sendable" };
    }
  }

  const check = await checkOfferBeforeSend(admin, searchId, payload);
  if (check.refusal) return check.refusal;

  let id = submissionId;
  if (!id) {
    const saved = await saveOfferDraftFor(agentId, searchId, null, payload);
    if (!saved.ok) return saved;
    id = saved.submissionId;
  }

  // Store only the ticks for warnings that actually apply.
  const applying = new Set(check.warnings.map((w) => w.code));
  const sendPayload = {
    ...payload,
    dealer_name: payload.dealer_name.trim(),
    dealer_alias_id: check.dealerAliasId,
    warnings_confirmed: payload.warnings_confirmed.filter((c) => applying.has(c as OfferWarning["code"])),
  };
  const { data: offerId, error } = await admin.rpc("send_offer_submission", {
    p_submission_id: id,
    p_agent_id: agentId,
    p_offer: sendPayload,
  });
  if (error || !offerId) {
    const code = error?.message && /^[a-z_]+$/.test(error.message) ? error.message : "send_failed";
    if (code === "send_failed") console.error("sendOffer: send_offer_submission failed", error?.message);
    return { ok: false, code };
  }

  await logNotificationEvent({
    customerSearchId: searchId,
    eventType: "offer_logged",
    eventData: { dealerName: sendPayload.dealer_name, offerPriceCents: payload.offer_price_cents, msrpCents: payload.msrp_cents },
  });

  return {
    ok: true,
    offerId: offerId as string,
    submissionId: id,
    customerFirstName: check.firstName,
    otdMissing: !payload.otd_source,
  };
}

// ---- Discard -----------------------------------------------------------------------------

export type DiscardResult = { ok: true } | Refusal;

/** Discards a dealer's submission (never an agent's own draft). A reason is required. */
export async function discardSubmissionFor(agentId: string, submissionId: string, reason: string): Promise<DiscardResult> {
  const why = reason.trim().slice(0, 500);
  if (!why) return { ok: false, code: "discard_reason_needed" };
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("offer_submissions")
    .select("id, customer_search_id, submission_source, submission_status")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return { ok: false, code: "submission_not_found" };
  if (sub.submission_source === "agent") return { ok: false, code: "discard_only_dealer" };

  const { data: updated, error } = await admin
    .from("offer_submissions")
    .update({ submission_status: "discarded", discarded_at: new Date().toISOString(), discard_reason: why, reviewed_by_agent_id: agentId })
    .eq("id", submissionId)
    .eq("submission_status", "awaiting_review")
    .select("id");
  if (error) throw new Error(`discardSubmission: ${error.message}`);
  if (!updated || updated.length === 0) return { ok: false, code: "submission_not_sendable" };

  const { data: search } = await admin.from("customer_searches").select("customer_id").eq("id", sub.customer_search_id).maybeSingle();
  await logAgentActivity(
    agentId,
    "dealer_submission_discarded",
    { searchId: sub.customer_search_id as string, customerId: (search?.customer_id as string | undefined) ?? null },
    { submission_id: submissionId, reason: why },
  );
  return { ok: true };
}
