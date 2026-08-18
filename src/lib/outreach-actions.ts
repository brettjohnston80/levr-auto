"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";
import { getDocumentStatus } from "./pandadoc/client";

export interface LogOfferResult {
  ok: boolean;
  error?: string;
}

/**
 * Logs a real, itemized dealer offer into qualifying_offers. Never touches
 * delivered_at or status — those belong to the customer dashboard/24h
 * response-window flow, which isn't built yet. Re-checks agent auth here
 * rather than trusting the calling page's own gate.
 */
export async function logQualifyingOffer(formData: FormData): Promise<LogOfferResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const customerSearchId = formData.get("customer_search_id")?.toString();
  const listingId = formData.get("listing_id")?.toString() || null;
  const dealerName = formData.get("dealer_name")?.toString().trim();
  const dealerContact = formData.get("dealer_contact")?.toString().trim() || null;
  const offerPriceRaw = formData.get("offer_price")?.toString();
  const msrpRaw = formData.get("msrp")?.toString();
  const notes = formData.get("notes")?.toString().trim() || null;

  if (!customerSearchId || !dealerName || !offerPriceRaw || !msrpRaw) {
    return { ok: false, error: "Dealer name, offer price, and MSRP are required." };
  }

  const offerPriceCents = Math.round(parseFloat(offerPriceRaw) * 100);
  const msrpCents = Math.round(parseFloat(msrpRaw) * 100);

  if (!Number.isFinite(offerPriceCents) || offerPriceCents <= 0) {
    return { ok: false, error: "Offer price must be a positive number." };
  }
  if (!Number.isFinite(msrpCents) || msrpCents <= 0) {
    return { ok: false, error: "MSRP must be a positive number." };
  }

  const admin = createAdminClient();

  const { data: search, error: searchError } = await admin
    .from("customer_searches")
    .select("id")
    .eq("id", customerSearchId)
    .maybeSingle();

  if (searchError || !search) {
    return { ok: false, error: "That search no longer exists." };
  }

  const { error: insertError } = await admin.from("qualifying_offers").insert({
    customer_search_id: customerSearchId,
    listing_id: listingId,
    dealer_name: dealerName,
    dealer_contact: dealerContact,
    offer_price_cents: offerPriceCents,
    msrp_cents: msrpCents,
    notes,
  });

  if (insertError) {
    return { ok: false, error: `Failed to save offer: ${insertError.message}` };
  }

  revalidatePath("/internal/outreach");
  return { ok: true };
}

export interface MarkVehicleSoldResult {
  ok: boolean;
  error?: string;
}

/**
 * Records that the specific unit behind an offer sold to someone else —
 * learned from the dealer, logged by an agent. Feeds the sold-before-response
 * guarantee edge case (src/lib/guarantee.ts), which checks this against
 * customer_responded_at and the 24h window from delivered_at.
 *
 * Guarded by `.is("vehicle_sold_at", null)` on the write, matching the
 * delivered_at guard pattern elsewhere — idempotent against double-clicks.
 */
export async function markOfferVehicleSold(offerId: string): Promise<MarkVehicleSoldResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();

  const { data: updated, error: updateError } = await admin
    .from("qualifying_offers")
    .update({ vehicle_sold_at: new Date().toISOString() })
    .eq("id", offerId)
    .is("vehicle_sold_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: `Failed to mark sold: ${updateError.message}` };
  }
  if (!updated) {
    return { ok: false, error: "Already marked sold." };
  }

  revalidatePath("/internal/outreach");
  return { ok: true };
}

export interface MarkSearchPurchasedResult {
  ok: boolean;
  error?: string;
}

/**
 * Purchased celebratory state (Part 3, plan.md) -- agent-marked only, no
 * Stripe/deposit automation, purely a judgment call during deal-close.
 * Flips search_status to 'purchased', which /account renders as
 * PurchasedCelebration instead of the normal offer-tracking UI. Guarded by
 * .eq("search_status", "searching") on the write -- idempotent against a
 * double-click, and refuses to fire on a search that isn't actually active
 * (already cancelled, already purchased, etc.).
 */
