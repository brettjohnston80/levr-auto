"use server";

import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";
import { getStripe } from "./stripe";
import { isProductionDeploy, runtimeEnv } from "./runtime-env";
import { findGuaranteePayment } from "./refunds-due";
import { formatRefundAmount } from "./refund-format";

/**
 * Day-30 guarantee refunds from /internal/refunds-due (Phase 1, Chunk 5; plan section 3.1).
 * Any active agent. Money moves only through Stripe; record_payment_refund() then records it
 * (reason 'guarantee', the agent on the refund row, one refund_processed activity row) and
 * enforces the remaining balance under a row lock.
 *
 * Neither action ever runs on a preview build (it shares the production database).
 */

export type GuaranteeRefundResult = { ok: true; message: string; stripeRefundId: string; amountCents: number } | { ok: false; error: string };

const NOT_DUE = "This search is no longer due a guarantee refund.";
const NOTHING_LEFT = "Nothing left to refund on this payment.";
const NO_PAYMENT = "No $699 payment is recorded for this search, so there's nothing to refund here.";
const PREVIEW = "Refunds can't be issued or recorded from a preview build.";

// Test-only, never honoured in production: AGENT_REFUND_FORCE_RECORD_FAIL=1 makes the recording
// step fail after Stripe has refunded, to show the "went through in Stripe but couldn't be
// recorded" message and the recovery through "Record a refund already issued in Stripe".
function forcedRecordFailure(): boolean {
  return !isProductionDeploy() && process.env.AGENT_REFUND_FORCE_RECORD_FAIL === "1";
}

async function loadDue(searchId: string) {
  const admin = createAdminClient();
  const { data: search, error } = await admin
    .from("customer_searches")
    .select("id, guarantee_status")
    .eq("id", String(searchId ?? ""))
    .maybeSingle();
  if (error) return { error: `Couldn't load the search: ${error.message}` } as const;
  if (!search || search.guarantee_status !== "refunded") return { error: NOT_DUE } as const;
  const payment = await findGuaranteePayment(admin, search.id);
  if (!payment) return { error: NO_PAYMENT } as const;
  return { admin, payment } as const;
}

async function isRecorded(admin: ReturnType<typeof createAdminClient>, stripeRefundId: string): Promise<boolean> {
  const { count } = await admin.from("refunds").select("id", { count: "exact", head: true }).eq("stripe_refund_id", stripeRefundId);
  return (count ?? 0) > 0;
}

/** "Issue refund": refunds everything left on the $699 payment, once. */
export async function issueGuaranteeRefund(searchId: string): Promise<GuaranteeRefundResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) return { ok: false, error: "Not authorized." };
  if (runtimeEnv() === "preview") return { ok: false, error: PREVIEW };

  const due = await loadDue(searchId);
  if ("error" in due) return { ok: false, error: due.error! };
  const { admin, payment } = due;
  const remaining = payment.amount_cents - payment.refunded_cents;
  if (remaining <= 0) return { ok: false, error: NOTHING_LEFT };

  // The idempotency key makes a double click or a retry return the SAME Stripe refund instead of
  // a second one. (If the amount ever differed under the same key, Stripe would refuse it.)
  let refund;
  try {
    refund = await getStripe().refunds.create(
      { payment_intent: payment.stripe_payment_intent_id, amount: remaining, metadata: { reason: "guarantee", search_id: String(searchId) } },
      { idempotencyKey: `guarantee_${searchId}_${payment.id}` },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Stripe didn't complete the refund: ${message}. Nothing was recorded, and no money moved.` };
  }

  const { error: recordError } = forcedRecordFailure()
    ? { error: { message: "forced test failure" } }
    : await admin.rpc("record_payment_refund", {
        p_payment_id: payment.id,
        p_agent_id: agent.id,
        p_amount_cents: refund.amount,
        p_stripe_refund_id: refund.id,
        p_reason: "guarantee",
      });
  if (recordError) {
    // A second click that raced the first gets the same Stripe refund back (idempotency), which
    // the first click already recorded: nothing more happened.
    if (await isRecorded(admin, refund.id)) return { ok: false, error: NOTHING_LEFT };
    return {
      ok: false,
      error: `The refund went through in Stripe (${refund.id}) but couldn't be recorded here: ${recordError.message}. Don't refund again. Record it with "Record a refund already issued in Stripe".`,
    };
  }
  return { ok: true, stripeRefundId: refund.id, amountCents: refund.amount, message: `Refunded ${formatRefundAmount(refund.amount)}. Stripe refund ${refund.id}.` };
}

/** "Record a refund already issued in Stripe": checks it in Stripe, then records its real amount. */
export async function recordExistingGuaranteeRefund(searchId: string, stripeRefundId: string): Promise<GuaranteeRefundResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) return { ok: false, error: "Not authorized." };
  if (runtimeEnv() === "preview") return { ok: false, error: PREVIEW };

  const refundId = String(stripeRefundId ?? "").trim();
  if (!/^re_[A-Za-z0-9_]+$/.test(refundId)) return { ok: false, error: "That refund ID wasn't found in Stripe." };

  const due = await loadDue(searchId);
  if ("error" in due) return { ok: false, error: due.error! };
  const { admin, payment } = due;

  let refund;
  try {
    refund = await getStripe().refunds.retrieve(refundId);
  } catch {
    return { ok: false, error: "That refund ID wasn't found in Stripe." };
  }
  const intentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  if (intentId !== payment.stripe_payment_intent_id) {
    return { ok: false, error: "That refund belongs to a different payment, not this search's $699 fee." };
  }
  if (refund.status !== "succeeded") {
    return { ok: false, error: `That refund hasn't gone through in Stripe yet (status: ${refund.status}).` };
  }
  // Checked after the payment match, so a refund already recorded for ANOTHER payment is reported
  // as a different payment, not as recorded here.
  if (await isRecorded(admin, refund.id)) return { ok: false, error: "That refund has already been recorded." };

  const { error: recordError } = await admin.rpc("record_payment_refund", {
    p_payment_id: payment.id,
    p_agent_id: agent.id,
    p_amount_cents: refund.amount,
    p_stripe_refund_id: refund.id,
    p_reason: "guarantee",
  });
  if (recordError) {
    if (await isRecorded(admin, refund.id)) return { ok: false, error: "That refund has already been recorded." };
    return { ok: false, error: `Couldn't record the refund: ${recordError.message}` };
  }
  return { ok: true, stripeRefundId: refund.id, amountCents: refund.amount, message: `Recorded the ${formatRefundAmount(refund.amount)} refund ${refund.id}.` };
}
