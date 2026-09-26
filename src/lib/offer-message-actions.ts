"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { getAuthorizedAgent } from "./agent-auth";
import { getCustomerUnreadThreadCount } from "./offer-messages";
import { CLOSED_SEND_ERROR, threadIsOpen, validateMessageBody } from "./offer-messages-shared";

export interface OfferMessageResult {
  ok: boolean;
  error?: string;
}

function revalidate() {
  revalidatePath("/account/deal");
  revalidatePath("/account/messages", "layout");
  revalidatePath("/internal/outreach");
}

// Loads the offer with its search's owner and status in one place, so both
// send paths check open/frozen against the same freshly-read state.
async function loadOfferContext(admin: ReturnType<typeof createAdminClient>, offerId: string) {
  const { data: offer } = await admin
    .from("qualifying_offers")
    .select("id, status, customer_search_id")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return null;
  const { data: search } = await admin
    .from("customer_searches")
    .select("customer_id, search_status")
    .eq("id", offer.customer_search_id)
    .maybeSingle();
  if (!search) return null;
  return {
    offerStatus: offer.status as string,
    customerId: search.customer_id as string,
    searchStatus: search.search_status as string,
  };
}

async function currentCustomerId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Customer posts to an offer's thread. Also bumps customer_activity_at so the
 * offer surfaces in the agent's "Customer activity on offers" section (the
 * stand-in for an alert -- no email/SMS is ever sent), and marks the thread
 * read for the customer, since they're looking at it.
 */
export async function sendCustomerMessage(offerId: string, body: string): Promise<OfferMessageResult> {
  const valid = validateMessageBody(body);
  if (!valid.ok) return valid;

  const userId = await currentCustomerId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const ctx = await loadOfferContext(admin, offerId);
  if (!ctx) return { ok: false, error: "That offer no longer exists." };
  if (ctx.customerId !== userId) return { ok: false, error: "Not authorized." };
  if (!threadIsOpen(ctx.offerStatus, ctx.searchStatus)) return { ok: false, error: CLOSED_SEND_ERROR };

  const { data: inserted, error } = await admin
    .from("offer_messages")
    .insert({ qualifying_offer_id: offerId, author_type: "customer", author_customer_id: userId, body: valid.text })
    .select("created_at")
    .single();
  if (error || !inserted) return { ok: false, error: `Failed to send: ${error?.message ?? "unknown error"}` };

  const at = inserted.created_at as string;
  const { error: stateError } = await admin
    .from("qualifying_offers")
    .update({ last_message_at: at, customer_activity_at: at, customer_messages_read_at: at })
    .eq("id", offerId);
  if (stateError) console.error("sendCustomerMessage: thread state update failed", stateError.message);

  revalidate();
  return { ok: true };
}

/** Customer opened this thread -- clears its unread badge. No-op if not theirs. */
export async function markThreadReadByCustomer(offerId: string): Promise<OfferMessageResult> {
  const userId = await currentCustomerId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const admin = createAdminClient();
  const ctx = await loadOfferContext(admin, offerId);
  if (!ctx || ctx.customerId !== userId) return { ok: false, error: "Not authorized." };

  await admin
    .from("qualifying_offers")
    .update({ customer_messages_read_at: new Date().toISOString() })
    .eq("id", offerId);
  return { ok: true };
}

/** Header badge: threads with an unread agent message. 0 when signed out. */
export async function getMyUnreadThreadCount(): Promise<number> {
  const userId = await currentCustomerId();
  if (!userId) return 0;
  try {
    return await getCustomerUnreadThreadCount(createAdminClient(), userId);
  } catch {
    // A badge must never break the header.
    return 0;
  }
}

/**
 * Agent posts to an offer's thread (reply or a new thread). When sent from
 * the activity section, `seenActivityAt` is the customer_activity_at that item
 * was rendered with: replying then also marks it reviewed -- but only if the
 * customer hasn't changed anything since, the same stale-page guard as
 * markOfferActivityReviewed. Replying never bumps customer_activity_at.
 */
export async function sendAgentMessage(
  offerId: string,
  body: string,
  seenActivityAt: string | null = null,
): Promise<OfferMessageResult> {
  const valid = validateMessageBody(body);
  if (!valid.ok) return valid;

  const agent = await getAuthorizedAgent();
  if (!agent) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const ctx = await loadOfferContext(admin, offerId);
  if (!ctx) return { ok: false, error: "That offer no longer exists." };
  if (!threadIsOpen(ctx.offerStatus, ctx.searchStatus)) return { ok: false, error: CLOSED_SEND_ERROR };

  const { data: inserted, error } = await admin
    .from("offer_messages")
    .insert({ qualifying_offer_id: offerId, author_type: "agent", author_agent_id: agent.id, body: valid.text })
    .select("created_at")
    .single();
  if (error || !inserted) return { ok: false, error: `Failed to send: ${error?.message ?? "unknown error"}` };

  const at = inserted.created_at as string;
  const { error: stateError } = await admin
    .from("qualifying_offers")
    .update({ last_message_at: at, last_agent_message_at: at })
    .eq("id", offerId);
  if (stateError) console.error("sendAgentMessage: thread state update failed", stateError.message);

  if (seenActivityAt) {
    await admin
      .from("qualifying_offers")
      .update({ agent_reviewed_at: new Date().toISOString() })
      .eq("id", offerId)
      .eq("customer_activity_at", seenActivityAt);
  }

  revalidate();
  return { ok: true };
}
