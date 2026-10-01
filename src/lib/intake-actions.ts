"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveUnpaidSearch, updateOwnUnpaidSearch } from "@/lib/unpaid-search";
import type { IntakeChoices, MatchmakerContext } from "@/lib/intake-choices";

export type IntakeVehicle = {
  make: string;
  model: string;
  /**
   * The model year the customer commits to (customer_searches.model_year).
   * Typed nullable only so a missing year reaches the validation and gets a
   * clear error, rather than being unrepresentable: a resumed pre-sign-in
   * stash written before this field existed carries none.
   */
  modelYear: number | null;
};

export type SaveIntakeResult =
  | { ok: true; searchId: string }
  | { ok: false; error: string; requiresAuth?: boolean };

// Intake saves the customer's ONE unpaid search (sign-up-to-payment fix,
// 2026-09-30): it updates their latest unpaid search if they have one,
// otherwise creates it -- see unpaid-search.ts, the shared helper the
// pop-up's sign-up and the Review and pay page also use. Only make, model,
// year, ZIP and pickup range are collected here; trim, colour and options
// come after payment (/finalize). paid_at stays null and search_status
// starts at 'awaiting_finalization' until Stripe confirms payment.

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function saveIntakeSearch(
  vehicle: IntakeVehicle,
  zip: string,
  /** The pickup-range form value (see PICKUP_TRAVEL_OPTIONS). Required for
   *  every vehicle-picked search; a plain string so a resumed stash written
   *  before the field existed reaches the check and gets a visible error. */
  pickupTravel: string | null,
  matchmaker?: MatchmakerContext,
): Promise<SaveIntakeResult> {
  const userId = await currentUserId();
  // Checked BEFORE validation on purpose: a signed-out customer must be
  // routed to the sign-up pop-up with their form intact, not shown an error.
  if (!userId) {
    return { ok: false, error: "Not signed in.", requiresAuth: true };
  }
  return saveUnpaidSearch(createAdminClient(), userId, {
    kind: "vehicle",
    make: vehicle.make,
    model: vehicle.model,
    modelYear: vehicle.modelYear,
    zip,
    pickupTravel,
    matchmaker,
  });
}

// The "not sure yet" intake path: a customer can pay with no vehicle picked
// and decide with their agent afterward (finalizeUndecidedSearch).
export async function saveUndecidedIntakeSearch(): Promise<SaveIntakeResult> {
  const userId = await currentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in.", requiresAuth: true };
  }
  return saveUnpaidSearch(createAdminClient(), userId, { kind: "undecided" });
}

/** Review and pay: edit the customer's own unpaid search before paying. */
export async function updateUnpaidSearch(
  searchId: string,
  choices: IntakeChoices,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  // Never trust a client-sent Matchmaker context on an edit.
  const safe: IntakeChoices = choices.kind === "vehicle" ? { ...choices, matchmaker: undefined } : choices;
  return updateOwnUnpaidSearch(createAdminClient(), userId, searchId, safe);
}
