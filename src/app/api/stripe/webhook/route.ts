import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe webhook: the only place paid_at ever gets set. Runs with no user
// session, so it uses the service_role admin client — customers have no RLS
// path to write paid_at themselves.
//
// Deliberately does NOT touch search_status here. That only moves to
// 'searching' once the 24h post-payment refinement window closes — separate
// logic, not built yet (see CLAUDE.md).
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: `Webhook signature verification failed` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, skipped: "not paid" });
    }

    const customerId = session.metadata?.customer_id;
    const searchIdsRaw = session.metadata?.customer_search_ids;

    if (!customerId || !searchIdsRaw) {
      console.error("Stripe webhook: checkout.session.completed missing expected metadata", session.id);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    let searchIds: string[];
    try {
      searchIds = JSON.parse(searchIdsRaw);
    } catch {
      console.error("Stripe webhook: could not parse customer_search_ids metadata", session.id);
      return NextResponse.json({ error: "Malformed metadata" }, { status: 400 });
    }

    const admin = createAdminClient();

    // paid_at IS NULL guard makes this idempotent — Stripe can and does
    // redeliver the same event.
    const { data, error } = await admin
      .from("customer_searches")
      .update({
        paid_at: new Date().toISOString(),
        stripe_checkout_session_id: session.id,
      })
      .in("id", searchIds)
      .eq("customer_id", customerId)
      .is("paid_at", null)
      .select("id");

    if (error) {
      console.error("Stripe webhook: failed to update customer_searches", error.message);
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    console.log(`Stripe webhook: marked ${data.length} customer_searches row(s) paid for session ${session.id}`);
  }

  return NextResponse.json({ received: true });
}
