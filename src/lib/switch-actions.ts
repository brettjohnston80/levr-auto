"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";

export interface SwitchSearchResult {
  ok: boolean;
  error?: string;
}

/**
 * Switches a customer's search to a new make/model — agent-only, run from
 * /internal/outreach on a customer's behalf (a phone/email request), one of
 * three switch entry points (the other two — self-service and call-request —
 * are a separate, later pass; see CLAUDE.md "Pricing Pivot Tracking", Step
 * 3b). The actual insert-new-row + mark-old-row-superseded pair happens
 * atomically in the switch_customer_search DB function (see migrations),
 * since two related writes need to succeed or fail together and supabase-js
 * has no multi-statement transaction. The DB function re-checks the
 * not-already-switched guard under a row lock, so a race between this check
 * and the RPC call can't double-switch a search.
 *
 * Agent-comped switches stay free (no $100 fee charged here — an agent can
 * always waive it), but now correctly participate in the same accounting a
 * self-service free switch will: p_paid_at := now() so the new row reaches
 * /finalize without a spurious "go pay $699 again" wall (the gap this pass
 * closes — see the migration header comment), and free_switch_used_at gets
 * set on the customer so a later self-service switch attempt sees the free
 * grace-period switch as already used, rather than granting a second free
 * one through this path.
 *
 * Retrofitted (2026-08-16, Pass 3 of the Day-60 paused-state policy — see
 * CLAUDE.md) to require a reason: every agent-comped switch through this
 * form is already exactly the kind of no-Stripe fee waiver the hidden
 * bypass audit trail exists for, so this closes that gap in place rather
 * than leaving it as a separate, still-unaudited path. reason_category is
 * validated here AND re-validated inside switch_customer_search itself
 * (defense in depth) — the RPC inserts the agent_bypass_log row in the same
 * transaction as the switch, so a failed audit write rolls back the switch
 * too rather than succeeding unlogged.
 */
export async function switchCustomerSearch(formData: FormData): Promise<SwitchSearchResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const oldSearchId = formData.get("old_search_id")?.toString();
  const newMake = formData.get("new_make")?.toString().trim();
  const newModel = formData.get("new_model")?.toString().trim();
  const reasonCategory = formData.get("reason_category")?.toString();
  const notes = formData.get("notes")?.toString().trim() || null;

  if (!oldSearchId || !newMake || !newModel) {
    return { ok: false, error: "Make and model are required." };
  }
  if (!reasonCategory) {
    return { ok: false, error: "A reason is required." };
  }

  const admin = createAdminClient();

  const { data: oldSearch, error: oldSearchError } = await admin
    .from("customer_searches")
    .select("id, search_status, superseded_by_id, customer_id")
    .eq("id", oldSearchId)
    .maybeSingle();

  if (oldSearchError || !oldSearch) {
    return { ok: false, error: "That search no longer exists." };
  }
  if (oldSearch.superseded_by_id || oldSearch.search_status === "switched") {
    return { ok: false, error: "This search has already been switched." };
  }

  const { error: rpcError } = await admin.rpc("switch_customer_search", {
    p_old_search_id: oldSearchId,
    p_new_make: newMake,
    p_new_model: newModel,
    p_paid_at: new Date().toISOString(),
    p_agent_id: agent.id,
    p_reason_category: reasonCategory,
    p_notes: notes,
  });

  if (rpcError) {
    return { ok: false, error: `Failed to switch: ${rpcError.message}` };
  }

  // Guarded "set only if null" write — the equivalent of a
  // coalesce(free_switch_used_at, now()) update, since supabase-js's
  // .update() takes static values, not SQL expressions referencing the
  // existing column. First write wins: a customer's second (or later)
  // comped switch leaves this at their original free-switch timestamp.
  const { error: freeSwitchError } = await admin
    .from("customers")
    .update({ free_switch_used_at: new Date().toISOString() })
    .eq("id", oldSearch.customer_id)
    .is("free_switch_used_at", null);

  if (freeSwitchError) {
    // The switch itself already succeeded — don't fail the whole action over
    // a bookkeeping write. Logged so it can be corrected manually if needed.
    console.error(
      `switchCustomerSearch: switch succeeded but failed to set free_switch_used_at for customer ${oldSearch.customer_id}:`,
      freeSwitchError.message
    );
  }

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true };
}
