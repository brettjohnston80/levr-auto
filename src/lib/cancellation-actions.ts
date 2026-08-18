"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CancellationActionResult = { ok: true } | { ok: false; error: string };

// Cancellable at any stage per Brett's confirmed policy (2026-08-17) --
// including after an offer's been accepted and deposit/financing/e-sign is
// already in motion, deliberately no extra gating there. Excludes rows with
// nothing to actually cancel (unpaid) or that are already terminal/superseded.
const CANCELLABLE_STATUSES = ["awaiting_finalization", "pending_refinement", "searching", "paused"];

async function getOwnedCancellableSearch(searchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Not signed in." };
  }

  const { data: search, error } = await supabase
    .from("customer_searches")
    .select("id, search_status, paid_at")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (error || !search) {
    return { ok: false as const, error: "That search doesn't exist." };
  }
  if (!search.paid_at) {
    return { ok: false as const, error: "This search hasn't been paid for yet." };
  }
  if (!CANCELLABLE_STATUSES.includes(search.search_status)) {
    return { ok: false as const, error: "This search can't be cancelled right now." };
  }

  return { ok: true as const };
}

/**
 * Self-service cancellation (Part 1, plan.md) -- final, no refund, ever, no
 * exceptions. Calls cancel_search() with p_initiated_by = 'customer' and no
 * agent/reason -- same RPC Part 2's agent-mediated path uses, just the
 * plain-caller shape (mirrors switch_customer_search/cancel_search both
 * serving a customer and an agent-flavored caller via optional params).
 */
export async function cancelSearch(searchId: string): Promise<CancellationActionResult> {
  const check = await getOwnedCancellableSearch(searchId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  const { error } = await admin.rpc("cancel_search", {
    p_search_id: searchId,
    p_initiated_by: "customer",
  });

  if (error) {
    return { ok: false, error: `Failed to cancel: ${error.message}` };
  }

  revalidatePath("/account");
  return { ok: true };
}

/**
 * Customer chooses "talk to an agent about cancelling" instead of (or
 * before) self-service cancel -- mirrors requestSwitchCall/
 * requestFinalizationCall exactly, including the same guarded
 * "set only if null" idempotency pattern.
 */
export async function requestCancellationCall(searchId: string): Promise<CancellationActionResult> {
  const check = await getOwnedCancellableSearch(searchId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_searches")
    .update({ cancellation_call_requested_at: new Date().toISOString() })
    .eq("id", searchId)
    .is("cancellation_call_requested_at", null);

  if (error) {
    return { ok: false, error: `Failed to request a call: ${error.message}` };
  }

  revalidatePath("/account");
  revalidatePath("/internal/outreach");
  return { ok: true };
}
