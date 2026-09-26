"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";

export interface OfferHighlightResult {
  ok: boolean;
  error?: string;
}

const NOTE_MAX_LENGTH = 500;

// Owner check shared by both actions. Status is re-checked by each write's
// own .eq("status", "pending") guard, not just here -- an offer accepted,
// declined or released between page load and click must stay frozen.
async function verifyOwnedOffer(offerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: offer } = await admin
    .from("qualifying_offers")
    .select("id, customer_search_id")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return { ok: false as const, error: "That offer no longer exists." };

  const { data: search } = await admin
    .from("customer_searches")
    .select("customer_id")
    .eq("id", offer.customer_search_id)
    .maybeSingle();
  if (!search || search.customer_id !== user.id) return { ok: false as const, error: "Not authorized." };

  return { ok: true as const, admin };
}

function revalidate() {
  revalidatePath("/account/deal");
  revalidatePath("/internal/outreach");
}

/**
 * Highlight ("interested, not ready to commit") on/off for a pending offer.
 * Independent of the note. Bumps customer_activity_at so the change
 * surfaces in the agent's "Customer activity on offers" section -- the
 * stand-in for an email/SMS, deliberately never sent.
 */
export async function setOfferHighlight(offerId: string, highlighted: boolean): Promise<OfferHighlightResult> {
  const check = await verifyOwnedOffer(offerId);
  if (!check.ok) return check;

  const now = new Date().toISOString();
  const { data: updated, error } = await check.admin
    .from("qualifying_offers")
    .update({ customer_highlighted_at: highlighted ? now : null, customer_activity_at: now })
    .eq("id", offerId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: `Failed to save: ${error.message}` };
  if (!updated) return { ok: false, error: "You can only highlight an offer you haven't responded to yet." };

  revalidate();
  return { ok: true };
}

/**
 * Sets, edits or clears (empty string) the customer's note on a pending
 * offer. Max 500 characters, enforced here and by a DB check constraint.
 */
export async function setOfferNote(offerId: string, note: string): Promise<OfferHighlightResult> {
  const trimmed = (note ?? "").trim();
  if (trimmed.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: `Notes can be up to ${NOTE_MAX_LENGTH} characters.` };
  }

  const check = await verifyOwnedOffer(offerId);
  if (!check.ok) return check;

  const now = new Date().toISOString();
  const { data: updated, error } = await check.admin
    .from("qualifying_offers")
    .update({
      customer_note: trimmed === "" ? null : trimmed,
      customer_note_updated_at: now,
      customer_activity_at: now,
    })
    .eq("id", offerId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: `Failed to save your note: ${error.message}` };
  if (!updated) return { ok: false, error: "You can only add a note to an offer you haven't responded to yet." };

  revalidate();
  return { ok: true };
}
