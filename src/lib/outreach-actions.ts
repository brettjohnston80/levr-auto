"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";

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
