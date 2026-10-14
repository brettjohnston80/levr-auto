import "server-only";
import { createAdminClient } from "./supabase/admin";

export interface RefundReasonOption {
  code: string;
  label: string;
}

/**
 * The active refund reasons (refund_reasons), for the per-refund Reason picker on the cancellation
 * form. Loaded once per page on the server and passed to every cancellation form, so the page makes
 * one read however many cards it shows. A fixed order: the five reasons were added at the same
 * moment, so created_at can't order them; any reason added later goes after these, by label.
 * Falls back to Cancellation alone if the read fails (the form's default; recording re-checks it).
 */
export async function getRefundReasons(): Promise<RefundReasonOption[]> {
  const { data, error } = await createAdminClient().from("refund_reasons").select("code, label").eq("is_active", true);
  if (error || !data || data.length === 0) {
    if (error) console.error("[refund-reasons] could not load", error.message);
    return [{ code: "cancellation", label: "Cancellation" }];
  }
  const ORDER = ["cancellation", "guarantee", "goodwill", "duplicate_charge", "other"];
  const rank = (code: string) => (ORDER.includes(code) ? ORDER.indexOf(code) : ORDER.length);
  return (data as RefundReasonOption[]).sort((x, y) => rank(x.code) - rank(y.code) || x.label.localeCompare(y.label));
}
