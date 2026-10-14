"use server";

import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";
import { getStripe } from "./stripe";
import { isProductionDeploy, runtimeEnv } from "./runtime-env";
import { findGuaranteePayments, type GuaranteePayment } from "./refunds-due";
import { describeRefundParts, formatRefundAmount, refundPartLabel, type RefundPartKind } from "./refund-format";

/**
 * Day-30 guarantee refunds from /internal/refunds-due (Phase 1, Chunk 5; plan section 3.1).
 * Any active agent. A guarantee refund covers the $699 search fee AND any $100 paid-switch fees
 * on the search's switch chain (Brett, 2026-10-14). Each fee is its own Stripe refund, with its own
 * idempotency key, recorded through record_payment_refund() (reason 'guarantee', the agent on the
 * refund row, one refund_processed activity row; the remaining balance enforced under a row lock).
 *
 * Neither action ever runs on a preview build (it shares the production database).
 */

export type GuaranteeRefundResult =
  | { ok: true; message: string; stripeRefundIds: string[]; amountCents: number; partKind?: RefundPartKind }
  | { ok: false; error: string; refundedCents?: number };

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

type Admin = ReturnType<typeof createAdminClient>;
type Fee = GuaranteePayment & { kind: RefundPartKind };

async function loadDue(searchId: string) {
  const admin = createAdminClient();
  const { data: search, error } = await admin
    .from("customer_searches")
    .select("id, guarantee_status")
    .eq("id", String(searchId ?? ""))
    .maybeSingle();
  if (error) return { error: `Couldn't load the search: ${error.message}` } as const;
  if (!search || search.guarantee_status !== "refunded") return { error: NOT_DUE } as const;
  const { searchFee, switchFees } = await findGuaranteePayments(admin, search.id);
  if (!searchFee) return { error: NO_PAYMENT } as const;
  const fees: Fee[] = [{ ...searchFee, kind: "search_fee" }, ...switchFees.map((f) => ({ ...f, kind: "switch_fee" as const }))];
  return { admin, fees } as const;
}

async function isRecorded(admin: Admin, stripeRefundId: string): Promise<boolean> {
  const { count } = await admin.from("refunds").select("id", { count: "exact", head: true }).eq("stripe_refund_id", stripeRefundId);
  return (count ?? 0) > 0;
}

/** "Issue refund": refunds everything left on the $699 and any $100 switch fees, once. */
export async function issueGuaranteeRefund(searchId: string): Promise<GuaranteeRefundResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) return { ok: false, error: "Not authorized." };
  if (runtimeEnv() === "preview") return { ok: false, error: PREVIEW };

  const due = await loadDue(searchId);
  if ("error" in due) return { ok: false, error: due.error! };
  const { admin, fees } = due;
  const todo = fees.map((f) => ({ fee: f, amount: f.amount_cents - f.refunded_cents })).filter((x) => x.amount > 0);
  if (todo.length === 0) return { ok: false, error: NOTHING_LEFT };
  const multi = todo.length > 1 || todo[0].fee.kind !== "search_fee";

  const done: { kind: RefundPartKind; amountCents: number; refundId: string }[] = [];
  const doneCents = () => done.reduce((s, d) => s + d.amountCents, 0);
  const soFar = () => (done.length ? `Refunded ${formatRefundAmount(doneCents())} (${describeRefundParts(done)}). Then ` : "");

  for (const { fee, amount } of todo) {
    const part = `${formatRefundAmount(amount)} ${refundPartLabel(fee.kind)}`;
    // The idempotency key makes a double click or a retry return the SAME Stripe refund instead
    // of a second one. (If the amount ever differed under the same key, Stripe would refuse it.)
    let refund;
    try {
      refund = await getStripe().refunds.create(
        { payment_intent: fee.stripe_payment_intent_id, amount, metadata: { reason: "guarantee", search_id: String(searchId) } },
        { idempotencyKey: `guarantee_${searchId}_${fee.id}` },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!done.length) return { ok: false, error: `Stripe didn't complete the refund: ${message}. Nothing was recorded, and no money moved.` };
      return {
        ok: false,
        refundedCents: doneCents(),
        error: `${soFar()}Stripe didn't complete the refund of the ${part}: ${message}. Nothing more was recorded, and no more money moved.`,
      };
    }

    const { error: recordError } = forcedRecordFailure()
      ? { error: { message: "forced test failure" } }
      : await admin.rpc("record_payment_refund", {
          p_payment_id: fee.id,
          p_agent_id: agent.id,
          p_amount_cents: refund.amount,
          p_stripe_refund_id: refund.id,
          p_reason: "guarantee",
        });
    if (recordError) {
      // A second click that raced the first gets the same Stripe refund back (idempotency),
      // which the first click already recorded: nothing more happened for this fee.
      if (await isRecorded(admin, refund.id)) continue;
      const tail = `couldn't be recorded here: ${recordError.message}. Don't refund again. Record it with "Record a refund already issued in Stripe".`;
      return {
        ok: false,
        refundedCents: doneCents(),
        error: multi
          ? `${soFar()}The ${part} refund went through in Stripe (${refund.id}) but ${tail}`
          : `The refund went through in Stripe (${refund.id}) but ${tail}`,
      };
    }
    done.push({ kind: fee.kind, amountCents: refund.amount, refundId: refund.id });
  }

  if (done.length === 0) return { ok: false, error: NOTHING_LEFT };
  const total = doneCents();
  const ids = done.map((d) => d.refundId);
  return {
    ok: true,
    stripeRefundIds: ids,
    amountCents: total,
    message:
      done.length === 1 && done[0].kind === "search_fee"
        ? `Refunded ${formatRefundAmount(total)}. Stripe refund ${ids[0]}.`
        : `Refunded ${formatRefundAmount(total)} (${describeRefundParts(done)}). Stripe refund${ids.length > 1 ? "s" : ""} ${ids.join(", ")}.`,
  };
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
  const { admin, fees } = due;

  let refund;
  try {
    refund = await getStripe().refunds.retrieve(refundId);
  } catch {
    return { ok: false, error: "That refund ID wasn't found in Stripe." };
  }
  const intentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  const fee = fees.find((f) => f.stripe_payment_intent_id === intentId);
  if (!fee) {
    return {
      ok: false,
      error: fees.length > 1
        ? "That refund belongs to a different payment, not this search's $699 fee or switch fee."
        : "That refund belongs to a different payment, not this search's $699 fee.",
    };
  }
  if (refund.status !== "succeeded") {
    return { ok: false, error: `That refund hasn't gone through in Stripe yet (status: ${refund.status}).` };
  }
  // Checked after the payment match, so a refund already recorded for ANOTHER payment is reported
  // as a different payment, not as recorded here.
  if (await isRecorded(admin, refund.id)) return { ok: false, error: "That refund has already been recorded." };

  const { error: recordError } = await admin.rpc("record_payment_refund", {
    p_payment_id: fee.id,
    p_agent_id: agent.id,
    p_amount_cents: refund.amount,
    p_stripe_refund_id: refund.id,
    p_reason: "guarantee",
  });
  if (recordError) {
    if (await isRecorded(admin, refund.id)) return { ok: false, error: "That refund has already been recorded." };
    return { ok: false, error: `Couldn't record the refund: ${recordError.message}` };
  }
  return {
    ok: true,
    stripeRefundIds: [refund.id],
    amountCents: refund.amount,
    partKind: fee.kind,
    message: `Recorded the ${formatRefundAmount(refund.amount)} refund ${refund.id}.`,
  };
}
