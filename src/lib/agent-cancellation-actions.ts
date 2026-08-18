"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";
import { getStripe } from "./stripe";

export interface CustomerPaymentForRefund {
  id: string;
  paymentType: string;
  amountCents: number;
  refundedCents: number;
  remainingCents: number;
  searchMake: string;
  searchModel: string;
  createdAt: string;
}

export type GetCustomerPaymentsResult = CustomerPaymentForRefund[] | { error: string };

/**
 * Every payment a customer has ever made, across every search, with the
 * remaining refundable balance on each -- the picker AgentCancellationResolutionForm
 * uses so an agent can refund a specific amount against a specific charge
 * (original fee, a switch fee, or an extension fee), not just "the search."
 * Deliberately customer-scoped, not search-scoped -- a search reached via a
 * switch has no payment of its own tied to the original $699 fee, so
 * scoping to just the search being cancelled would hide payments an agent
 * might legitimately want to refund from.
 */
export async function getCustomerPaymentsForCancellation(customerId: string): Promise<GetCustomerPaymentsResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data: payments, error } = await admin
    .from("payments")
    .select("id, search_id, payment_type, amount_cents, refunded_cents, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }
  if (!payments || payments.length === 0) {
    return [];
  }

  const searchIds = [...new Set(payments.map((p) => p.search_id))];
  const { data: searches, error: searchesError } = await admin
    .from("customer_searches")
    .select("id, make, model")
    .in("id", searchIds);

  if (searchesError) {
    return { error: searchesError.message };
  }

  const searchById = new Map((searches ?? []).map((s) => [s.id, s]));

  return payments.map((p) => {
    const search = searchById.get(p.search_id);
    return {
      id: p.id,
      paymentType: p.payment_type,
      amountCents: p.amount_cents,
      refundedCents: p.refunded_cents,
      remainingCents: p.amount_cents - p.refunded_cents,
      searchMake: search?.make ?? "?",
      searchModel: search?.model ?? "?",
      createdAt: p.created_at,
    };
  });
}

export interface RefundLineItem {
  paymentId: string;
  amountCents: number;
}

export type ResolveCancellationResult =
  | { ok: true; refundsIssued: number }
  | { ok: false; error: string };

/**
 * Agent-mediated cancellation (Part 2, plan.md) -- always ends the search
 * (that's the point of the call), with zero or more refunds against
 * specific payments the agent picks. Sequencing per refund line item:
 * real Stripe refund first (money actually moves), then record_refund()
 * (durably records it, atomically enforcing the remaining-balance rule) --
 * Postgres can't call Stripe, so this order can't be reversed.
 *
 * If a later line item's Stripe call fails, the search is already cancelled
 * and any earlier refunds in this batch already recorded -- surfaced to the
 * agent as an error rather than silently retried, same accepted-risk
 * standard as the auto-renew charge/email split (day60-extension.ts).
 */
export async function resolveCancellation(
  searchId: string,
  reasonCategory: string,
  notes: string,
  refundLineItems: RefundLineItem[]
): Promise<ResolveCancellationResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }
  if (!reasonCategory) {
    return { ok: false, error: "A reason is required." };
  }

  const admin = createAdminClient();

  const { error: cancelError } = await admin.rpc("cancel_search", {
    p_search_id: searchId,
    p_initiated_by: "agent",
    p_agent_id: agent.id,
    p_reason_category: reasonCategory,
    p_notes: notes || null,
  });

  if (cancelError) {
    return { ok: false, error: `Failed to cancel: ${cancelError.message}` };
  }

  // cancel_search returns the customer_searches row, not the cancellation_log
  // row it just inserted -- but a search can be cancelled at most once ever
  // (cancel_search's own guard rejects re-cancelling an already-cancelled
  // search, and there's no reactivation path), so looking this up by
  // search_id alone is always unambiguous.
  const { data: logRow, error: logError } = await admin
    .from("cancellation_log")
    .select("id")
    .eq("search_id", searchId)
    .single();

  if (logError || !logRow) {
    return {
      ok: false,
      error: `Search was cancelled but the audit row couldn't be found -- refunds not attempted: ${logError?.message}`,
    };
  }

  let refundsIssued = 0;
  for (const item of refundLineItems) {
    if (item.amountCents <= 0) continue;

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("id, stripe_payment_intent_id, amount_cents, refunded_cents")
      .eq("id", item.paymentId)
      .single();

    if (paymentError || !payment) {
      return {
        ok: false,
        error: `Cancelled, and ${refundsIssued} refund(s) issued so far, but payment ${item.paymentId} could not be found: ${paymentError?.message}`,
      };
    }

    // Checked here, before any real money moves -- record_refund's own
    // FOR UPDATE-locked check is still the correct backstop against a race
    // between two concurrent refund attempts on the same payment, but it
    // runs AFTER stripe.refunds.create() below, which is too late to stop
    // an over-refund from actually going out. This is the check that
    // actually prevents the Stripe call, not just the bookkeeping.
    const remainingCents = payment.amount_cents - payment.refunded_cents;
    if (item.amountCents > remainingCents) {
      return {
        ok: false,
        error: `Cancelled, and ${refundsIssued} refund(s) issued so far, but the requested refund of $${(item.amountCents / 100).toFixed(2)} for payment ${item.paymentId} exceeds its remaining balance of $${(remainingCents / 100).toFixed(2)} -- no Stripe refund was attempted.`,
      };
    }

    let refund;
    try {
      refund = await getStripe().refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: item.amountCents,
      });
    } catch (err) {
      return {
        ok: false,
        error: `Cancelled, and ${refundsIssued} refund(s) issued so far, but the Stripe refund for payment ${item.paymentId} failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }

    const { error: recordError } = await admin.rpc("record_refund", {
      p_payment_id: item.paymentId,
      p_cancellation_log_id: logRow.id,
      p_agent_id: agent.id,
      p_amount_cents: item.amountCents,
      p_stripe_refund_id: refund.id,
    });

    if (recordError) {
      return {
        ok: false,
        error: `Cancelled, and a real Stripe refund (${refund.id}) was issued, but recording it failed: ${recordError.message}`,
      };
    }

    refundsIssued += 1;
  }

  revalidatePath("/internal/outreach");
  revalidatePath("/account");
  return { ok: true, refundsIssued };
}