export async function markSearchPurchased(searchId: string): Promise<MarkSearchPurchasedResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();

  const { data: updated, error: updateError } = await admin
    .from("customer_searches")
    .update({ search_status: "purchased", purchased_at: new Date().toISOString() })
    .eq("id", searchId)
    .eq("search_status", "searching")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: `Failed to mark purchased: ${updateError.message}` };
  }
  if (!updated) {
    return { ok: false, error: "This search isn't active right now — can't mark it purchased." };
  }

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}

export interface LogOfferAddonResult {
  ok: boolean;
  error?: string;
}

/**
 * Itemizes one fee/add-on on an already-logged offer. Optional and can
 * happen any time after the offer itself is logged, not just at creation —
 * dealers often only reveal a fee breakdown once actually asked to itemize.
 */
export async function logOfferAddon(formData: FormData): Promise<LogOfferAddonResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const offerId = formData.get("qualifying_offer_id")?.toString();
  const description = formData.get("description")?.toString().trim();
  const amountRaw = formData.get("amount")?.toString();

  if (!offerId || !description || !amountRaw) {
    return { ok: false, error: "Description and amount are required." };
  }

  const amountCents = Math.round(parseFloat(amountRaw) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Amount must be a positive number." };
  }

  const admin = createAdminClient();

  const { data: offer, error: offerError } = await admin
    .from("qualifying_offers")
    .select("id")
    .eq("id", offerId)
    .maybeSingle();

  if (offerError || !offer) {
    return { ok: false, error: "That offer no longer exists." };
  }

  const { error: insertError } = await admin.from("offer_addons").insert({
    qualifying_offer_id: offerId,
    description,
    amount_cents: amountCents,
  });

  if (insertError) {
    return { ok: false, error: `Failed to save add-on: ${insertError.message}` };
  }

  revalidatePath("/internal/outreach");
  return { ok: true };
}

export type AddonRemovalOutcome = "dealer_accepted" | "dealer_declined" | "dealer_countered";

export interface ResolveAddonRemovalResult {
  ok: boolean;
  error?: string;
}

/**
 * Records what the dealer actually said about a pending add-on removal
 * request — a human agent transcribing a call/email, never automated.
 * Guarded by .eq("removal_status", "pending") so a request can't be
 * resolved twice or resolved when it isn't actually active.
 */
export async function resolveAddonRemoval(
  addonId: string,
  outcome: AddonRemovalOutcome,
  dealerResponse: string | null
): Promise<ResolveAddonRemovalResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();

  const { data: updated, error: updateError } = await admin
    .from("offer_addons")
    .update({
      removal_status: outcome,
      dealer_response: dealerResponse,
      removal_resolved_at: new Date().toISOString(),
    })
    .eq("id", addonId)
    .eq("removal_status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: `Failed to save resolution: ${updateError.message}` };
  }
  if (!updated) {
    return { ok: false, error: "This request is no longer pending." };
  }

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}

async function getAcceptedOfferOrError(admin: ReturnType<typeof createAdminClient>, offerId: string) {
  const { data: offer, error } = await admin
    .from("qualifying_offers")
    .select("id, status")
    .eq("id", offerId)
    .maybeSingle();

  if (error || !offer) {
    return { ok: false as const, error: "That offer no longer exists." };
  }
  if (offer.status !== "customer_accepted") {
    return { ok: false as const, error: "This offer hasn't been accepted yet." };
  }
  return { ok: true as const };
}

export interface ConfirmAvailabilityResult {
  ok: boolean;
  error?: string;
}

/**
 * Dealer re-confirms the specific unit is still available (Step 11) —
 * learned by the agent on a call/email, recorded manually, never automated.
 * Upserts deal_progress since it may not have a row yet (it's 1:1 with the
 * offer, created lazily by whichever of these actions fires first).
 */
export async function confirmAvailability(offerId: string): Promise<ConfirmAvailabilityResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();

  const offerCheck = await getAcceptedOfferOrError(admin, offerId);
  if (!offerCheck.ok) {
    return offerCheck;
  }

  const { error } = await admin.from("deal_progress").upsert(
    { qualifying_offer_id: offerId, availability_reconfirmed_at: new Date().toISOString() },
    { onConflict: "qualifying_offer_id" }
  );

  if (error) {
    return { ok: false, error: `Failed to confirm availability: ${error.message}` };
  }

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}

