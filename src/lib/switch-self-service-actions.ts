"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SwitchActionResult = { ok: true } | { ok: false; error: string };

async function getOwnedSwitchableSearch(searchId: string) {
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
  if (search.search_status === "switched") {
    return { ok: false as const, error: "This search has already been switched." };
  }

  return { ok: true as const, userId: user.id };
}

/**
 * Customer chooses "have an agent handle it" on the switch flow -- mirrors
 * requestFinalizationCall (finalize-actions.ts) exactly, including the same
 * guarded "set only if null" idempotency pattern already used for
 * call_requested_at.
 */
export async function requestSwitchCall(searchId: string): Promise<SwitchActionResult> {
  const check = await getOwnedSwitchableSearch(searchId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_searches")
    .update({ switch_call_requested_at: new Date().toISOString() })
    .eq("id", searchId)
    .is("switch_call_requested_at", null);

  if (error) {
    return { ok: false, error: `Failed to request a call: ${error.message}` };
  }

  revalidatePath("/account");
  revalidatePath("/internal/outreach");
  return { ok: true };
}

export type EligibilityResult = { ok: true; eligible: boolean } | { ok: false; error: string };

const GRACE_PERIOD_DAYS = 5;

/**
 * Read-only grace-period check -- gates which confirmation copy the
 * self-service flow shows next (free-switch vs $100 warning), so this must
 * never trust a client-computed answer. customers.created_at is the
 * "signup date" anchor (see CLAUDE.md "Pricing Pivot Tracking", Step 3b
 * discovery) -- no separate signup-date column exists or is needed.
 */
export async function checkSwitchEligibility(searchId: string): Promise<EligibilityResult> {
  const check = await getOwnedSwitchableSearch(searchId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  const { data: customer, error } = await admin
    .from("customers")
    .select("created_at, free_switch_used_at")
    .eq("id", check.userId)
    .single();

  if (error || !customer) {
    return { ok: false, error: "Could not verify eligibility." };
  }

  const graceWindowEnds = new Date(customer.created_at);
  graceWindowEnds.setDate(graceWindowEnds.getDate() + GRACE_PERIOD_DAYS);

  const eligible = customer.free_switch_used_at === null && new Date() <= graceWindowEnds;
  return { ok: true, eligible };
}

export type ExecuteFreeSwitchResult = { ok: true; newSearchId: string } | { ok: false; error: string };

/**
 * Actually performs a free grace-period switch. Re-checks eligibility
 * itself rather than trusting the earlier checkSwitchEligibility call that
 * produced the confirmation screen -- a customer could sit on that screen
 * long enough to cross out of the window, or burn their free switch in
 * another tab first. p_paid_at := now() so the new row reaches /finalize
 * without hitting the "go pay $699 again" wall (see the switch_fee_flow
 * migration's header comment for why that was a real gap). The
 * free_switch_used_at write is guarded "set only if null" -- same
 * first-write-wins pattern as switch-actions.ts's agent-initiated path.
 */
export async function executeFreeSwitch(
  searchId: string,
  newMake: string,
  newModel: string
): Promise<ExecuteFreeSwitchResult> {
  const check = await getOwnedSwitchableSearch(searchId);
  if (!check.ok) return check;

  const trimmedMake = newMake.trim();
  const trimmedModel = newModel.trim();
  if (!trimmedMake || !trimmedModel) {
    return { ok: false, error: "Make and model are required." };
  }

  const eligibility = await checkSwitchEligibility(searchId);
  if (!eligibility.ok) return eligibility;
  if (!eligibility.eligible) {
    return { ok: false, error: "This switch is no longer free — the $100 switch fee applies." };
  }

  const admin = createAdminClient();

  const { data: newSearch, error: rpcError } = await admin.rpc("switch_customer_search", {
    p_old_search_id: searchId,
    p_new_make: trimmedMake,
    p_new_model: trimmedModel,
    p_paid_at: new Date().toISOString(),
  });

  if (rpcError || !newSearch) {
    return { ok: false, error: `Failed to switch: ${rpcError?.message ?? "unknown error"}` };
  }

  await admin
    .from("customers")
    .update({ free_switch_used_at: new Date().toISOString() })
    .eq("id", check.userId)
    .is("free_switch_used_at", null);

  revalidatePath("/account");
  return { ok: true, newSearchId: newSearch.id };
}
