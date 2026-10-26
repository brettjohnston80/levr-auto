"use server";

import { travelFromColumns, travelFromValue, travelToColumns } from "./pickup-travel";
import { haversineMiles } from "./geo";
import { deliveryEstimateStandard } from "./delivery-estimate";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";
import { getDocumentStatus } from "./pandadoc/client";
import { DEFAULT_FRESH_WITHIN_HOURS, syncListingsForMakeModel } from "./marketcheck-sync";
import { isOfferedModelYear } from "./intake-vehicle-options";
import { MODEL_YEAR_INVENTORY_BLOCK_ENABLED, loadInventoryBlock } from "./inventory-block";
import { AGENT_INVENTORY_BLOCK_REFUSAL } from "./inventory-block-copy";
import { logNotificationEvent } from "./notifications";
import { logAgentActivity } from "./agent-activity";
import { getOrCreateDealerAlias } from "./dealer-aliases";
import { destinationAddonRefusal } from "./offer-parse-normalize";

export interface LogOfferResult {
  ok: boolean;
  error?: string;
}

interface AddonLine {
  description: string;
  amountCents: number;
}

function parseAddonsJson(raw: string | undefined): AddonLine[] | null {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((a) => ({
      description: String(a.description ?? "").trim(),
      amountCents: Math.round(Number(a.amountCents) || 0),
    }));
  } catch {
    return null;
  }
}

