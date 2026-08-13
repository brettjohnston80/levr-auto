"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { verifyOwnedAcceptedOffer } from "./offer-ownership";

export interface SubmitFinancingResult {
  ok: boolean;
  error?: string;
}

/**
 * Captures the customer's financing choice — pure data capture, never a
 * credit pull (that's FCRA-regulated and needs a compliant vendor
 * partnership later). 'own' uploads proof of financing to the documents
 * Storage bucket; 'help' records self-reported preference fields only.
 * Freely re-submittable — this isn't a state machine, just record-keeping,
 * so a later submission simply overwrites/adds via upsert rather than being
 * guarded against.
 */
export async function submitFinancingChoice(formData: FormData): Promise<SubmitFinancingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const offerId = formData.get("qualifying_offer_id")?.toString();
  const choice = formData.get("financing_choice")?.toString();

  if (!offerId || (choice !== "own" && choice !== "help")) {
    return { ok: false, error: "Invalid submission." };
  }

  const admin = createAdminClient();

  const ownership = await verifyOwnedAcceptedOffer(admin, offerId, user.id);
  if (!ownership.ok) {
    return ownership;
  }

  if (choice === "help") {
    const incomeRange = formData.get("income_range")?.toString() || null;
    const downPaymentRaw = formData.get("down_payment")?.toString();
    const desiredTermRaw = formData.get("desired_term_months")?.toString();

    const downPaymentCents = downPaymentRaw ? Math.round(parseFloat(downPaymentRaw) * 100) : null;
    const desiredTermMonths = desiredTermRaw ? parseInt(desiredTermRaw, 10) : null;

    const { error } = await admin.from("deal_progress").upsert(
      {
        qualifying_offer_id: offerId,
        financing_choice: "help",
        financing_income_range: incomeRange,
        financing_down_payment_cents:
          downPaymentCents !== null && Number.isFinite(downPaymentCents) ? downPaymentCents : null,
        financing_desired_term_months:
          desiredTermMonths !== null && Number.isFinite(desiredTermMonths) ? desiredTermMonths : null,
      },
      { onConflict: "qualifying_offer_id" }
    );

    if (error) {
      return { ok: false, error: `Failed to save: ${error.message}` };
    }
  } else {
    const file = formData.get("financing_proof");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Please upload proof of financing." };
    }

    const path = `${offerId}/${randomUUID()}-${file.name}`;
    const { error: uploadError } = await admin.storage.from("documents").upload(path, file, {
      contentType: file.type || undefined,
    });

    if (uploadError) {
      return { ok: false, error: `Failed to upload file: ${uploadError.message}` };
    }

    const { error: docError } = await admin.from("documents").insert({
      qualifying_offer_id: offerId,
      type: "financing_proof",
      storage_path: path,
      uploaded_at: new Date().toISOString(),
    });

    if (docError) {
      return { ok: false, error: `Failed to save document: ${docError.message}` };
    }

    const { error: dpError } = await admin.from("deal_progress").upsert(
      { qualifying_offer_id: offerId, financing_choice: "own" },
      { onConflict: "qualifying_offer_id" }
    );

    if (dpError) {
      return { ok: false, error: `Failed to save: ${dpError.message}` };
    }
  }

  revalidatePath("/account");
  revalidatePath("/internal/outreach");
  return { ok: true };
}
