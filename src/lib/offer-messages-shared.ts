// Offer message threads (2026-09-25) -- pure rules shared by the server
// actions (authoritative) and every UI surface, so "can this thread take a
// new message" is decided in exactly one place. No server imports: the
// client components import this directly.

export const MESSAGE_MAX_LENGTH = 1000;

export interface OfferMessage {
  id: string;
  authorType: "customer" | "agent";
  /** Display label, already resolved for the viewer: "You" / an agent's
   *  first name for a customer; "Customer" / an agent's name for agents. */
  authorLabel: string;
  body: string;
  createdAt: string;
}

// Searches that are over as far as the customer is concerned. `purchased` is
// deliberately NOT here: delivery and paperwork questions continue after it.
const FROZEN_SEARCH_STATUSES = ["switched", "cancelled", "closed"];

/**
 * Open: pending, accepted and declined offers (declined stays open, Brett
 * 2026-09-25, so "why did you pass?" can happen in the thread). Frozen: an
 * offer an agent released (withdrawn), or any offer on a switched/cancelled/
 * closed search. A frozen thread is still readable; only sending is blocked.
 */
export function threadIsOpen(offerStatus: string, searchStatus: string): boolean {
  if (offerStatus === "withdrawn") return false;
  return !FROZEN_SEARCH_STATUSES.includes(searchStatus);
}

// Approved copy (2026-09-25). No "declined" variant -- declined threads are open.
export function frozenThreadCopy(offerStatus: string): string {
  return offerStatus === "withdrawn"
    ? "This conversation is closed because this offer was released."
    : "This conversation is closed because this search has ended.";
}

/** First word of agents.name, which is NOT NULL but free text. */
export function agentFirstName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || "Your agent";
}

/** Validates a message body; returns the trimmed text or an approved error. */
export function validateMessageBody(body: string): { ok: true; text: string } | { ok: false; error: string } {
  const text = (body ?? "").trim();
  if (text.length === 0) return { ok: false, error: "Write a message before sending." };
  if (text.length > MESSAGE_MAX_LENGTH) return { ok: false, error: "Messages can be up to 1,000 characters." };
  return { ok: true, text };
}

export const CLOSED_SEND_ERROR = "This conversation is closed, so new messages can't be sent.";

// General thread copy (approved 2026-09-27).
export const GENERAL_THREAD_COPY = {
  title: "Your LEVR agent",
  listPreviewEmpty: "Questions about your search? Message your agent.",
  emptyState: "No messages yet. Ask your agent anything about your search — they'll reply here.",
  dealLink: "Message your agent",
} as const;
