"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { threadIsOpen } from "./offer-messages-shared";
import {
  HANDOFF_CLOSED_ERROR,
  PICKUP_TRAVEL_MISSING_ERROR,
  isHandoffMethod,
  travelFromValue,
  travelToColumns,
  type HandoffMethod,
} from "./pickup-travel";

export interface HandoffResult {
  ok: boolean;
  error?: string;
}

// Offers whose pickup/delivery answer can still change: pending or accepted,
// on a search that hasn't ended. Declined/released offers are decided.
const HANDOFF_EDITABLE_STATUSES = ["pending", "customer_accepted"];

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Customer sets pickup vs. delivery on one offer (2026-09-26). The single
 * source of truth -- replaced deal_progress.delivery_method. Counts as
 * customer activity, so the change surfaces in the agent's "Customer
 * activity on offers" section.
 */
export async function setOfferHandoff(offerId: string, method: HandoffMethod): Promise<HandoffResult> {
  if (!isHandoffMethod(method)) return { ok: false, error: "Invalid choice." };
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: offer } = await admin
    .from("qualifying_offers")
    .select("id, status, customer_search_id")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "That offer no longer exists." };
  const { data: search } = await admin
    .from("customer_searches")
    .select("customer_id, search_status")
    .eq("id", offer.customer_search_id)
    .maybeSingle();
  if (!search || search.customer_id !== userId) return { ok: false, error: "Not authorized." };
  if (!HANDOFF_EDITABLE_STATUSES.includes(offer.status as string) || !threadIsOpen(offer.status, search.search_status)) {
    return { ok: false, error: HANDOFF_CLOSED_ERROR };
  }

  const now = new Date().toISOString();
  // Status re-checked as a write condition, so a decline/release landing
  // between the read and the write leaves the offer untouched.
  const { data: updated, error } = await admin
    .from("qualifying_offers")
    .update({ handoff_method: method, handoff_method_set_at: now, customer_activity_at: now })
    .eq("id", offerId)
    .in("status", HANDOFF_EDITABLE_STATUSES)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: `Failed to save: ${error.message}` };
  if (!updated) return { ok: false, error: HANDOFF_CLOSED_ERROR };

  revalidatePath("/account/deal");
  revalidatePath("/internal/outreach");
  return { ok: true };
}

/**
 * Customer sets or changes their search's pickup range from Your Deal --
 * the prompt for searches that predate the intake question, and the
 * "Change" control. Search-level, so it doesn't bump offer activity; agents
 * see the current value on the search card.
 */
export async function setSearchPickupTravel(searchId: string, value: string): Promise<HandoffResult> {
  const travel = travelFromValue(value);
  if (!travel) return { ok: false, error: PICKUP_TRAVEL_MISSING_ERROR };
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("customer_searches")
    .update({ ...travelToColumns(travel), pickup_travel_set_at: new Date().toISOString() })
    .eq("id", searchId)
    .eq("customer_id", userId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: `Failed to save: ${error.message}` };
  if (!updated) return { ok: false, error: "Not authorized." };

  revalidatePath("/account/deal");
  revalidatePath("/internal/outreach");
  return { ok: true };
}
