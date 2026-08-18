import "server-only";
import type { createAdminClient } from "./supabase/admin";

export type PaymentType = "search_fee" | "switch_fee" | "extension_fee";

export interface RecordPaymentInput {
  customerId: string;
  searchId: string;
  paymentType: PaymentType;
  // Null for an auto-renew off-session charge, which never goes through
  // Checkout at all.
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string;
  amountCents: number;
}

/**
 * Durable record of a successful charge, for the Cancellation &
 * Discretionary Refunds feature (plan.md, 2026-08-18) -- the first place any
 * of these three charge types (search fee, switch fee, extension fee) get an
 * individually-refundable Stripe reference. Called from every existing
 * charge-writing path: the webhook's search_payment/switch_fee/extension_fee
 * branches, and attemptAutoRenewCharge (day60-extension.ts).
 *
 * Deliberately never fails the caller -- by the time this runs, the real
 * money has already moved and the search-side effect (paid_at, deadline,
 * switch, etc.) already succeeded. A failure here just means this one charge
 * won't show up in the agent's refund picker; logged for follow-up, same
 * "logged but non-fatal" standard already used for captureAutoRenewPaymentMethod
 * and the on-demand MarketCheck sync in the webhook.
 */
export async function recordPayment(
  admin: ReturnType<typeof createAdminClient>,
  input: RecordPaymentInput
): Promise<void> {
  const { error } = await admin.from("payments").insert({
    customer_id: input.customerId,
    search_id: input.searchId,
    payment_type: input.paymentType,
    stripe_checkout_session_id: input.stripeCheckoutSessionId,
    stripe_payment_intent_id: input.stripePaymentIntentId,
    amount_cents: input.amountCents,
  });

  if (error) {
    console.error(
      `Failed to record payment (${input.paymentType}) for search ${input.searchId}:`,
      error.message
    );
  }
}
