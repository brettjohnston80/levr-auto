import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIntakeModelYearOptions } from "@/lib/intake-vehicle-options";
import { TEST_EMAIL_SUFFIX, isTestEmail } from "@/lib/test-accounts";

// Durable seeding for the external tester program.
//
// WHY THIS EXISTS. Organically a tester can only reach `pending_refinement`
// -- intake, pay, finalize -- and then stops for 24 hours, because
// solidification is a cron gated on finalized_at + 24h. Everything past
// that is gated on time or on an agent: an offer can only be created by an
// agent, `paused` needs solidified_at + 60 days, `purchased` needs
// availability and deposit confirmed first. Without this route, testing the
// interesting half of the product means waiting out a real 30-60 day cycle.
//
// This is deliberately a PERMANENT route rather than another throwaway
// scratch one, because the tester program is recurring. That raises the bar
// on its guards, hence the four below.
//
// ---------------------------------------------------------------------------
// GUARDS
// ---------------------------------------------------------------------------
// 1. CRON_SECRET bearer auth, the same convention as every other internal
//    route here.
// 2. The target email MUST end in TEST_EMAIL_SUFFIX. This is the guard that
//    matters most and it is structural, not advisory: there is no code path
//    in this file that writes to a customer whose address does not end in
//    the tester-program suffix, so a typo cannot reach a real customer's
//    account. It is checked before the account is even looked up.
// 3. In production the route is inert unless ALLOW_TEST_SEEDING is set, so
//    the deployed app carries a fabricated-data writer that is switched off
//    by default rather than merely unadvertised.
// 4. `reset` makes states repeatable, so a tester account can be driven
//    through the same state twice without accumulating rows.
//
// Invocation is documented in CLAUDE.md as plain curl -- Brett runs these
// himself; Claude Code is not meant to be in the loop.

export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof createAdminClient>;

const STATES = [
  "paid_unfinalized",
  "searching",
  "offer_pending",
  "offer_accepted",
  "deal_in_progress",
  "paused",
  "purchased",
] as const;
type State = (typeof STATES)[number];

const DEFAULT_MAKE = "Toyota";
const DEFAULT_MODEL = "Camry";
const DEFAULT_ZIP = "66062";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const hoursAgo = (n: number) => new Date(Date.now() - n * 3600000).toISOString();

/**
 * Deletes every search belonging to a test account, in the ONE order that
 * actually works.
 *
 * This order is load-bearing and was established the hard way (2026-09-12):
 * two foreign keys do NOT cascade, and getting the order wrong fails
 * silently through supabase-js unless every error is checked.
 *
 *   1. customer_searches.purchased_qualifying_offer_id -> qualifying_offers
 *      has no cascade, so the search still points at the offer and the
 *      offer cannot be deleted until that pointer is nulled.
 *   2. cancellation_log.search_id -> customer_searches likewise does not
 *      cascade, so a cancelled search cannot be deleted while its log row
 *      exists.
 *
 * post_deal_surveys and deal_progress would cascade on their own, but are
 * deleted explicitly anyway: relying on cascade ordering for some children
 * and not others is how the above got missed in the first place.
 */
async function resetAccount(admin: Admin, customerId: string): Promise<string[]> {
  const errors: string[] = [];
  const check = (label: string, error: { message: string } | null) => {
    if (error) errors.push(`${label}: ${error.message}`);
  };

  const { data: searchRows, error: listError } = await admin
    .from("customer_searches")
    .select("id")
    .eq("customer_id", customerId);
  check("list searches", listError);
  const searchIds = (searchRows ?? []).map((r) => r.id as string);

  if (searchIds.length > 0) {
    // 1. Release the non-cascading pointer into qualifying_offers.
    check(
      "null purchased_qualifying_offer_id",
      (
        await admin
          .from("customer_searches")
          .update({ purchased_qualifying_offer_id: null })
          .in("id", searchIds)
      ).error
    );

    const { data: offerRows } = await admin
      .from("qualifying_offers")
      .select("id")
      .in("customer_search_id", searchIds);
    const offerIds = (offerRows ?? []).map((r) => r.id as string);

    check(
      "post_deal_surveys",
      (await admin.from("post_deal_surveys").delete().in("customer_search_id", searchIds)).error
    );
    check(
      "cancellation_log",
      (await admin.from("cancellation_log").delete().in("search_id", searchIds)).error
    );
    check(
      "purchase_status_log",
      (await admin.from("purchase_status_log").delete().in("search_id", searchIds)).error
    );
    check(
      "notification_events",
      (await admin.from("notification_events").delete().in("customer_search_id", searchIds)).error
    );
    if (offerIds.length > 0) {
      check(
        "deal_progress",
        (await admin.from("deal_progress").delete().in("qualifying_offer_id", offerIds)).error
      );
      check(
        "offer_addons",
        (await admin.from("offer_addons").delete().in("qualifying_offer_id", offerIds)).error
      );
    }
    check(
      "qualifying_offers",
      (await admin.from("qualifying_offers").delete().in("customer_search_id", searchIds)).error
    );
  }

  check(
    "customer_searches",
    (await admin.from("customer_searches").delete().eq("customer_id", customerId)).error
  );
  check(
    "search_option_selections",
    (await admin.from("search_option_selections").delete().in("search_id", searchIds.length ? searchIds : ["00000000-0000-0000-0000-000000000000"])).error
  );

  return errors;
}

