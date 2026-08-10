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
