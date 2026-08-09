"use server";

import { createClient } from "@/lib/supabase/server";

export type IntakeVehicle = {
  make: string;
  model: string;
  trim: string;
  colors: string[];
};

export type SaveIntakeResult =
  | { ok: true; searchIds: string[] }
  | { ok: false; error: string; requiresAuth?: boolean };

// Writes one customer_searches row per vehicle in the package, all sharing the
// same package_size (1/2/3, matching the $699/$899/$999 tiers). No payment
// step yet — paid_at stays null and search_status starts at
// 'pending_refinement', same as every other intake row until Stripe lands.
export async function saveIntakeSearches(
  vehicles: IntakeVehicle[],
  zip: string
): Promise<SaveIntakeResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in.", requiresAuth: true };
  }

  const packageSize = vehicles.length;

  const rows = vehicles.map((vehicle) => ({
    customer_id: user.id,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim || null,
    colors: vehicle.colors,
    zip: zip || null,
    package_size: packageSize,
  }));

  const { data, error } = await supabase.from("customer_searches").insert(rows).select("id");

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, searchIds: data.map((row) => row.id) };
}
