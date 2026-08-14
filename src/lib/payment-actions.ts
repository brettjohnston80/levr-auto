"use server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { FLAT_PRICE } from "@/lib/vehicle-data";

export type CreateCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

// Starts a Stripe Checkout Session for the one customer_searches row that
// was already created by the intake flow. Does NOT set paid_at here — that
// only happens once Stripe confirms payment via the webhook
// (checkout.session.completed). This action just verifies ownership and
// hands back a Checkout URL to redirect to — price is always flat $699.
export async function createCheckoutSession(searchId: string): Promise<CreateCheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  // Verify this row actually belongs to this user and is unpaid before
  // charging anything — never trust an ID from the client alone.
  const { data: row, error: fetchError } = await supabase
    .from("customer_searches")
    .select("id, make, model, paid_at")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (fetchError || !row) {
    return { ok: false, error: "Could not verify this search." };
  }
  if (row.paid_at !== null) {
    return { ok: false, error: "This search has already been paid for." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    // No payment_method_types — omitting lets Stripe's dynamic payment
    // methods pick the best options for the customer automatically.
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: FLAT_PRICE * 100,
          product_data: {
            name: "LEVR Auto — Vehicle Search",
            description: `${row.make} ${row.model}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "search_payment",
      customer_id: user.id,
      customer_search_id: searchId,
    },
    success_url: `${siteUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/#get-started`,
  });

  if (!session.url) {
    return { ok: false, error: "Could not start checkout." };
  }

  return { ok: true, url: session.url };
}
