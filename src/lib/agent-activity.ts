import "server-only";
import { createAdminClient } from "./supabase/admin";
import { isProductionDeploy } from "./runtime-env";

/**
 * Agent activity log, app-level writes (Phase 1, Chunk 2; DB plan 5.2/5.3).
 *
 * Every agent action that isn't already a database function calls this AFTER its own write
 * succeeds, with the signed-in agent as the actor. It never throws and never fails the action:
 *   - the database function log_agent_activity() catches a failed insert itself and writes an
 *     `activity_log_failed` alert instead (the call then returns null);
 *   - if the call itself fails (network or permissions), this helper logs the
 *     searchable tag `[agent-activity-failed]` and writes the alert itself.
 * Alerts are emailed to leads by the alert-email sweep (Chunk 4).
 *
 * Database-function paths (switch, bypass, cancel, revert, refund, reassign, away, agent
 * management, invite link, relink) log inside the function, in the same transaction.
 */

export type AgentActivityCode =
  | "offer_logged"
  | "offer_addon_added"
  | "addon_removal_resolved"
  | "offer_vehicle_marked_sold"
  | "delivery_estimate_set"
  | "offer_released"
  | "availability_confirmed"
  | "deposit_confirmed"
  | "signing_status_checked"
  | "search_marked_purchased"
  | "search_finalized_by_agent"
  | "undecided_search_finalized"
  | "inventory_refreshed"
  | "activity_reviewed"
  | "message_sent"
  | "notification_flag_resolved"
  | "dealer_alias_confirmed"
  | "dealer_alias_merged"
  | "salesperson_added"
  | "salesperson_updated"
  | "salesperson_removed"
  | "article_saved"
  | "article_approved"
  | "article_regenerated"
  | "article_image_attached"
  | "social_post_saved"
  | "social_post_approved"
  | "social_post_regenerated"
  | "social_post_image_attached"
  | "platform_marked_posted"
  | "agent_invited"
  | "agent_two_factor_enrolled"
  | "agent_two_factor_reset"
  | "call_request_resolved"
  // Offer entry (OE-1 codes; offer_sent and offer_warning_confirmed are written by send_offer_submission).
  | "offer_draft_saved"
  | "dealer_submission_discarded";

export interface ActivityLinks {
  searchId?: string | null;
  customerId?: string | null;
  qualifyingOfferId?: string | null;
  dealerAliasId?: string | null;
  refundId?: string | null;
  dealerContactId?: string | null;
}

// Test-only switch, never honoured in production: AGENT_ACTIVITY_FORCE_FAIL="<code>:<mode>"
//   mode "code": the database function's own insert fails (unknown action code), so the
//                function writes the alert itself;
//   mode "call": the call itself fails (as a network or permission error would: it calls a
//                function name that doesn't exist), so this helper writes the alert.
function forcedFailure(action: AgentActivityCode): "code" | "call" | null {
  if (isProductionDeploy()) return null;
  const raw = process.env.AGENT_ACTIVITY_FORCE_FAIL ?? "";
  for (const item of raw.split(",")) {
    const [code, mode] = item.trim().split(":");
    if (code === action && (mode === "code" || mode === "call")) return mode;
  }
  return null;
}

/** Writes one activity row. Returns true when the row was written. Never throws. */
export async function logAgentActivity(
  agentId: string,
  action: AgentActivityCode,
  links: ActivityLinks = {},
  details: Record<string, unknown> = {},
): Promise<boolean> {
  const forced = forcedFailure(action);
  const args = {
    p_agent_id: agentId,
    p_action: forced === "code" ? "forced_test_failure" : action,
    p_search_id: links.searchId ?? null,
    p_customer_id: links.customerId ?? null,
    p_qualifying_offer_id: links.qualifyingOfferId ?? null,
    p_dealer_alias_id: links.dealerAliasId ?? null,
    p_refund_id: links.refundId ?? null,
    p_dealer_contact_id: links.dealerContactId ?? null,
    p_details: forced ? { ...details, forced_test_failure: action } : details,
  };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc(forced === "call" ? "log_agent_activity_forced_missing" : "log_agent_activity", args);
    if (!error && data) return true;
    if (!error) {
      // The function caught the failure and already wrote the activity_log_failed alert.
      console.error("[agent-activity-failed]", { action, agentId, reason: "insert refused; alert written by the database" });
      return false;
    }
    console.error("[agent-activity-failed]", { action, agentId, error: error.message });
    const { error: alertError } = await admin.from("agent_alerts").insert({
      kind: "activity_log_failed",
      search_id: links.searchId ?? null,
      agent_id: agentId,
      details: { error: error.message, action, links, details: args.p_details },
    });
    if (alertError) console.error("[agent-activity-failed] alert also failed", { action, error: alertError.message });
  } catch (e) {
    console.error("[agent-activity-failed]", { action, agentId, error: e instanceof Error ? e.message : String(e) });
  }
  return false;
}
