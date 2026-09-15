"use server";

import { createClient } from "@/lib/supabase/server";
import { isOfferedModelYear } from "@/lib/intake-vehicle-options";

export type IntakeVehicle = {
  make: string;
  model: string;
  /**
   * The model year the customer commits to (customer_searches.model_year).
   * Typed nullable only so a missing year reaches the validation below and
   * gets a clear error, rather than being unrepresentable: a resumed
   * pre-sign-in stash written before this field existed carries none.
   */
  modelYear: number | null;
};

export type SaveIntakeResult =
  | { ok: true; searchId: string }
  | { ok: false; error: string; requiresAuth?: boolean };

// Writes a single customer_searches row for the one vehicle a customer is
// searching for -- LEVR is flat $699 for exactly one vehicle, always. Only
// make/model/zip are collected here -- trim/color/options are collected
// post-payment during finalization (/finalize/[searchId], see
// finalize-actions.ts), matching the pending pivot's Steps 1-6: payment
// happens against a lighter intake, and finalizing it is a separate,
// explicit later step. No payment step yet either -- paid_at stays null and
// search_status starts at 'awaiting_finalization' (the column default)
// until Stripe lands.
/**
 * Context carried over when the customer arrived from a Matchmaker card
 * ("choose this car", steps 4-5). Optional: every other intake path --
 * typing a make/model directly, the "not sure yet" flow -- legitimately has
 * none, which is why both columns are nullable with no default.
 *
 * DISPLAY/REFERENCE ONLY. Neither value influences what the customer is
 * charged (a flat FLAT_PRICE built inline per Checkout Session) or how the
 * guarantee resolves (against a real dealer's MSRP). The price is the
 * Matchmaker's own researched estimate, not a quote.
 */
export type MatchmakerContext = {
  priceCents: number | null;
  modelYear: number | null;
};

export async function saveIntakeSearch(
  vehicle: IntakeVehicle,
  zip: string,
  matchmaker?: MatchmakerContext
): Promise<SaveIntakeResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in.", requiresAuth: true };
  }

  // Model year is a hard commitment from this point on (2026-09-14), so it
  // is re-checked here against the live dataset rather than trusted from
  // the select: this value decides which car an agent negotiates for.
  // Checked AFTER auth on purpose -- a signed-out customer must still be
  // routed to the auth gate with their form intact, not shown an error.
  const modelYear = vehicle.modelYear;
  if (
    modelYear == null ||
    !Number.isInteger(modelYear) ||
    !(await isOfferedModelYear(vehicle.make, vehicle.model, modelYear))
  ) {
    return { ok: false, error: "Choose a model year for this vehicle." };
  }

  const { data, error } = await supabase
    .from("customer_searches")
    .insert({
      customer_id: user.id,
      make: vehicle.make,
      model: vehicle.model,
      model_year: modelYear,
      zip: zip || null,
      // Explicit nulls rather than omitted keys, so a search that did not
      // come from a Matchmaker card is recorded as definitively having no
      // Matchmaker context rather than merely unset.
      matchmaker_price_cents: matchmaker?.priceCents ?? null,
      matchmaker_model_year: matchmaker?.modelYear ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, searchId: data.id };
}

// The "not sure yet" intake path (UX review #3) -- a customer can pay and
// create an account with zero vehicle info, deciding make/model with an
// agent afterward in one combined consultation call (finalizeUndecidedSearch).
// make/model are nullable specifically for this path; search_status still
// starts at 'awaiting_finalization' (the column default), same as the
// normal intake path.
export async function saveUndecidedIntakeSearch(): Promise<SaveIntakeResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in.", requiresAuth: true };
  }

  const { data, error } = await supabase
    .from("customer_searches")
    .insert({
      customer_id: user.id,
      make: null,
      model: null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, searchId: data.id };
}
