"use server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { EXTENSION_FEE } from "@/lib/vehicle-data";

export type CreateExtensionCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

const RESUME_WINDOW_DAYS = 7;

// Starts a Stripe Checkout Session for a $100 Day-60 extension payment.
// Mirrors createCheckoutSession (payment-actions.ts) — inline price_data, no
// stored Stripe Price ID, success_url kept simple (back to /account; whether
// that page reflects the extension before the webhook finishes is a
// dashboard-UI concern for the next pass, not this one).
//
// Server-side eligibility check, never trusting a client-side gate alone
// (same standard as executeFreeSwitch): a search is extendable if it's
// still actively searching (always eligible to extend early, no restriction
// on how far from the deadline) or if it was paused within the last 7 days
// (the self-service resume window). A search paused longer than that needs
// agent intervention, not a checkout button.
export async function createExtensionCheckoutSession(searchId: string): Promise<CreateExtensionCheckoutResult> {
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
        error: "This search has been paused too long to resume automatically — contact your agent.",
      };
    }
  } else if (row.search_status !== "searching") {
    return { ok: false, error: "This search can't be extended right now." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
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
    metadata: {
      type: "extension_fee",
      customer_id: user.id,
      search_id: searchId,
    },
    success_url: `${siteUrl}/account`,
    cancel_url: `${siteUrl}/account`,
  });

  if (!session.url) {
    return { ok: false, error: "Could not start checkout." };
  }

  return { ok: true, url: session.url };
}