/**
 * Logs a real, itemized dealer offer into qualifying_offers -- optionally in
 * the same submission as any itemized add-on lines (offer_addons) and an
 * offer-sheet PDF (documents, type 'offer_sheet'), when the agent used the
 * AI-parse step (offer-parsing-actions.ts) that pre-fills this form. Nothing
 * about parsing itself ever persists -- this is still the only write path,
 * exactly as before extending it, just now able to take addons/a PDF in the
 * same call instead of requiring separate follow-up steps. Never touches
 * delivered_at or status — those belong to the customer dashboard/24h
 * response-window flow. Re-checks agent auth here rather than trusting the
 * calling page's own gate.
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
  // Both optional -- feeds the customer-facing offer card's photo/value
  // display (see the migration header on qualifying_offers.vehicle_trim/
  // vehicle_exterior_color). Left blank when the agent doesn't know the
  // exact trim/color yet; the offer card falls back to a generic
  // placeholder in that case, same as it always has.
  const vehicleTrim = formData.get("vehicle_trim")?.toString().trim() || null;
  const vehicleExteriorColor = formData.get("vehicle_exterior_color")?.toString().trim() || null;
  // Optional, copied onto the offer at log time for the customer's offer
  // detail view (address + ZIP-centroid distance, VIN, stock #). Pre-filled
  // client-side from a linked listing; typed otherwise.
  const dealerStreet = formData.get("dealer_street")?.toString().trim() || null;
  const dealerCity = formData.get("dealer_city")?.toString().trim() || null;
  const dealerState = formData.get("dealer_state")?.toString().trim().toUpperCase() || null;
  const dealerZip = formData.get("dealer_zip")?.toString().trim() || null;
  const vin = formData.get("vin")?.toString().trim().toUpperCase() || null;
  const stockNumber = formData.get("stock_number")?.toString().trim() || null;
  const offerPriceRaw = formData.get("offer_price")?.toString();
  const msrpRaw = formData.get("msrp")?.toString();
  const notes = formData.get("notes")?.toString().trim() || null;
  const addons = parseAddonsJson(formData.get("addons_json")?.toString());
  const pdf = formData.get("offer_sheet_pdf");

  if (!customerSearchId || !dealerName || !offerPriceRaw || !msrpRaw) {
    return { ok: false, error: "Dealer name, offer price, and MSRP are required." };
  }
  if (addons === null) {
    return { ok: false, error: "Invalid add-on data." };
  }
  // Mirrors the qualifying_offers_dealer_zip_format check constraint, so a
  // bad ZIP gets a readable error instead of a raw constraint violation.
  if (dealerZip && !/^[0-9]{5}$/.test(dealerZip)) {
    return { ok: false, error: "Dealer ZIP must be 5 digits." };
  }
  for (const a of addons) {
    if (!a.description || !Number.isFinite(a.amountCents) || a.amountCents <= 0) {
      return { ok: false, error: "Each add-on needs a description and a positive amount." };
    }
  }
  // Destination is never an add-on: it's already in Total SRP (2026-10-17).
  const destinationRefusal = destinationAddonRefusal(addons.map((a) => a.description));
  if (destinationRefusal) {
    return { ok: false, error: destinationRefusal };
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
    .select("id, customer_id, zip, pickup_travel_choice, pickup_travel_miles")
    .eq("id", customerSearchId)
    .maybeSingle();

  if (searchError || !search) {
    return { ok: false, error: "That search no longer exists." };
  }

  // Delivery estimate (2026-10-10). Standard when the dealer is beyond the
  // customer's pickup range or they prefer delivery -- then the agent must
  // give the fee, mark it requested, or say the dealer doesn't deliver.
  const delivery = parseDeliveryEstimateFields(formData);
  if ("error" in delivery) return { ok: false, error: delivery.error };
  if (!delivery.columns) {
    const travel = travelFromColumns(
      search.pickup_travel_choice as string | null,
      search.pickup_travel_miles as number | null,
    );
    const miles = await zipDistanceMiles(admin, (search.zip as string | null) ?? null, dealerZip);
    if (deliveryEstimateStandard(travel, miles)) {
      return {
        ok: false,
        error:
          "This dealer is beyond the customer's pickup range (or they prefer delivery), so a delivery estimate is standard: enter the dealer's fee, mark it requested from the dealer, or mark that the dealer doesn't deliver.",
      };
    }
  }

  // The dealer's alias (Chunk 2): from the linked listing's dealer identity, or the typed
  // dealer for an off-lot offer. Never fails the offer: left empty if it can't be resolved.
  const dealerAliasId = await resolveOfferDealerAlias(admin, listingId, dealerName, dealerCity, dealerState);

  const { data: newOffer, error: insertError } = await admin
    .from("qualifying_offers")
    .insert({
      customer_search_id: customerSearchId,
      logged_by_agent_id: agent.id,
      dealer_alias_id: dealerAliasId,
      listing_id: listingId,
      dealer_name: dealerName,
      dealer_contact: dealerContact,
      offer_price_cents: offerPriceCents,
      msrp_cents: msrpCents,
      notes,
      vehicle_trim: vehicleTrim,
      vehicle_exterior_color: vehicleExteriorColor,
      dealer_street: dealerStreet,
      dealer_city: dealerCity,
      dealer_state: dealerState,
      dealer_zip: dealerZip,
      vin,
      stock_number: stockNumber,
      ...(delivery.columns ?? {}),
    })
    .select("id")
    .single();

  if (insertError || !newOffer) {
    return { ok: false, error: `Failed to save offer: ${insertError?.message}` };
  }

  await logNotificationEvent({
    customerSearchId,
    eventType: "offer_logged",
    eventData: { dealerName, offerPriceCents, msrpCents },
  });

  // Logged as soon as the offer exists, so a later add-on or PDF failure can't skip it.
  await logAgentActivity(
    agent.id,
    "offer_logged",
    { searchId: customerSearchId, customerId: search.customer_id as string, qualifyingOfferId: newOffer.id, dealerAliasId },
    {
      dealer_name: dealerName,
      offer_price_cents: offerPriceCents,
      msrp_cents: msrpCents,
      addons: addons.map((a) => ({ description: a.description, amount_cents: a.amountCents })),
      offer_sheet_attached: pdf instanceof File && pdf.size > 0,
      ai_parsed: formData.get("ai_parsed") === "1",
    },
  );


  if (addons.length > 0) {
    const { error: addonsError } = await admin.from("offer_addons").insert(
      addons.map((a) => ({
        qualifying_offer_id: newOffer.id,
        description: a.description,
        amount_cents: a.amountCents,
      }))
    );
    if (addonsError) {
      return {
        ok: false,
        error: `Offer saved, but add-ons failed to save: ${addonsError.message}. Add them individually below.`,
      };
    }
  }

  if (pdf instanceof File && pdf.size > 0) {
    const path = `${newOffer.id}/${randomUUID()}-${pdf.name}`;
    const { error: uploadError } = await admin.storage.from("documents").upload(path, pdf, {
      contentType: pdf.type || undefined,
    });
    if (uploadError) {
      return {
        ok: false,
        error: `Offer saved, but the offer-sheet PDF failed to upload: ${uploadError.message}.`,
      };
    }

    const { error: docError } = await admin.from("documents").insert({
      qualifying_offer_id: newOffer.id,
      type: "offer_sheet",
      storage_path: path,
      uploaded_at: new Date().toISOString(),
    });
    if (docError) {
      return {
        ok: false,
        error: `Offer saved, but the offer-sheet record failed to save: ${docError.message}.`,
      };
    }
  }

  revalidatePath("/internal/outreach");
  return { ok: true };
}

async function resolveOfferDealerAlias(
  admin: ReturnType<typeof createAdminClient>,
  listingId: string | null,
  dealerName: string,
  dealerCity: string | null,
  dealerState: string | null,
): Promise<string | null> {
  try {
    if (listingId) {
      const { data: listing } = await admin
        .from("listings")
        .select("dealer_name, dealer_city, dealer_state, mc_dealer_id")
        .eq("id", listingId)
        .maybeSingle();
      if (listing?.dealer_name) {
        return await getOrCreateDealerAlias(
          listing.dealer_name as string,
          (listing.dealer_city as string | null) ?? null,
          (listing.dealer_state as string | null) ?? null,
          (listing.mc_dealer_id as number | null) ?? null,
        );
      }
    }
    return await getOrCreateDealerAlias(dealerName, dealerCity, dealerState, null);
  } catch (e) {
    console.error("logQualifyingOffer: dealer alias not resolved", e instanceof Error ? e.message : e);
    return null;
  }
}

/** The activity-log links for an offer: its search and customer. Null links if not found. */
// Two plain reads: an embedded join is ambiguous here (customer_searches also points back at
// qualifying_offers through purchased_qualifying_offer_id), and PostgREST refuses it.
async function offerLinks(admin: ReturnType<typeof createAdminClient>, offerId: string) {
  const { data } = await admin.from("qualifying_offers").select("customer_search_id").eq("id", offerId).maybeSingle();
  const searchId = (data?.customer_search_id as string | undefined) ?? null;
  const links = searchId ? await searchLinks(admin, searchId) : { searchId: null, customerId: null };
  return { qualifyingOfferId: offerId, ...links };
}

