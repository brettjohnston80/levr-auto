"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CommunicationFrequency } from "./communication-preferences";

export interface UpdateAccountSettingsResult {
  ok: boolean;
  error?: string;
}

/**
 * Updates a customer's own profile + notification preferences from the new
 * /account settings section. Same auth-then-admin-client pattern as every
 * other customer-initiated write in this app (submitFinancingChoice,
 * submitDeliveryPreference, etc.) -- verify the signed-in user via the
 * regular client, then write via the admin client scoped to that user's id.
 */
export async function updateAccountSettings(formData: FormData): Promise<UpdateAccountSettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const firstName = (formData.get("first_name") as string)?.trim();
  const lastName = (formData.get("last_name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const notifyByEmail = formData.get("notify_by_email") === "on";
  const notifyByText = formData.get("notify_by_text") === "on";
  const notifyByAgentCallback = formData.get("notify_by_agent_callback") === "on";
  const frequency = formData.get("communication_frequency") as CommunicationFrequency;

  if (!firstName || !lastName) {
    return { ok: false, error: "First and last name are both required." };
  }

  if (!phone) {
    return { ok: false, error: "A phone number is required." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("customers")
    .update({
      first_name: firstName,
      last_name: lastName,
      phone,
      notify_by_email: notifyByEmail,
      notify_by_text: notifyByText,
      notify_by_agent_callback: notifyByAgentCallback,
      communication_frequency: frequency,
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: `Failed to save: ${error.message}` };
  }

  revalidatePath("/account");
  return { ok: true };
}
