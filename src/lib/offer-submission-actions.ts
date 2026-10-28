"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import {
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