/** The activity-log links for a search: the search and its customer. */
async function searchLinks(admin: ReturnType<typeof createAdminClient>, searchId: string) {
  const { data } = await admin.from("customer_searches").select("customer_id").eq("id", searchId).maybeSingle();
  return { searchId, customerId: (data?.customer_id as string | undefined) ?? null };
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

  await logAgentActivity(agent.id, "offer_vehicle_marked_sold", await offerLinks(admin, offerId));

  revalidatePath("/internal/outreach");
  return { ok: true };
}

export interface MarkSearchPurchasedResult {
  ok: boolean;
  error?: string;
}

/**
 * Purchased celebratory state (Part 3, plan.md) -- agent-marked only, no
 * Stripe automation, purely a judgment call during deal-close. Flips
 * search_status to 'purchased', which /account renders as
 * PurchasedCelebration instead of the normal offer-tracking UI. Guarded by
 * .eq("search_status", "searching") on the write -- idempotent against a
 * double-click, and refuses to fire on a search that isn't actually active
 * (already cancelled, already purchased, etc.).
 *
 * Gated on real deal data (2026-08-21) -- requires deal_progress for this
 * specific offer to show both availability_reconfirmed_at and
 * deposit_confirmed_at before allowing the flip. financing_choice is
 * deliberately not required -- financing can legitimately still be in
 * progress at deal-close. offerId (not just searchId) is required because
 * deal_progress keys off qualifying_offer_id, not search_id -- looking this
 * up by "the accepted offer for this search" instead would be ambiguous if
 * more than one offer on a search were ever independently accepted; the
 * caller already has the specific offer in scope (this button renders
 * inline per-offer), so it's passed through explicitly instead of guessed.
 *
 * The offer itself is verified too (2026-09-24): it must belong to this
 * search and still be customer_accepted. deal_progress alone isn't enough
 * -- a released (withdrawn) offer keeps its deal_progress history, and
 * "deposit confirmed, then the deal fell through" is exactly the case where
 * a withdrawn offer carries full availability + deposit confirmation. A
 * stale tab showing this button must not be able to mark that offer
 * purchased.
 */
export async function markSearchPurchased(searchId: string, offerId: string): Promise<MarkSearchPurchasedResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();

  const { data: offer, error: offerError } = await admin
    .from("qualifying_offers")
    .select("customer_search_id, status, dealer_name")
    .eq("id", offerId)
    .maybeSingle();

  if (offerError || !offer) {
    return { ok: false, error: "That offer no longer exists." };
  }
  if (offer.customer_search_id !== searchId) {
    return { ok: false, error: "That offer doesn't belong to this search." };
  }
  if (offer.status !== "customer_accepted") {
    return { ok: false, error: "Only an accepted offer can be marked purchased." };
  }

  const { data: progress, error: progressError } = await admin
    .from("deal_progress")
    .select("availability_reconfirmed_at, deposit_confirmed_at")
    .eq("qualifying_offer_id", offerId)
    .maybeSingle();

  if (progressError) {
    return { ok: false, error: `Failed to check deal progress: ${progressError.message}` };
  }
  if (!progress?.availability_reconfirmed_at || !progress?.deposit_confirmed_at) {
    return {
      ok: false,
      error: "Both availability reconfirmation and deposit confirmation are required before marking purchased.",
    };
  }

  const { data: updated, error: updateError } = await admin
    .from("customer_searches")
    .update({
      search_status: "purchased",
      purchased_at: new Date().toISOString(),
      purchased_qualifying_offer_id: offerId,
    })
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

  await logNotificationEvent({
    customerSearchId: searchId,
    eventType: "search_purchased",
    eventData: { dealerName: offer.dealer_name ?? "the dealership" },
  });

  const { error: logError } = await admin
    .from("purchase_status_log")
    .insert({ search_id: searchId, agent_id: agent.id, action: "marked_purchased", reason: null });
  if (logError) {
    console.error("Failed to log purchase status change:", logError);
  }

  await logAgentActivity(
    agent.id,
    "search_marked_purchased",
    await offerLinks(admin, offerId),
    { dealer_name: offer.dealer_name ?? null },
  );

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}

