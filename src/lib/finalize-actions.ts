"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type FinalizeResult = { ok: true } | { ok: false; error: string };

async function getOwnedAwaitingFinalizationSearch(searchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Not signed in." };
  }

  const { data: search, error } = await supabase
    .from("customer_searches")
    .select("id, search_status")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (error || !search) {
    return { ok: false as const, error: "That search doesn't exist." };
  }
  if (search.search_status !== "awaiting_finalization") {
    return { ok: false as const, error: "This search has already been finalized." };
  }

  return { ok: true as const };
}

/**
 * Customer chooses the call path on /finalize -- just marks the intent so
 * an agent can follow up manually (surfaces in /internal/outreach, see
 * getFinalizationQueue in outreach-queue.ts). No real calendar/scheduling
 * integration yet, deliberately (see roadmap "Call scheduling" note) -- a
 * human reaches out the same way outreach and switching already work.
 */
export async function requestFinalizationCall(searchId: string): Promise<FinalizeResult> {
  const check = await getOwnedAwaitingFinalizationSearch(searchId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_searches")
    .update({ call_requested_at: new Date().toISOString() })
    .eq("id", searchId)
    .eq("search_status", "awaiting_finalization")
    .is("call_requested_at", null);

  if (error) {
    return { ok: false, error: `Failed to request a call: ${error.message}` };
  }

  revalidatePath(`/finalize/${searchId}`);
  revalidatePath("/internal/outreach");
  return { ok: true };
}

export type FinalizeDetails = {
  trim: string;
  colors: string[];
  requiredOptions: string[];
};

/**
 * Self-service finalization -- the explicit "this confirms exactly what
 * we'll search for" action (Step 5 of the pending-pivot's "Full flow").
 * This is what actually starts the 24h self-edit window: sets finalized_at
 * and flips search_status to 'pending_refinement', which now means
 * "finalized, window open" rather than its old pre-payment meaning.
 * solidify-pending-searches (search-solidification.ts) anchors off
 * finalized_at, not paid_at, to close that window later.
 */
export async function finalizeSelfService(
  searchId: string,
  details: FinalizeDetails
): Promise<FinalizeResult> {
  const check = await getOwnedAwaitingFinalizationSearch(searchId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_searches")
    .update({
      trim: details.trim || null,
      colors: details.colors,
      required_options: details.requiredOptions,
      finalized_at: new Date().toISOString(),
      search_status: "pending_refinement",
    })
    .eq("id", searchId)
    .eq("search_status", "awaiting_finalization");

  if (error) {
    return { ok: false, error: `Failed to finalize: ${error.message}` };
  }

  revalidatePath("/account");
  revalidatePath(`/finalize/${searchId}`);
  return { ok: true };
}

/**
 * Self-edit during the 24h window (Step 7a) -- same fields as finalization,
 * but deliberately does NOT touch finalized_at. The window is anchored to
 * the original finalize timestamp and does not reset on edit, so a customer
 * 12 hours in who makes a change stays at 12 hours remaining, not back to
 * 24 -- otherwise the window could be gamed into an indefinite loop via
 * repeated last-minute edits.
 *
 * Relies on search_status = 'pending_refinement' as the gate, same as every
 * other window-dependent action in this codebase (e.g. respondToOffer on
 * status = 'pending') -- there's a small, accepted lag window (up to ~1h,
 * the solidify cron's own cadence) where finalized_at + 24h has technically
 * elapsed but the cron hasn't flipped search_status yet. Not treated as a
 * bug: it's the same tolerance every hourly-cron-gated action in this app
 * already has.
 */
export async function updateFinalizedSearch(
  searchId: string,
  details: FinalizeDetails
): Promise<FinalizeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: search, error: fetchError } = await supabase
    .from("customer_searches")
    .select("id, search_status")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (fetchError || !search) {
    return { ok: false, error: "That search doesn't exist." };
  }
  if (search.search_status !== "pending_refinement") {
    return { ok: false, error: "This search is no longer open for edits." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_searches")
    .update({
      trim: details.trim || null,
      colors: details.colors,
      required_options: details.requiredOptions,
    })
    .eq("id", searchId)
    .eq("search_status", "pending_refinement");

  if (error) {
    return { ok: false, error: `Failed to save changes: ${error.message}` };
  }

  revalidatePath("/account");
  return { ok: true };
}
