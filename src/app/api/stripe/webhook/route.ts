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

    // metadata.type discriminates which Checkout flow this is. Missing
    // metadata.type defaults to "search_payment" for backward compatibility
    // with any Checkout Session created before this field existed (payment-
    // actions.ts now always sets it explicitly going forward).
    const paymentType = session.metadata?.type ?? "search_payment";

    if (paymentType === "switch_fee") {
      return handleSwitchFeePayment(session);
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

// switch_customer_search (supabase/migrations/20260814130000_switch_fee_flow.sql)
// raises a plain `raise exception 'search % has already been switched', ...`
// with no explicit SQLSTATE, which Postgres/PL-pgSQL defaults to 'P0001' (the
// generic raise_exception code -- the RPC's *other* exception, "row % not
// found", also raises P0001, hence checking the message text too, not just
// the code, so a genuine not-found error still surfaces as a real failure
// rather than being silently swallowed as "already handled").
function isAlreadySwitchedError(error: { code?: string | null; message: string }): boolean {
  return error.code === "P0001" && error.message.includes("has already been switched");
}

// switch_fee Checkout Sessions don't exist yet in the app (self-service UI
// is a separate, later pass -- see CLAUDE.md "Pricing Pivot Tracking", Step
// 3b) but this branch is built now so the webhook side is ready for it.
//
// new_make/new_model come from the Checkout Session's own metadata, set once
// at session-creation time and immutable after -- never from
// customer_searches.pending_switch_make/model, which are display-only and
// could have been overwritten by a second switch request before this event
// (created by an earlier, still-in-flight session) is delivered.
async function handleSwitchFeePayment(session: Stripe.Checkout.Session): Promise<NextResponse> {
  const oldSearchId = session.metadata?.old_search_id;
  const newMake = session.metadata?.new_make;
  const newModel = session.metadata?.new_model;

  if (!oldSearchId || !newMake || !newModel) {
    console.error(
      "Stripe webhook: checkout.session.completed (switch_fee) missing expected metadata",
      session.id
    );
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.rpc("switch_customer_search", {
    p_old_search_id: oldSearchId,
    p_new_make: newMake,
    p_new_model: newModel,
    p_paid_at: new Date().toISOString(),
  });

  if (error) {
    if (isAlreadySwitchedError(error)) {
      // Stripe redelivered an event for a switch that already succeeded on
      // an earlier delivery -- the idempotent-retry case, not a failure.
      console.log(
        `Stripe webhook: switch_fee session ${session.id} already processed (search ${oldSearchId} already switched) -- treating as idempotent retry`
      );
      return NextResponse.json({ received: true, skipped: "already switched" });
    }

    console.error("Stripe webhook: switch_customer_search RPC failed", error.message);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }

  console.log(`Stripe webhook: switched search ${oldSearchId} to ${newMake} ${newModel} for session ${session.id}`);

  // No on-demand MarketCheck sync here yet, unlike the search_payment branch
  // above -- deliberately deferred, see CLAUDE.md "Pricing Pivot Tracking",
  // Step 3b: a freshly-switched search hits /finalize's existing empty-
  // listings fallback until this is built.

  return NextResponse.json({ received: true });
}