export interface RevertPurchasedSearchResult {
  ok: boolean;
  error?: string;
}

/**
 * Reverses markSearchPurchased -- only legal from 'purchased', flips back
 * to 'searching', and deliberately leaves deal_progress untouched (if the
 * same deal comes back together, an already-confirmed deposit/availability
 * doesn't need re-collecting). reason is required -- this is a real
 * judgment call worth a note, unlike the confirm-popup-only forward action.
 */
export async function revertPurchasedSearch(searchId: string, reason: string): Promise<RevertPurchasedSearchResult> {
  const agent = await getAuthorizedAgent({ minRole: "lead" });
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  if (!reason || reason.trim() === "") {
    return { ok: false, error: "A reason is required." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("revert_purchased_search", {
    p_search_id: searchId,
    p_agent_id: agent.id,
    p_reason: reason.trim(),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}

export interface WithdrawAcceptedOfferResult {
  ok: boolean;
  error?: string;
}

/**
 * Releases an accepted offer whose deal fell through (dealer sold the car,
 * financing collapsed, ...) by moving it to 'withdrawn'. Required because
 * respondToOffer allows at most one accepted offer per search and nothing
 * else ever un-accepts one -- without this, a customer whose deal fell
 * through could never accept another offer on that search.
 *
 * Agent-only, reason required. Refused on a purchased search: the agent
 * reverts the purchase first (revertPurchasedSearch), so
 * purchased_qualifying_offer_id can never end up pointing at a withdrawn
 * offer. Guarded by .eq("status", "customer_accepted") on the write, so a
 * double-click is a clean no-op.
 *
 * Writes ONLY status + the three withdrawn_* columns. customer_responded_at,
 * delivered_at and vehicle_sold_at are left exactly as they were -- the
 * Day-30 guarantee evaluation reads those (never status), so a release can't
 * change a guarantee outcome. deal_progress, documents and add-ons are kept
 * as history; every action on them already requires customer_accepted, so
 * they simply go inert. One-way: if the deal comes back together, the agent
 * logs it as a new offer.
 *
 * Known, accepted limitation: two agents acting at the same instant
 * (one releasing, one marking the search purchased) could still interleave
 * between the purchased check and the write. Only one agent exists today;
 * fully closing this would need a row-locking RPC.
 */
export async function withdrawAcceptedOffer(offerId: string, reason: string): Promise<WithdrawAcceptedOfferResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    return { ok: false, error: "A reason is required." };
  }

  const admin = createAdminClient();

  const { data: offer, error: offerError } = await admin
    .from("qualifying_offers")
    .select("id, customer_search_id, status, dealer_name")
    .eq("id", offerId)
    .maybeSingle();

  if (offerError || !offer) {
    return { ok: false, error: "That offer no longer exists." };
  }
  if (offer.status !== "customer_accepted") {
    return { ok: false, error: "Only an accepted offer can be released." };
  }

  const { data: search, error: searchError } = await admin
    .from("customer_searches")
    .select("search_status")
    .eq("id", offer.customer_search_id)
    .maybeSingle();

  if (searchError || !search) {
    return { ok: false, error: "That search no longer exists." };
  }
  if (search.search_status === "purchased") {
    return {
      ok: false,
      error: "This search is marked purchased — revert the purchase first, then release the offer.",
    };
  }

  const { data: updated, error: updateError } = await admin
    .from("qualifying_offers")
    .update({
      status: "withdrawn",
      withdrawn_at: new Date().toISOString(),
      withdrawn_by_agent_id: agent.id,
      withdrawal_reason: trimmedReason,
    })
    .eq("id", offerId)
    .eq("status", "customer_accepted")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: `Failed to release the offer: ${updateError.message}` };
  }
  if (!updated) {
    return { ok: false, error: "This offer is no longer accepted." };
  }

  // Highlight (2026-09-27): before this the customer was told nothing when
  // their accepted offer was released. The agent's reason stays agent-only.
  await logNotificationEvent({
    customerSearchId: offer.customer_search_id as string,
    eventType: "offer_withdrawn",
    eventData: { dealerName: (offer.dealer_name as string | null) ?? "the dealership" },
  });

  await logAgentActivity(agent.id, "offer_released", await offerLinks(admin, offerId), { reason: trimmedReason });

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  revalidatePath("/account/deal");
  return { ok: true };
}

