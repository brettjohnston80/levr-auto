"use server";

import { createClient } from "@/lib/supabase/server";

export type IntakeVehicle = {
  make: string;
  model: string;
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
export async function saveIntakeSearch(
  vehicle: IntakeVehicle,
  zip: string
): Promise<SaveIntakeResult> {
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
      make: vehicle.make,
      model: vehicle.model,
      zip: zip || null,
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
