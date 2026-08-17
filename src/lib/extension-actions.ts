"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { EXTENSION_FEE, RESUME_WINDOW_DAYS } from "@/lib/vehicle-data";

export type CreateExtensionCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

// Starts a Stripe Checkout Session for a $100 Day-60 extension payment.
// Mirrors createCheckoutSession (payment-actions.ts) — inline price_data, no
// stored Stripe Price ID, success_url kept simple (back to /account; whether
// that page reflects the extension before the webhook finishes is a
// dashboard-UI concern for the next pass, not this one).
//
// Server-side eligibility check, never trusting a client-side gate alone
// (same standard as executeFreeSwitch): a search is extendable if it's
// still actively searching (always eligible to extend early, no restriction
// on how far from the deadline) or if it was paused within the last
// RESUME_WINDOW_DAYS (the self-service resume window). A search paused
// longer than that needs agent intervention, not a checkout button.
//
// enableAutoRenew opts this customer into automatic future extensions (see
// day60-extension.ts's attemptAutoRenewCharge) via Stripe's
// setup_future_usage: 'off_session' — decided 2026-08-16, built 2026-08-17.
// A Stripe Customer object is required for this (off-session charges must
// be attributed to a Customer, not a bare PaymentIntent), created lazily on
// first opt-in and persisted immediately so an abandoned/retried checkout
// still reuses it rather than creating duplicates.
export async function createExtensionCheckoutSession(
  searchId: string,
  enableAutoRenew: boolean = false
): Promise<CreateExtensionCheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: row, error: fetchError } = await supabase
    .from("customer_searches")
    .select("id, make, model, search_status, paused_at")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (fetchError || !row) {
    return { ok: false, error: "Could not verify this search." };
  }

  if (row.search_status === "paused") {
    if (!row.paused_at) {
      return { ok: false, error: "This search can't be extended right now — contact your agent." };
    }
    const resumeWindowEnds = new Date(row.paused_at);
    resumeWindowEnds.setUTCDate(resumeWindowEnds.getUTCDate() + RESUME_WINDOW_DAYS);
    if (new Date() > resumeWindowEnds) {
      return {
        ok: false,
        error: `This search was paused more than ${RESUME_WINDOW_DAYS} days ago and can no longer be resumed automatically — contact your agent.`,
      };
    }
  } else if (row.search_status !== "searching") {
    return { ok: false, error: "This search can't be extended right now." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const stripe = getStripe();

  let stripeCustomerId: string | undefined;

  if (enableAutoRenew) {
    const { data: customerRow } = await supabase
      .from("customers")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    stripeCustomerId = customerRow?.stripe_customer_id ?? undefined;

    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { customer_id: user.id },
      });
      stripeCustomerId = stripeCustomer.id;

      // Customers has no customer-owned UPDATE RLS policy (same as every
      // other customer_searches/customers write in this codebase) — verified
      // ownership above via the RLS-bound select, write through admin.
      // Guarded with .is("stripe_customer_id", null) so a retried opt-in
      // checkout (e.g. the first was abandoned) can't clobber an id already
      // persisted by a concurrent attempt.
      const admin = createAdminClient();
      const { error: persistError } = await admin
        .from("customers")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", user.id)
        .is("stripe_customer_id", null);

      if (persistError) {
        console.error("Failed to persist stripe_customer_id:", persistError.message);
      }
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: user.email ?? undefined }),
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: EXTENSION_FEE * 100,
          product_data: {
            name: "LEVR Auto — Search Extension",
            description: `${row.make} ${row.model}`,
          },
        },
        quantity: 1,
      },
    ],
    ...(enableAutoRenew
      ? { payment_intent_data: { setup_future_usage: "off_session" as const } }
      : {}),
    metadata: {
      type: "extension_fee",
      customer_id: user.id,
      search_id: searchId,
      enable_auto_renew: enableAutoRenew ? "true" : "false",
    },
    success_url: `${siteUrl}/account`,
    cancel_url: `${siteUrl}/account`,
  });

  if (!session.url) {
    return { ok: false, error: "Could not start checkout." };
  }

  return { ok: true, url: session.url };
}

export type SetAutoRenewResult = { ok: true } | { ok: false; error: string };

// Customer-facing off switch — the "required, not optional" toggle from the
// approved auto-renew spec. Turning it back on isn't offered here: that
// needs a fresh setup_future_usage checkout (a new saved payment method),
// so re-enabling goes back through createExtensionCheckoutSession's opt-in
// checkbox on the next manual extension, not a bare flag flip.
export async function setAutoRenewEnabled(searchId: string, enabled: boolean): Promise<SetAutoRenewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: row, error: fetchError } = await supabase
    .from("customer_searches")
    .select("id")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (fetchError || !row) {
    return { ok: false, error: "Could not verify this search." };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("customer_searches")
    .update({ auto_renew_enabled: enabled })
    .eq("id", searchId);

  if (updateError) {
    return { ok: false, error: "Could not update auto-renew." };
  }

  return { ok: true };
}