export interface MarkOfferActivityReviewedResult {
  ok: boolean;
  error?: string;
}

/**
 * "Mark reviewed" in the agent's "Customer activity on offers" section.
 * seenActivityAt is the customer_activity_at the agent's page was showing;
 * the write only lands if it's still current, so a highlight/note/decline
 * that arrives after the page loaded can't be marked reviewed unseen --
 * the agent is told to refresh instead.
 */
export async function markOfferActivityReviewed(
  offerId: string,
  seenActivityAt: string
): Promise<MarkOfferActivityReviewedResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("qualifying_offers")
    .update({ agent_reviewed_at: new Date().toISOString() })
    .eq("id", offerId)
    .eq("customer_activity_at", seenActivityAt)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: `Failed to mark reviewed: ${error.message}` };
  }
  if (!updated) {
    return { ok: false, error: "The customer changed this since the page loaded — refresh to see the latest." };
  }

  await logAgentActivity(agent.id, "activity_reviewed", await offerLinks(admin, offerId), { thread: "offer" });

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
  const destinationRefusal = destinationAddonRefusal([description]);
  if (destinationRefusal) {
    return { ok: false, error: destinationRefusal };
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

  const { data: addon, error: insertError } = await admin
    .from("offer_addons")
    .insert({
      qualifying_offer_id: offerId,
      description,
      amount_cents: amountCents,
    })
    .select("id")
    .single();

  if (insertError || !addon) {
    return { ok: false, error: `Failed to save add-on: ${insertError?.message}` };
  }

  await logAgentActivity(agent.id, "offer_addon_added", await offerLinks(admin, offerId), {
    addon_id: addon.id,
    description,
    amount_cents: amountCents,
  });

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
    .select("id, qualifying_offer_id, description")
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: `Failed to save resolution: ${updateError.message}` };
  }
  if (!updated) {
    return { ok: false, error: "This request is no longer pending." };
  }

  await logAgentActivity(agent.id, "addon_removal_resolved", await offerLinks(admin, updated.qualifying_offer_id as string), {
    addon_id: addonId,
    description: updated.description,
    outcome,
    dealer_response: dealerResponse,
  });

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}