export interface ConfirmDepositResult {
  ok: boolean;
  error?: string;
}

/**
 * Records that the dealer confirmed receiving the reservation deposit
 * directly from the customer — LEVR never processes or holds this money.
 * amountRaw is whatever the agent is told the dealer collected, not a
 * LEVR-set figure. Sets both the amount and the confirmation timestamp in
 * one action, since realistically both come from the same phone call.
 */
export async function confirmDepositReceived(
  offerId: string,
  amountRaw: string
): Promise<ConfirmDepositResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const amountCents = Math.round(parseFloat(amountRaw) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Deposit amount must be a positive number." };
  }

  const admin = createAdminClient();

  const offerCheck = await getAcceptedOfferOrError(admin, offerId);
  if (!offerCheck.ok) {
    return offerCheck;
  }

  const { error } = await admin.from("deal_progress").upsert(
    {
      qualifying_offer_id: offerId,
      deposit_amount_cents: amountCents,
      deposit_confirmed_at: new Date().toISOString(),
    },
    { onConflict: "qualifying_offer_id" }
  );

  if (error) {
    return { ok: false, error: `Failed to confirm deposit: ${error.message}` };
  }

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}

export interface CheckSigningStatusResult {
  ok: boolean;
  error?: string;
  signed?: boolean;
}

/**
 * Manual reconciliation, independent of the client-side document.completed
 * event (which is the primary signal, but can be missed if the customer's
 * tab closes mid-flow or the browser call fails). Asks PandaDoc directly
 * for the document's current status — authoritative, since it comes from
 * PandaDoc's own server rather than a browser self-report. Exists because
 * webhooks aren't available on the current PandaDoc plan, so there's no
 * server-to-server push to fall back on.
 */
export async function checkServiceAgreementSigningStatus(offerId: string): Promise<CheckSigningStatusResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();

  const { data: doc, error: docError } = await admin
    .from("documents")
    .select("id, external_signature_id, signed_at")
    .eq("qualifying_offer_id", offerId)
    .eq("type", "service_agreement")
    .maybeSingle();

  if (docError) {
    return { ok: false, error: `Failed to look up the document: ${docError.message}` };
  }
  if (!doc || !doc.external_signature_id) {
    return { ok: false, error: "No service agreement has been created for this offer yet." };
  }
  if (doc.signed_at) {
    return { ok: true, signed: true };
  }

  let status: string;
  try {
    status = await getDocumentStatus(doc.external_signature_id);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to check status with PandaDoc.",
    };
  }

  if (!status.includes("completed")) {
    return { ok: true, signed: false };
  }

  const { error: updateError } = await admin
    .from("documents")
    .update({ signed_at: new Date().toISOString() })
    .eq("id", doc.id)
    .is("signed_at", null);

  if (updateError) {
    return { ok: false, error: `Failed to record signature: ${updateError.message}` };
  }

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true, signed: true };
}

export interface FinalizeByAgentResult {
  ok: boolean;
  error?: string;
}

/**
 * Agent-side counterpart to finalizeSelfService (finalize-actions.ts) — used
 * after an agent actually reaches the customer on the call they requested
 * (see getFinalizationQueue in outreach-queue.ts). Same effect as the
 * customer's own self-service finalize: sets trim/colors/required_options,
 * stamps finalized_at (starting the 24h self-edit window), and flips
 * search_status to 'pending_refinement'. Agent-authorized rather than
 * ownership-checked, matching the pattern already used for switching
 * (switch-actions.ts AgentSwitchSearchForm) — an agent acts on the
 * customer's behalf here, not as the customer.
 */
export async function finalizeSearchByAgent(
  searchId: string,
  details: { trim: string; colors: string[]; requiredOptions: string[] }
): Promise<FinalizeByAgentResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();

  const { data: updated, error } = await admin
    .from("customer_searches")
    .update({
      trim: details.trim || null,
      colors: details.colors,
      required_options: details.requiredOptions,
      finalized_at: new Date().toISOString(),
      search_status: "pending_refinement",
    })
    .eq("id", searchId)
    .eq("search_status", "awaiting_finalization")
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: `Failed to finalize: ${error.message}` };
  }
  if (!updated) {
    return { ok: false, error: "This search is no longer awaiting finalization." };
  }

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}
