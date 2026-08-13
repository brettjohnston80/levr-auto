import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncListingsForMakeModel } from "@/lib/marketcheck-sync";

// Stripe webhook: the only place paid_at ever gets set. Runs with no user
// session, so it uses the service_role admin client -- customers have no RLS
// path to write paid_at themselves.
//
// Deliberately does NOT touch search_status here. That only moves off
// 'awaiting_finalization' once the customer (or an agent, on a call)
// explicitly finalizes trim/color/options -- see finalize-actions.ts.
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
    const searchId = session.metadata?.customer_search_id;

    if (!customerId || !searchId) {
      console.error("Stripe webhook: checkout.session.completed missing expected metadata", session.id);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const admin = createAdminClient();

    // paid_at IS NULL guard makes this idempotent -- Stripe can and does
    // redeliver the same event.
    const { data, error } = await admin
      .from("customer_searches")
      .update({
        paid_at: new Date().toISOString(),
        stripe_checkout_session_id: session.id,
      })
      .eq("id", searchId)
      .eq("customer_id", customerId)
      .is("paid_at", null)
      .select("id, make, model");

    if (error) {
      console.error("Stripe webhook: failed to update customer_searches", error.message);
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    console.log(`Stripe webhook: marked ${data.length} customer_searches row(s) paid for session ${session.id}`);

    // Kick off a real MarketCheck sync for this exact make/model now, rather
    // than waiting for the nightly demand-driven job (which won't even see
    // this search until it reaches 'searching', after finalization) -- so by
    // the time the customer reaches /finalize, there's real trim/price data
    // to show instead of an empty list. Awaited, not fire-and-forget: Vercel
    // serverless functions can kill pending background work once the
    // response is sent, so this needs to finish before the handler returns.
    // A sync failure here is logged but doesn't fail the webhook or block
    // payment confirmation -- the finalize page has its own graceful
    // no-data fallback, and the customer has already paid either way.
    if (data.length > 0) {
      const { make, model } = data[0];
      try {
        await syncListingsForMakeModel(make, model);
      } catch (syncError) {
        console.error(
          `Stripe webhook: on-demand MarketCheck sync failed for ${make} ${model}:`,
          syncError instanceof Error ? syncError.message : syncError
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
