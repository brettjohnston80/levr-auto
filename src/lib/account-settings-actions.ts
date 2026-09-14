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

  // ⚠ ZERO CHANNELS IS NOT A PREFERENCE, IT IS AN UNREACHABLE ACCOUNT.
  // Rejected rather than auto-corrected on purpose: silently flipping a
  // channel back on would tell the customer their save succeeded exactly as
  // asked while storing something else, and this is the setting that
  // decides whether they ever hear that an offer came in. The client
  // already prevents reaching this state, so in practice only a crafted or
  // stale request lands here -- and it should be told no, not quietly
  // rewritten. Email is named because it is the one channel that always
  // works: there is no SMS provider integrated, so a text-only customer is
  // already flagged undeliverable rather than actually messaged.
  if (!notifyByEmail && !notifyByText && !notifyByAgentCallback) {
    return {
      ok: false,
      error: "Pick at least one way for us to reach you — email is the safest default.",
    };
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
