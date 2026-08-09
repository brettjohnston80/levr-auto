"use server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { TIER_PRICING } from "@/lib/vehicle-data";

export type CreateCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

// Starts a Stripe Checkout Session for a package of customer_searches rows
// that were already created by the intake flow. Does NOT set paid_at here —
// that only happens once Stripe confirms payment via the webhook
// (checkout.session.completed). This action just verifies ownership, prices
// the package, and hands back a Checkout URL to redirect to.
export async function createCheckoutSession(searchIds: string[]): Promise<CreateCheckoutResult> {
  if (searchIds.length < 1 || searchIds.length > 3) {
    return { ok: false, error: "Invalid number of vehicles." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  // Verify these rows actually belong to this user and are unpaid before
  // charging anything — never trust IDs from the client alone.
  const { data: rows, error: fetchError } = await supabase
    .from("customer_searches")
    .select("id, make, model, package_size, paid_at")
    .in("id", searchIds)
    .eq("customer_id", user.id);

  if (fetchError || !rows || rows.length !== searchIds.length) {
    return { ok: false, error: "Could not verify this search." };
  }
  if (rows.some((row) => row.paid_at !== null)) {
    return { ok: false, error: "This search has already been paid for." };
  }

  const packageSize = rows[0].package_size;
  if (!rows.every((row) => row.package_size === packageSize)) {
    return { ok: false, error: "Search package mismatch." };
  }

  const priceDollars = TIER_PRICING[packageSize];
  if (!priceDollars) {
    return { ok: false, error: "Unknown pricing tier." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const vehicleSummary = rows.map((row) => `${row.make} ${row.model}`).join(", ");

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    // No payment_method_types — omitting lets Stripe's dynamic payment
    // methods pick the best options for the customer automatically.
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: priceDollars * 100,
          product_data: {
            name: `LEVR Auto — ${packageSize}-Vehicle Search`,
            description: vehicleSummary,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      customer_id: user.id,
      customer_search_ids: JSON.stringify(searchIds),
    },
    success_url: `${siteUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/#get-started`,
  });

  if (!session.url) {
    return { ok: false, error: "Could not start checkout." };
  }

  return { ok: true, url: session.url };
}
