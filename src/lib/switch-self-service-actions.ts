"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { EXTENSION_FEE } from "@/lib/vehicle-data";
import { isOfferedModelYear } from "@/lib/intake-vehicle-options";
import { syncListingsForMakeModel } from "@/lib/marketcheck-sync";
import { notifyAgentsOfCallRequest } from "@/lib/agent-call-notifications";

export type SwitchActionResult = { ok: true } | { ok: false; error: string };

async function getOwnedSwitchableSearch(searchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Not signed in." };
  }

  const { data: search, error } = await supabase
    .from("customer_searches")
    .select("id, search_status, paid_at, make, model, model_year")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (error || !search) {
    return { ok: false as const, error: "That search doesn't exist." };
  }
  if (!search.paid_at) {
    return { ok: false as const, error: "This search hasn't been paid for yet." };
  }
  if (search.search_status === "switched") {
    return { ok: false as const, error: "This search has already been switched." };
  }

  return {
    ok: true as const,
    userId: user.id,
    userEmail: user.email ?? null,
    make: (search.make as string | null) ?? null,
    model: (search.model as string | null) ?? null,
    modelYear: (search.model_year as number | null) ?? null,
  };
}

/**
 * The switched-to vehicle, validated against the live dataset (2026-09-14).
 *
 * Before this, both switch actions accepted FREE TEXT -- make and model
 * were only trimmed, never checked -- so a switch could create a search
 * for a vehicle that does not exist ("Hondaa Civc"). The same gate intake
 * and the free correction use now covers all three fields at once: a year
 * is only ever offered for a make/model that exists. Returns the same
 * approved wording those surfaces use.
 */
async function validateSwitchTarget(
  newMake: string,
  newModel: string,
  newModelYear: number | null,
): Promise<
  { ok: true; make: string; model: string; modelYear: number } | { ok: false; error: string }
> {
  const make = newMake.trim();
  const model = newModel.trim();
  if (!make || !model) {
    return { ok: false, error: "Make and model are required." };
  }
  if (newModelYear == null || !Number.isInteger(newModelYear)) {
    return { ok: false, error: "Choose a model year for this vehicle." };
  }
  if (!(await isOfferedModelYear(make, model, newModelYear))) {
    return { ok: false, error: "Pick a make, model, and model year from the list." };
  }
  return { ok: true, make, model, modelYear: newModelYear };
}

/**
 * Customer chooses "have an agent handle it" on the switch flow -- mirrors
 * requestFinalizationCall (finalize-actions.ts) exactly, including the same
 * guarded "set only if null" idempotency pattern already used for
 * call_requested_at.
 */