async function getAcceptedOfferOrError(admin: ReturnType<typeof createAdminClient>, offerId: string) {
  const { data: offer, error } = await admin
    .from("qualifying_offers")
    .select("id, status, customer_search_id, dealer_name")
    .eq("id", offerId)
    .maybeSingle();

  if (error || !offer) {
    return { ok: false as const, error: "That offer no longer exists." };
  }
  if (offer.status !== "customer_accepted") {
    return { ok: false as const, error: "This offer hasn't been accepted yet." };
  }
  return { ok: true as const, customerSearchId: offer.customer_search_id, dealerName: offer.dealer_name };
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
    {
      qualifying_offer_id: offerId,
      availability_reconfirmed_at: new Date().toISOString(),
      availability_confirmed_by_agent_id: agent.id,
    },
    { onConflict: "qualifying_offer_id" }
  );

  if (error) {
    return { ok: false, error: `Failed to confirm availability: ${error.message}` };
  }

  await logNotificationEvent({
    customerSearchId: offerCheck.customerSearchId,
    eventType: "deal_progress_update",
    eventData: { dealerName: offerCheck.dealerName, milestone: "availability_reconfirmed" },
  });

  await logAgentActivity(agent.id, "availability_confirmed", await offerLinks(admin, offerId));

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
      deposit_confirmed_by_agent_id: agent.id,
    },
    { onConflict: "qualifying_offer_id" }
  );

  if (error) {
    return { ok: false, error: `Failed to confirm deposit: ${error.message}` };
  }

  await logNotificationEvent({
    customerSearchId: offerCheck.customerSearchId,
    eventType: "deal_progress_update",
    eventData: { dealerName: offerCheck.dealerName, milestone: "deposit_confirmed" },
  });

  await logAgentActivity(agent.id, "deposit_confirmed", await offerLinks(admin, offerId), { amount_cents: amountCents });

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
    await logAgentActivity(agent.id, "signing_status_checked", await offerLinks(admin, offerId), { signed: true, recorded_now: false });
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
    await logAgentActivity(agent.id, "signing_status_checked", await offerLinks(admin, offerId), { signed: false, provider_status: status });
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

  await logAgentActivity(agent.id, "signing_status_checked", await offerLinks(admin, offerId), { signed: true, recorded_now: true });

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
  details: {
    trim: string;
    colors: string[];
    requiredOptions: string[];
    /**
     * Only read when the search has NO committed year yet (a row predating
     * 2026-09-14). A search that already has one keeps it -- finalizing is
     * not a vehicle change, and this action must not become a back door
     * around the customer's own commitment.
     */
    modelYear?: number | null;
  }
): Promise<FinalizeByAgentResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();

  const { data: search, error: fetchError } = await admin
    .from("customer_searches")
    .select("make, model, model_year, search_status, paid_at")
    .eq("id", searchId)
    .maybeSingle();
  if (fetchError || !search) {
    return { ok: false, error: "That search no longer exists." };
  }
  if (search.search_status !== "awaiting_finalization") {
    return { ok: false, error: "This search is no longer awaiting finalization." };
  }
  // Payment before finalizing (2026-09-30), enforced here too.
  if (!search.paid_at) {
    return { ok: false, error: "This search hasn't been paid for yet." };
  }

  // Year is required from 2026-09-14. A search that predates that has none,
  // and an agent finalizing it is the last chance to commit one before the
  // search runs -- so the agent must pick it here, validated against the
  // live dataset exactly as every customer surface is.
  let yearToWrite: number | null = null;
  if (search.model_year == null) {
    const year = details.modelYear;
    if (year == null || !Number.isInteger(year)) {
      return { ok: false, error: "Choose a model year for this vehicle." };
    }
    if (!search.make || !search.model || !(await isOfferedModelYear(search.make, search.model, year))) {
      return { ok: false, error: "Pick a make, model, and model year from the list." };
    }
    yearToWrite = year;
  }

  // Zero-inventory block -- NO AGENT EXEMPTION (Brett, 2026-09-14). An
  // agent is held to exactly the same rule as the customer. Null while the
  // switch is off.
  const block = await loadInventoryBlock(search.make, search.model, yearToWrite ?? search.model_year);
  if (block) {
    return { ok: false, error: AGENT_INVENTORY_BLOCK_REFUSAL };
  }

  const { data: updated, error } = await admin
    .from("customer_searches")
    .update({
      trim: details.trim || null,
      colors: details.colors,
      required_options: details.requiredOptions,
      finalized_at: new Date().toISOString(),
      search_status: "pending_refinement",
      ...(yearToWrite != null ? { model_year: yearToWrite } : {}),
    })
    .eq("id", searchId)
    .eq("search_status", "awaiting_finalization")
    .not("paid_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: `Failed to finalize: ${error.message}` };
  }
  if (!updated) {
    return { ok: false, error: "This search is no longer awaiting finalization." };
  }

  await logAgentActivity(agent.id, "search_finalized_by_agent", await searchLinks(admin, searchId), {
    trim: details.trim || null,
    colors: details.colors,
    required_options: details.requiredOptions,
    ...(yearToWrite != null ? { model_year: yearToWrite } : {}),
  });

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}

export interface FinalizeUndecidedSearchResult {
  ok: boolean;
  error?: string;
}

/**
 * The one-combined-call path for a search that started with no make/model
 * (the "not sure yet" intake path). Sets make/model AND finalizes trim/
 * color/options together in one action, decided 2026-08-19 -- unlike the
 * normal finalization flow, there's no separate "pick a vehicle" step
 * first since nothing was synced yet. Trim is freeform text here (not
 * pulled from MarketCheck listings, since none exist for this make/model
 * until this action runs) -- mirrors the existing custom-trim escape hatch
 * already used elsewhere in the finalize forms.
 */
