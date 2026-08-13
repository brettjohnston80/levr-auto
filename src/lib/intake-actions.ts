"use server";

import { createClient } from "@/lib/supabase/server";

export type IntakeVehicle = {
  make: string;
  model: string;
  trim: string;
  colors: string[];
};

export type SaveIntakeResult =
  | { ok: true; searchId: string }
  | { ok: false; error: string; requiresAuth?: boolean };

// Writes a single customer_searches row for the one vehicle a customer is
// searching for — LEVR is flat $699 for exactly one vehicle, always. No
// payment step yet — paid_at stays null and search_status starts at
// 'pending_refinement', same as every other intake row until Stripe lands.
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
      trim: vehicle.trim || null,
      colors: vehicle.colors,
      zip: zip || null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, searchId: data.id };
}