export async function requestSwitchCall(searchId: string): Promise<SwitchActionResult> {
  const check = await getOwnedSwitchableSearch(searchId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("customer_searches")
    .update({ switch_call_requested_at: new Date().toISOString() })
    .eq("id", searchId)
    .is("switch_call_requested_at", null)
    .select("id");

  if (error) {
    return { ok: false, error: `Failed to request a call: ${error.message}` };
  }

  if (updated && updated.length > 0) {
    await notifyAgentsOfCallRequest({
      callType: "switch",
      customerId: check.userId,
      make: check.make,
      model: check.model,
      modelYear: check.modelYear,
    });
  }

  revalidatePath("/account");
  revalidatePath("/internal/outreach");
  return { ok: true };
}

export type EligibilityResult = { ok: true; eligible: boolean } | { ok: false; error: string };

const GRACE_PERIOD_DAYS = 5;

/**
 * Read-only grace-period check -- gates which confirmation copy the
 * self-service flow shows next (free-switch vs $100 warning), so this must
 * never trust a client-computed answer. customers.created_at is the
 * "signup date" anchor (see CLAUDE.md "Pricing Pivot Tracking", Step 3b
 * discovery) -- no separate signup-date column exists or is needed.
 */
export async function checkSwitchEligibility(searchId: string): Promise<EligibilityResult> {
  const check = await getOwnedSwitchableSearch(searchId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  const { data: customer, error } = await admin
    .from("customers")
    .select("created_at, free_switch_used_at")
    .eq("id", check.userId)
    .single();

  if (error || !customer) {
    return { ok: false, error: "Could not verify eligibility." };
  }

  const graceWindowEnds = new Date(customer.created_at);
  graceWindowEnds.setDate(graceWindowEnds.getDate() + GRACE_PERIOD_DAYS);

  const eligible = customer.free_switch_used_at === null && new Date() <= graceWindowEnds;
  return { ok: true, eligible };
}

export type ExecuteFreeSwitchResult = { ok: true; newSearchId: string } | { ok: false; error: string };

/**
 * Actually performs a free grace-period switch. Re-checks eligibility
 * itself rather than trusting the earlier checkSwitchEligibility call that
 * produced the confirmation screen -- a customer could sit on that screen
 * long enough to cross out of the window, or burn their free switch in
 * another tab first. p_paid_at := now() so the new row reaches /finalize
 * without hitting the "go pay $699 again" wall (see the switch_fee_flow
 * migration's header comment for why that was a real gap). The
 * free_switch_used_at write is guarded "set only if null" -- same
 * first-write-wins pattern as switch-actions.ts's agent-initiated path.
 */
export async function executeFreeSwitch(
  searchId: string,
  newMake: string,
  newModel: string,
  newModelYear: number | null
): Promise<ExecuteFreeSwitchResult> {
  const check = await getOwnedSwitchableSearch(searchId);
  if (!check.ok) return check;

  const target = await validateSwitchTarget(newMake, newModel, newModelYear);
  if (!target.ok) return target;

  const eligibility = await checkSwitchEligibility(searchId);
  if (!eligibility.ok) return eligibility;
  if (!eligibility.eligible) {
    return { ok: false, error: "This switch is no longer free — the $100 switch fee applies." };
  }

  const admin = createAdminClient();

  const { data: newSearch, error: rpcError } = await admin.rpc("switch_customer_search", {
    p_old_search_id: searchId,
    p_new_make: target.make,
    p_new_model: target.model,
    p_new_model_year: target.modelYear,
    p_paid_at: new Date().toISOString(),
  });

  if (rpcError || !newSearch) {
    return { ok: false, error: `Failed to switch: ${rpcError?.message ?? "unknown error"}` };
  }

  await admin
    .from("customers")
    .update({ free_switch_used_at: new Date().toISOString() })
    .eq("id", check.userId)
    .is("free_switch_used_at", null);

  // Real inventory for the new vehicle before the customer lands on
  // /finalize -- the same call the $699 payment webhook makes. Without it a
  // switched search reaches the trim step with no listings because none
  // were ever fetched, which the zero-inventory block would misread as the
  // model genuinely having no stock. Non-fatal: the switch has succeeded.
  try {
    await syncListingsForMakeModel(target.make, target.model);
  } catch (syncError) {
    console.error(
      `executeFreeSwitch: on-demand MarketCheck sync failed for ${target.make} ${target.model}:`,
      syncError instanceof Error ? syncError.message : syncError
    );
  }

  revalidatePath("/account");
  return { ok: true, newSearchId: newSearch.id };
}

export type CreateSwitchFeeCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Starts a Stripe Checkout Session for the $100 paid-switch case (outside
 * the grace period, or the free switch already used). Mirrors
 * createCheckoutSession (payment-actions.ts) exactly -- inline price_data,
 * no stored Stripe Price ID, same success_url/{CHECKOUT_SESSION_ID}
 * convention. Uses EXTENSION_FEE, not a separate constant -- its own
 * comment already says "$100 per switch ... and per ~30-day Day-60
 * extension -- same flat fee for both", and the webhook's switch_fee
 * branch already falls back to EXTENSION_FEE * 100 for the payment record.
 *
 * Re-checks eligibility itself rather than trusting that the client only
 * reaches this action from the paid-warning screen -- if the customer is
 * actually still free-eligible (grace window not yet crossed, or a
 * concurrent tab already burned it), this rejects rather than charging
 * $100 for something that should be free.
 *
 * The vehicle is validated HERE, before any money moves: once the webhook
 * runs, payment has been taken and refusing is no longer an option.
 *
 * metadata must exactly match what handleSwitchFeePayment (the Stripe
 * webhook) reads: type, old_search_id, new_make, new_model, and
 * new_model_year (added 2026-09-14; Stripe metadata values are strings).
 * customer_id is an extra field the webhook itself doesn't read (it gets
 * that from the RPC's own return value) but /switch/success needs it for
 * its own ownership check, same pattern as payment-actions.ts's success
 * page.
 */
export async function createSwitchFeeCheckoutSession(
  searchId: string,
  newMake: string,
  newModel: string,
  newModelYear: number | null
): Promise<CreateSwitchFeeCheckoutResult> {
  const check = await getOwnedSwitchableSearch(searchId);
  if (!check.ok) return check;

  const target = await validateSwitchTarget(newMake, newModel, newModelYear);
  if (!target.ok) return target;

  const eligibility = await checkSwitchEligibility(searchId);
  if (!eligibility.ok) return eligibility;
  if (eligibility.eligible) {
    return { ok: false, error: "This switch is actually free — go back and confirm the free switch instead." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: check.userEmail ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: EXTENSION_FEE * 100,
          product_data: {
            name: "LEVR Auto — Switch Fee",
            description: `${target.modelYear} ${target.make} ${target.model}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "switch_fee",
      customer_id: check.userId,
      old_search_id: searchId,
      new_make: target.make,
      new_model: target.model,
      new_model_year: String(target.modelYear),
    },
    success_url: `${siteUrl}/switch/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/account`,
  });

  if (!session.url) {
    return { ok: false, error: "Could not start checkout." };
  }

  return { ok: true, url: session.url };
}