export async function finalizeUndecidedSearch(
  searchId: string,
  input: {
    make: string;
    model: string;
    modelYear: number | null;
    trim: string;
    colors: string[];
    requiredOptions: string[];
    /** Pickup-range tile value, asked on the consultation call (2026-09-26). */
    pickupTravel: string | null;
  }
): Promise<FinalizeUndecidedSearchResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  // Make, model AND year validated together against the live dataset
  // (2026-09-14). Before this the server accepted whatever strings the form
  // posted -- the dropdowns only constrained the browser, so a stale or
  // crafted request could create a search for a vehicle that does not
  // exist -- and nothing ever set a year.
  const make = input.make?.trim() ?? "";
  const model = input.model?.trim() ?? "";
  if (!make || !model) {
    return { ok: false, error: "Make and model are both required." };
  }
  if (input.modelYear == null || !Number.isInteger(input.modelYear)) {
    return { ok: false, error: "Choose a model year for this vehicle." };
  }
  if (!(await isOfferedModelYear(make, model, input.modelYear))) {
    return { ok: false, error: "Pick a make, model, and model year from the list." };
  }
  // Required here because this path skipped intake's question entirely --
  // the search can't start without it.
  const travel = travelFromValue(input.pickupTravel);
  if (!travel) {
    return { ok: false, error: "Choose how far the customer would drive to pick up the car." };
  }

  // Zero-inventory block, no agent exemption. An undecided search has no
  // inventory fetched for the chosen vehicle yet, so with the block on the
  // sync runs FIRST -- otherwise every never-synced model would read as
  // empty. Off: the sync stays after the save, exactly as before.
  if (MODEL_YEAR_INVENTORY_BLOCK_ENABLED) {
    try {
      await syncListingsForMakeModel(make, model);
    } catch (syncError) {
      console.error(`finalizeUndecidedSearch: pre-check sync failed for ${make} ${model}:`, syncError);
    }
    const block = await loadInventoryBlock(make, model, input.modelYear);
    if (block) {
      return { ok: false, error: AGENT_INVENTORY_BLOCK_REFUSAL };
    }
  }

  const admin = createAdminClient();

  const { data: updated, error } = await admin
    .from("customer_searches")
    .update({
      make,
      model,
      model_year: input.modelYear,
      trim: input.trim,
      colors: input.colors,
      required_options: input.requiredOptions,
      ...travelToColumns(travel),
      pickup_travel_set_at: new Date().toISOString(),
      finalized_at: new Date().toISOString(),
      search_status: "pending_refinement",
    })
    .eq("id", searchId)
    .is("make", null) // guard: only ever applies to a genuinely undecided row
    // ...that's paid and still waiting to be finalized (2026-09-30).
    .eq("search_status", "awaiting_finalization")
    .not("paid_at", "is", null)
    .select("id");

  if (error) {
    return { ok: false, error: `Failed to save: ${error.message}` };
  }
  // The guard above makes a stale form a SILENT no-op: zero rows match, no
  // error is raised, and this used to report success anyway -- telling an
  // agent a vehicle was saved when nothing changed. Checked explicitly now.
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error: "Nothing was saved — this search already has a vehicle, isn't paid for, or no longer exists. Refresh the queue.",
    };
  }

  await logAgentActivity(agent.id, "undecided_search_finalized", await searchLinks(admin, searchId), {
    make,
    model,
    model_year: input.modelYear,
    trim: input.trim,
    colors: input.colors,
    required_options: input.requiredOptions,
    pickup_travel: input.pickupTravel,
  });

  // Same on-demand sync the webhook normally does at payment time for a
  // known make/model -- this is the first point real inventory data is
  // possible for this search.
  if (!MODEL_YEAR_INVENTORY_BLOCK_ENABLED) {
    try {
      await syncListingsForMakeModel(make, model);
    } catch (syncError) {
      console.error(`finalizeUndecidedSearch: sync failed for ${make} ${model}:`, syncError);
    }
  }

  revalidatePath("/internal/outreach");
  return { ok: true };
}

export interface ResolveNotificationCallbackResult {
  ok: boolean;
  error?: string;
}

/**
 * Dismisses one notification_events row from the callback queue --
 * covers both reasons it can appear there (a real callback request or a
 * flagged undeliverable channel), same shared flag_resolved_at column.
 * Guarded by .is("flag_resolved_at", null) on the write, same idempotency
 * idiom as every other resolve-style action here.
 */
export async function resolveNotificationCallback(eventId: string): Promise<ResolveNotificationCallbackResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("notification_events")
    .update({ flag_resolved_at: new Date().toISOString(), flag_resolved_by_agent_id: agent.id })
    .eq("id", eventId)
    .is("flag_resolved_at", null)
    .select("id, customer_id, customer_search_id, event_type");

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Already resolved." };
  }

  await logAgentActivity(
    agent.id,
    "notification_flag_resolved",
    { searchId: updated[0].customer_search_id as string, customerId: updated[0].customer_id as string },
    { notification_event_id: eventId, event_type: updated[0].event_type },
  );

  revalidatePath("/internal/outreach");
  return { ok: true };
}

// ---- Delivery estimates (2026-10-10) ------------------------------------

type DeliveryColumns = Record<string, string | number | null>;