/** Creates the search row for a state, plus any offer/progress it needs. */
async function seedState(
  admin: Admin,
  customerId: string,
  state: State,
  make: string,
  model: string,
  modelYear: number
): Promise<Record<string, unknown>> {
  // model_year on every seeded search (2026-09-14): a year is required for
  // real customers, so a tester seeded without one would be testing a state
  // no real customer can reach.
  const base = { customer_id: customerId, make, model, model_year: modelYear, zip: DEFAULT_ZIP };

  const insertSearch = async (extra: Record<string, unknown>) => {
    const { data, error } = await admin
      .from("customer_searches")
      .insert({ ...base, ...extra })
      .select("id, make, model, model_year, search_status, paid_at, finalized_at, solidified_at, paused_at, purchased_at")
      .single();
    if (error) throw new Error(`customer_searches insert failed: ${error.message}`);
    return data;
  };

  const insertOffer = async (searchId: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await admin
      .from("qualifying_offers")
      .insert({
        customer_search_id: searchId,
        dealer_name: "Seeded Test Motors",
        dealer_contact: "555-0100",
        // Below MSRP on purpose: is_below_msrp is a generated column, so
        // this is what makes the offer a genuine qualifying offer rather
        // than one that silently fails the guarantee logic.
        offer_price_cents: 3_150_000,
        msrp_cents: 3_400_000,
        received_at: hoursAgo(6),
        delivered_at: hoursAgo(5),
        ...extra,
      })
      .select("id, status, is_below_msrp, delivered_at")
      .single();
    if (error) throw new Error(`qualifying_offers insert failed: ${error.message}`);
    return data;
  };

  switch (state) {
    case "paid_unfinalized":
      return { search: await insertSearch({ paid_at: hoursAgo(2) }) };

    case "searching":
      // finalized_at backdated past the 24h window and solidified, which is
      // what the hourly solidify cron would otherwise take a day to do.
      return {
        search: await insertSearch({
          paid_at: daysAgo(3),
          finalized_at: daysAgo(2),
          solidified_at: daysAgo(1),
          search_status: "searching",
          trim: "LE",
          colors: ["Black", "White"],
        }),
      };

    case "offer_pending": {
      const search = await insertSearch({
        paid_at: daysAgo(5),
        finalized_at: daysAgo(4),
        solidified_at: daysAgo(3),
        search_status: "searching",
        trim: "LE",
      });
      return { search, offer: await insertOffer(search.id) };
    }

    case "offer_accepted": {
      const search = await insertSearch({
        paid_at: daysAgo(6),
        finalized_at: daysAgo(5),
        solidified_at: daysAgo(4),
        search_status: "searching",
        trim: "LE",
      });
      const offer = await insertOffer(search.id, {
        status: "customer_accepted",
        customer_responded_at: hoursAgo(3),
      });
      return { search, offer };
    }

    case "deal_in_progress": {
      const search = await insertSearch({
        paid_at: daysAgo(8),
        finalized_at: daysAgo(7),
        solidified_at: daysAgo(6),
        search_status: "searching",
        trim: "LE",
      });
      const offer = await insertOffer(search.id, {
        status: "customer_accepted",
        customer_responded_at: daysAgo(2),
      });
      const { data: progress, error } = await admin
        .from("deal_progress")
        .insert({
          qualifying_offer_id: offer.id,
          availability_reconfirmed_at: daysAgo(1),
          deposit_amount_cents: 50_000,
          deposit_confirmed_at: hoursAgo(12),
          financing_choice: "help",
          financing_income_range: "100k-150k",
          financing_down_payment_cents: 500_000,
          financing_desired_term_months: 60,
          delivery_method: "pickup",
        })
        .select("id, availability_reconfirmed_at, deposit_confirmed_at, financing_choice")
        .single();
      if (error) throw new Error(`deal_progress insert failed: ${error.message}`);
      return { search, offer, dealProgress: progress };
    }

    case "paused":
      // solidified 70 days ago puts it past the 60-day deadline; paused_at
      // 3 days ago leaves it inside the 30-day self-service resume window,
      // so the Extend button renders.
      return {
        search: await insertSearch({
          paid_at: daysAgo(72),
          finalized_at: daysAgo(71),
          solidified_at: daysAgo(70),
          search_status: "paused",
          paused_at: daysAgo(3),
          trim: "LE",
        }),
      };

    case "purchased": {
      const search = await insertSearch({
        paid_at: daysAgo(20),
        finalized_at: daysAgo(19),
        solidified_at: daysAgo(18),
        search_status: "searching",
        trim: "LE",
      });
      const offer = await insertOffer(search.id, {
        status: "customer_accepted",
        customer_responded_at: daysAgo(5),
      });
      const { error: progressError } = await admin.from("deal_progress").insert({
        qualifying_offer_id: offer.id,
        availability_reconfirmed_at: daysAgo(4),
        deposit_amount_cents: 50_000,
        deposit_confirmed_at: daysAgo(4),
        financing_choice: "own",
        delivery_method: "delivery",
      });
      if (progressError) throw new Error(`deal_progress insert failed: ${progressError.message}`);

      // markSearchPurchased requires availability AND deposit confirmed
      // first; both are set above, so this mirrors the real gate rather
      // than bypassing it.
      const { data: done, error } = await admin
        .from("customer_searches")
        .update({
          search_status: "purchased",
          purchased_at: daysAgo(2),
          purchased_qualifying_offer_id: offer.id,
        })
        .eq("id", search.id)
        .select("id, search_status, purchased_at, purchased_qualifying_offer_id")
        .single();
      if (error) throw new Error(`purchase update failed: ${error.message}`);
      return { search: done, offer };
    }
  }
}

