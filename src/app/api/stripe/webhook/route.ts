import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncListingsForMakeModel } from "@/lib/marketcheck-sync";
import { addDays, effectiveDeadline } from "@/lib/day60-extension";
import { recordPayment } from "@/lib/payments";
import { FLAT_PRICE, EXTENSION_FEE } from "@/lib/vehicle-data";

// Extracts a PaymentIntent id from a Checkout Session's payment_intent
// field, which Stripe sends as either a bare string id or an expanded
// object depending on how the session was fetched -- same narrowing
// already used by captureAutoRenewPaymentMethod below.
function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  if (!session.payment_intent) return null;
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
}

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

    if (paymentType === "extension_fee") {
      return handleExtensionFeePayment(session);
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

      const paymentIntentId = paymentIntentIdFromSession(session);
      if (paymentIntentId) {
        await recordPayment(admin, {
          customerId,
          searchId,
          paymentType: "search_fee",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          amountCents: session.amount_total ?? FLAT_PRICE * 100,
        });
      } else {
        console.error("Stripe webhook: search_payment session has no payment_intent, not recorded", session.id);
      }

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

  // Captures the new row (previously discarded) -- needed so the switch fee
  // payment can be recorded against it (payments.search_id for a switch_fee
  // row is the NEW row, mirroring how paid_at already lands there).
  const { data: newSearch, error } = await admin.rpc("switch_customer_search", {
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

  if (newSearch) {
    const paymentIntentId = paymentIntentIdFromSession(session);
    if (paymentIntentId) {
      await recordPayment(admin, {
        customerId: newSearch.customer_id,
        searchId: newSearch.id,
        paymentType: "switch_fee",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        amountCents: session.amount_total ?? EXTENSION_FEE * 100,
      });
    } else {
      console.error("Stripe webhook: switch_fee session has no payment_intent, not recorded", session.id);
    }
  }

  // No on-demand MarketCheck sync here yet, unlike the search_payment branch
  // above -- deliberately deferred, see CLAUDE.md "Pricing Pivot Tracking",
  // Step 3b: a freshly-switched search hits /finalize's existing empty-
  // listings fallback until this is built.

  return NextResponse.json({ received: true });
}

// extension_fee Checkout Sessions (extension-actions.ts) pay $100 to push a
// search's Day-60 deadline out 30 more days, and resume a search paused
// within its 7-day self-service window.
async function handleExtensionFeePayment(session: Stripe.Checkout.Session): Promise<NextResponse> {
  const searchId = session.metadata?.search_id;

  if (!searchId) {
    console.error(
      "Stripe webhook: checkout.session.completed (extension_fee) missing expected metadata",
      session.id
    );
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: row, error: fetchError } = await admin
    .from("customer_searches")
    .select("id, customer_id, solidified_at, search_deadline_at, last_extension_session_id")
    .eq("id", searchId)
    .maybeSingle();

  if (fetchError || !row) {
    console.error("Stripe webhook: extension_fee row lookup failed", searchId, fetchError?.message);
    return NextResponse.json({ error: "Search not found" }, { status: 400 });
  }

  if (!row.solidified_at) {
    console.error("Stripe webhook: extension_fee row has no solidified_at, can't compute deadline", searchId);
    return NextResponse.json({ error: "Search has no solidification anchor" }, { status: 400 });
  }

  const currentDeadline = effectiveDeadline({
    solidified_at: row.solidified_at,
    search_deadline_at: row.search_deadline_at,
  });
  const newDeadline = addDays(currentDeadline.toISOString(), 30);

  // Idempotency guard, deliberately NOT a plain .neq("last_extension_session_id",
  // session.id) as originally proposed: last_extension_session_id starts NULL
  // on every search's first-ever extension, and SQL's `NULL <> x` evaluates to
  // NULL (falsy in a WHERE clause) -- a bare .neq() would silently match zero
  // rows and block every first extension, not just retries. This OR explicitly
  // allows the null case through, while still no-opping a retry carrying the
  // same session id.
  const { data: updated, error: updateError } = await admin
    .from("customer_searches")
    .update({
      search_deadline_at: newDeadline.toISOString(),
      search_status: "searching",
      paused_at: null,
      last_extension_session_id: session.id,
    })
    .eq("id", searchId)
    .or(`last_extension_session_id.is.null,last_extension_session_id.neq.${session.id}`)
    .select("id");

  if (updateError) {
    console.error("Stripe webhook: extension_fee update failed", updateError.message);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    console.log(
      `Stripe webhook: extension_fee session ${session.id} already processed for search ${searchId} -- idempotent retry`
    );
    return NextResponse.json({ received: true, skipped: "already processed" });
  }

  console.log(
    `Stripe webhook: extended search ${searchId} deadline to ${newDeadline.toISOString()} for session ${session.id}`
  );

  if (row.customer_id) {
    const paymentIntentId = paymentIntentIdFromSession(session);
    if (paymentIntentId) {
      await recordPayment(admin, {
        customerId: row.customer_id,
        searchId,
        paymentType: "extension_fee",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        amountCents: session.amount_total ?? EXTENSION_FEE * 100,
      });
    } else {
      console.error("Stripe webhook: extension_fee session has no payment_intent, not recorded", session.id);
    }
  }

  // Auto-renew opt-in: capture the payment method setup_future_usage saved
  // off this charge, and flip the flag the Day-60 pause cron reads. Only
  // reached on a fresh (non-retry) success above, so this can't re-fire on
  // a redelivered webhook event.
  if (session.metadata?.enable_auto_renew === "true" && row.customer_id) {
    await captureAutoRenewPaymentMethod(session, row.customer_id, searchId);
  }

  return NextResponse.json({ received: true });
}

// Retrieves the PaymentIntent behind this Checkout Session to find the
// PaymentMethod setup_future_usage vaulted for later off-session use, then
// persists it plus flips auto_renew_enabled on the search. Failures here are
// logged but don't fail the webhook or undo the extension that already
// succeeded above — the customer paid and got their 30 days either way; a
// failed opt-in just means they'll be offered the checkbox again next time.
async function captureAutoRenewPaymentMethod(
  session: Stripe.Checkout.Session,
  customerId: string,
  searchId: string
): Promise<void> {
  if (!session.payment_intent) {
    console.error("Stripe webhook: extension_fee auto-renew opt-in but session has no payment_intent", session.id);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;

  try {
    const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
    const paymentMethodId =
      typeof paymentIntent.payment_method === "string"
        ? paymentIntent.payment_method
        : paymentIntent.payment_method?.id;

    if (!paymentMethodId) {
      console.error(
        "Stripe webhook: extension_fee auto-renew opt-in but payment_intent has no payment_method",
        paymentIntentId
      );
      return;
    }

    const admin = createAdminClient();
    const { error: customerUpdateError } = await admin
      .from("customers")
      .update({ stripe_default_payment_method_id: paymentMethodId })
      .eq("id", customerId);

    if (customerUpdateError) {
      console.error("Stripe webhook: failed to persist stripe_default_payment_method_id", customerUpdateError.message);
      return;
    }

    const { error: searchUpdateError } = await admin
      .from("customer_searches")
      .update({ auto_renew_enabled: true })
      .eq("id", searchId);

    if (searchUpdateError) {
      console.error("Stripe webhook: failed to set auto_renew_enabled", searchUpdateError.message);
      return;
    }

    console.log(`Stripe webhook: auto-renew enabled for search ${searchId}, payment method ${paymentMethodId} saved`);
  } catch (err) {
    console.error(
      "Stripe webhook: failed to capture auto-renew payment method",
      err instanceof Error ? err.message : err
    );
  }
}
