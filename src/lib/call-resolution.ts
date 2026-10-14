import "server-only";
import { createAdminClient } from "./supabase/admin";
import { logAgentActivity } from "./agent-activity";

/**
 * Call-request resolution (Phase 1, Chunk 6; plan sections 3.3 and 5). A switch or cancellation
 * call request is resolved with a neutral outcome (approved 2026-10-11): customers can read their
 * own searches, so the stored codes never judge the customer.
 *   switch:       switched | no_switch | call_not_completed | other
 *   cancellation: cancelled | not_cancelled | call_not_completed | other
 * "switched" / "cancelled" are only ever set automatically, when the agent switches or cancels.
 */

export type CallType = "switch" | "cancellation";

export const MANUAL_OUTCOMES: Record<CallType, { code: string; label: string }[]> = {
  switch: [
    { code: "no_switch", label: "Didn't switch" },
    { code: "call_not_completed", label: "Couldn't complete the call" },
    { code: "other", label: "Other" },
  ],
  cancellation: [
    { code: "not_cancelled", label: "Didn't cancel" },
    { code: "call_not_completed", label: "Couldn't complete the call" },
    { code: "other", label: "Other" },
  ],
};

const AUTOMATIC_OUTCOME: Record<CallType, string> = { switch: "switched", cancellation: "cancelled" };

/**
 * Sets the resolved trio on an open request (requested, not yet resolved) and logs
 * call_request_resolved. Returns false when there was no open request (none made, or already
 * resolved). The write is conditional, so two agents resolving at once resolve it once.
 */
export async function markCallResolved(params: {
  searchId: string;
  callType: CallType;
  outcome: string;
  agentId: string;
  note?: string | null;
  automatic?: boolean;
}): Promise<boolean> {
  const prefix = params.callType === "switch" ? "switch_call" : "cancellation_call";
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customer_searches")
    .update({
      [`${prefix}_resolved_at`]: new Date().toISOString(),
      [`${prefix}_resolved_by_agent_id`]: params.agentId,
      [`${prefix}_outcome`]: params.outcome,
    })
    .eq("id", params.searchId)
    .not(`${prefix}_requested_at`, "is", null)
    .is(`${prefix}_resolved_at`, null)
    .select("id, customer_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return false;
  await logAgentActivity(
    params.agentId,
    "call_request_resolved",
    { searchId: params.searchId, customerId: data[0].customer_id as string },
    { call_type: params.callType, outcome: params.outcome, ...(params.note ? { note: params.note } : {}), ...(params.automatic ? { automatic: true } : {}) },
  );
  return true;
}

/** Automatic resolution when the agent switches or cancels the search. Never throws. */
export async function resolveCallAutomatically(searchId: string, callType: CallType, agentId: string): Promise<void> {
  try {
    await markCallResolved({ searchId, callType, outcome: AUTOMATIC_OUTCOME[callType], agentId, automatic: true });
  } catch (e) {
    console.error("[call-resolution] automatic resolution failed", { searchId, callType, error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * The CUSTOMER switched or cancelled on their own while a call request was open (Brett,
 * 2026-10-14): resolved automatically as switched / cancelled with no agent named, and one
 * activity row noting the customer did it (call_request_resolved_by_customer; Step 16 lets that
 * one activity type have no agent). Never throws.
 */
export async function resolveCallByCustomer(searchId: string, callType: CallType): Promise<void> {
  const prefix = callType === "switch" ? "switch_call" : "cancellation_call";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("customer_searches")
      .update({
        [`${prefix}_resolved_at`]: new Date().toISOString(),
        [`${prefix}_resolved_by_agent_id`]: null,
        [`${prefix}_outcome`]: AUTOMATIC_OUTCOME[callType],
      })
      .eq("id", searchId)
      .not(`${prefix}_requested_at`, "is", null)
      .is(`${prefix}_resolved_at`, null)
      .select("id, customer_id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return; // no open request
    const { error: logError } = await admin.rpc("log_agent_activity", {
      p_agent_id: null,
      p_action: "call_request_resolved_by_customer",
      p_search_id: searchId,
      p_customer_id: data[0].customer_id,
      p_details: { call_type: callType, outcome: AUTOMATIC_OUTCOME[callType], by: "customer" },
    });
    if (logError) console.error("[agent-activity-failed]", { action: "call_request_resolved_by_customer", searchId, error: logError.message });
  } catch (e) {
    console.error("[call-resolution] customer resolution failed", { searchId, callType, error: e instanceof Error ? e.message : String(e) });
  }
}