export async function POST(req: NextRequest) {
  // Guard 1 -- shared-secret auth.
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Guard 3 -- inert in production unless explicitly switched on.
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_TEST_SEEDING) {
    return NextResponse.json(
      { error: "test seeding is disabled in production (set ALLOW_TEST_SEEDING to enable)" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    state?: string;
    make?: string;
    model?: string;
    model_year?: number;
    reset?: boolean;
  };
  const email = (body.email ?? "").trim();

  // Guard 2 -- THE structural one. Checked before the account is looked up,
  // so there is no path through this route that can touch a real customer.
  if (!isTestEmail(email)) {
    return NextResponse.json(
      {
        error: `refused: email must end in ${TEST_EMAIL_SUFFIX}`,
        received: email || null,
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();
  if (customerError) {
    return NextResponse.json({ error: customerError.message }, { status: 500 });
  }
  if (!customer) {
    return NextResponse.json({ error: `no test account found for ${email}` }, { status: 404 });
  }
  // Belt and braces: the row we actually matched must itself be a test
  // account, not merely the string we were handed.
  if (!isTestEmail(customer.email as string)) {
    return NextResponse.json({ error: "resolved account is not a test account" }, { status: 400 });
  }

  // Resolve the vehicle BEFORE resetting: a bad make/model/year must be
  // refused without wiping whatever state the tester account is in now.
  // Same live dataset every real surface validates against. Never guesses a
  // year for a two-year model -- the caller says which one.
  const make = body.make ?? DEFAULT_MAKE;
  const model = body.model ?? DEFAULT_MODEL;
  let modelYear: number | null = null;
  if (!(body.reset && !body.state)) {
    const offered = (await getIntakeModelYearOptions())[make]?.[model] ?? [];
    if (offered.length === 0) {
      return NextResponse.json(
        { error: `${make} ${model} is not in the live vehicle dataset` },
        { status: 400 }
      );
    }
    if (body.model_year != null) {
      if (!offered.includes(body.model_year)) {
        return NextResponse.json(
          { error: `model_year ${body.model_year} is not offered for ${make} ${model}`, offered },
          { status: 400 }
        );
      }
      modelYear = body.model_year;
    } else if (offered.length === 1) {
      modelYear = offered[0];
    } else {
      return NextResponse.json(
        { error: `${make} ${model} is offered in more than one model year -- pass model_year`, offered },
        { status: 400 }
      );
    }
  }

  const resetErrors = await resetAccount(admin, customer.id as string);
  if (resetErrors.length > 0) {
    return NextResponse.json({ error: "reset failed", details: resetErrors }, { status: 500 });
  }

  // reset-only: clear the account and stop.
  if (body.reset && !body.state) {
    return NextResponse.json({ ok: true, email, reset: true, state: null });
  }

  const state = body.state as State | undefined;
  if (!state || !STATES.includes(state)) {
    return NextResponse.json(
      { error: `state must be one of: ${STATES.join(", ")} (or pass reset:true alone)` },
      { status: 400 }
    );
  }

  try {
    const created = await seedState(
      admin,
      customer.id as string,
      state,
      make,
      model,
      modelYear as number
    );
    return NextResponse.json({ ok: true, email, state, created });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
