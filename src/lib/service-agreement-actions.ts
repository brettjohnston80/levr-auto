"use server";

import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { verifyOwnedAcceptedOffer } from "./offer-ownership";
import { createAndSendServiceAgreement, createSigningSession } from "./pandadoc/client";

export interface StartSigningResult {
  ok: boolean;
  error?: string;
  alreadySigned?: boolean;
  sessionId?: string;
}

/**
 * Starts (or resumes) the LEVR service-agreement e-sign flow for an
 * accepted offer. Reuses an existing PandaDoc document if one was already
 * created for this offer — only ever creates one document per offer, since
 * a signing *session* (short-lived) is a different thing from the
 * underlying *document* (persists in PandaDoc regardless of session
 * expiry) and re-visiting this page shouldn't spam PandaDoc with
 * duplicate document creations.
 */
export async function startServiceAgreementSigning(offerId: string): Promise<StartSigningResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { ok: false, error: "Not signed in." };
  }

  const admin = createAdminClient();

  const ownership = await verifyOwnedAcceptedOffer(admin, offerId, user.id);
  if (!ownership.ok) {
    return ownership;
  }

  const { data: existing, error: existingError } = await admin
    .from("documents")
    .select("id, external_signature_id, signed_at")
    .eq("qualifying_offer_id", offerId)
    .eq("type", "service_agreement")
    .maybeSingle();

  if (existingError) {
    return { ok: false, error: `Failed to check document status: ${existingError.message}` };
  }

  if (existing?.signed_at) {
    return { ok: true, alreadySigned: true };
  }

  let documentId = existing?.external_signature_id ?? null;

  if (!documentId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const [firstName, ...rest] = (customer?.full_name ?? "").split(" ");

    try {
      documentId = await createAndSendServiceAgreement({
        email: user.email,
        firstName: firstName || null,
        lastName: rest.join(" ") || null,
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to create the service agreement.",
      };
    }

    const { error: insertError } = await admin.from("documents").insert({
      qualifying_offer_id: offerId,
      type: "service_agreement",
      external_signature_id: documentId,
    });

    if (insertError) {
      return { ok: false, error: `Failed to save document record: ${insertError.message}` };
    }
  }

  try {
    const session = await createSigningSession(documentId, user.email);
    return { ok: true, sessionId: session.sessionId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to start the signing session.",
    };
  }
}

export interface ConfirmSignedResult {
  ok: boolean;
  error?: string;
}

/**
 * Called client-side the moment the embedded signing widget reports
 * document.completed — the primary way signed_at gets set, since webhooks
 * aren't available on the current PandaDoc plan. This is "the browser
 * telling us it saw completion," not an authoritative server-to-server
 * confirmation; a closed tab or client-side failure mid-flow can miss it,
 * which is exactly the gap the agent-facing "Check signing status" button
 * (getDocumentStatus, asked directly of PandaDoc) exists to close.
 */
export async function confirmServiceAgreementSigned(offerId: string): Promise<ConfirmSignedResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const admin = createAdminClient();

  const ownership = await verifyOwnedAcceptedOffer(admin, offerId, user.id);
  if (!ownership.ok) {
    return ownership;
  }

  const { error } = await admin
    .from("documents")
    .update({ signed_at: new Date().toISOString() })
    .eq("qualifying_offer_id", offerId)
    .eq("type", "service_agreement")
    .is("signed_at", null);

  if (error) {
    return { ok: false, error: `Failed to record signature: ${error.message}` };
  }

  return { ok: true };
}