/** The agent's delivery-estimate fields as columns, null when left as "None". */
function parseDeliveryEstimateFields(formData: FormData): { columns: DeliveryColumns | null } | { error: string } {
  const mode = formData.get("delivery_mode")?.toString() ?? "";
  const note = formData.get("delivery_note")?.toString().trim().slice(0, 500) || null;
  const now = new Date().toISOString();
  if (mode === "") return { columns: null };
  if (mode === "requested") {
    return {
      columns: {
        delivery_estimate_status: "requested",
        delivery_estimate_cents: null,
        delivery_estimate_note: null,
        delivery_estimate_requested_at: now,
        delivery_estimate_requested_by: "agent",
        delivery_estimate_provided_at: null,
      },
    };
  }
  if (mode === "unavailable") {
    return {
      columns: {
        delivery_estimate_status: "unavailable",
        delivery_estimate_cents: null,
        delivery_estimate_note: note,
        delivery_estimate_provided_at: now,
      },
    };
  }
  if (mode === "fee") {
    const cents = Math.round(parseFloat(formData.get("delivery_fee")?.toString() ?? "") * 100);
    if (!Number.isFinite(cents) || cents < 0) return { error: "Enter the dealer's delivery fee (0 for free delivery)." };
    return {
      columns: {
        delivery_estimate_status: "provided",
        delivery_estimate_cents: cents,
        delivery_estimate_note: note,
        delivery_estimate_provided_at: now,
      },
    };
  }
  return { error: "Invalid delivery estimate choice." };
}

/** ZIP-centroid distance in miles, null when either ZIP is unknown. */
async function zipDistanceMiles(
  admin: ReturnType<typeof createAdminClient>,
  zipA: string | null,
  zipB: string | null,
): Promise<number | null> {
  if (!zipA || !zipB) return null;
  const { data } = await admin.from("zip_coordinates").select("zip, latitude, longitude").in("zip", [zipA, zipB]);
  const a = data?.find((z) => z.zip === zipA);
  const b = data?.find((z) => z.zip === zipB);
  if (!a || !b) return null;
  return haversineMiles(a.latitude as number, a.longitude as number, b.latitude as number, b.longitude as number);
}

export interface SetDeliveryEstimateResult {
  ok: boolean;
  error?: string;
}

/**
 * Agent records (or updates) an offer's delivery estimate after logging it:
 * the dealer's fee, that it's been requested, or that the dealer doesn't
 * deliver. Overwrites the previous answer (one estimate per offer). Only on
 * an offer that's still open.
 */
export async function setOfferDeliveryEstimate(formData: FormData): Promise<SetDeliveryEstimateResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) return { ok: false, error: "Not authorized." };
  const offerId = formData.get("offer_id")?.toString();
  if (!offerId) return { ok: false, error: "Missing offer." };
  const parsed = parseDeliveryEstimateFields(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  if (!parsed.columns) return { ok: false, error: "Choose the fee, requested, or doesn't deliver." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qualifying_offers")
    .update(parsed.columns)
    .eq("id", offerId)
    .in("status", ["pending", "customer_accepted"])
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: `Failed to save: ${error.message}` };
  if (!data) return { ok: false, error: "That offer is no longer open." };

  await logAgentActivity(agent.id, "delivery_estimate_set", await offerLinks(admin, offerId), {
    status: parsed.columns.delivery_estimate_status,
    cents: parsed.columns.delivery_estimate_cents ?? null,
    note: parsed.columns.delivery_estimate_note ?? null,
  });

  revalidatePath("/internal/outreach");
  revalidatePath("/account/deal");
  return { ok: true };
}

export type RefreshInventoryResult =
  | { ok: true; refreshed: true; upserted: number; lastSyncedAt: string }
  | { ok: true; refreshed: false; lastSyncedAt: string }
  | { ok: false; error: string };

/**
 * Agent "Refresh inventory" on an active search card (2026-10-11, approved
 * by Brett). Re-pulls the search's make/model from MarketCheck between the
 * scheduled every-3-days refreshes -- but at most once per model per day:
 * the same 24h window every on-demand sync uses, so one refresh serves every
 * search on that model and repeat clicks cost no MarketCheck calls.
 */
export async function refreshSearchInventory(searchId: string): Promise<RefreshInventoryResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data: search, error } = await admin
    .from("customer_searches")
    .select("make, model")
    .eq("id", searchId)
    .maybeSingle();
  if (error) return { ok: false, error: `Failed to load the search: ${error.message}` };
  if (!search?.make || !search?.model) return { ok: false, error: "This search has no vehicle yet." };

  try {
    const result = await syncListingsForMakeModel(search.make, search.model, {
      freshWithinHours: DEFAULT_FRESH_WITHIN_HOURS,
    });
    await logAgentActivity(agent.id, "inventory_refreshed", await searchLinks(admin, searchId), {
      make: search.make,
      model: search.model,
      refreshed: !result.skipped,
      upserted: result.skipped ? 0 : result.upserted,
    });
    revalidatePath("/internal/outreach");
    return result.skipped
      ? { ok: true, refreshed: false, lastSyncedAt: result.lastSyncedAt }
      : { ok: true, refreshed: true, upserted: result.upserted, lastSyncedAt: result.lastSyncedAt };
  } catch (syncError) {
    return {
      ok: false,
      error: `MarketCheck refresh failed: ${syncError instanceof Error ? syncError.message : "unknown error"}`,
    };
  }
}
