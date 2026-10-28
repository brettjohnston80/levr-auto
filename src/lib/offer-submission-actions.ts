"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { SEND_REFUSALS } from "./offer-entry-copy";
import {
  attachOfferSheetFor,
  discardSubmissionFor,
  saveOfferDraftFor,
  sendOfferFor,
  type DiscardResult,
  type OfferPayload,
  type SaveDraftResult,
  type SendResult,
} from "./offer-submission";

// Every agent may draft, send and discard: it's the core of working a customer's deal (C16).

export async function saveOfferDraft(
  searchId: string,
  submissionId: string | null,
  payload: Partial<OfferPayload>,
): Promise<SaveDraftResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) return { ok: false, code: "not_authorized" };
  return saveOfferDraftFor(agent.id, searchId, submissionId, payload);
}

export async function sendOffer(searchId: string, submissionId: string | null, payload: OfferPayload): Promise<SendResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) return { ok: false, code: "not_authorized" };
  const result = await sendOfferFor(agent.id, searchId, submissionId, payload);
  if (result.ok) revalidatePath("/internal/outreach");
  return result;
}

export async function discardSubmission(submissionId: string, reason: string): Promise<DiscardResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) return { ok: false, code: "not_authorized" };
  const result = await discardSubmissionFor(agent.id, submissionId, reason);
  if (result.ok) revalidatePath("/internal/outreach");
  return result;
}

/**
 * After a send: stores the dealer's quote PDF (if the agent attached one in step 1) as the
 * offer's offer sheet, the same way Log Offer does. Failing here never undoes the offer.
 */
export async function attachOfferSheet(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const agent = await getAuthorizedAgent();
  if (!agent) return { ok: false, error: SEND_REFUSALS.not_authorized };
  const offerId = formData.get("offer_id")?.toString();
  const pdf = formData.get("pdf");
  if (!offerId || !(pdf instanceof File) || pdf.size === 0) return { ok: false, error: "No PDF to attach." };
  return attachOfferSheetFor(offerId, pdf);
}
