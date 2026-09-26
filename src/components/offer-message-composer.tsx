"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendAgentMessage, sendCustomerMessage } from "@/lib/offer-message-actions";
import { MESSAGE_MAX_LENGTH } from "@/lib/offer-messages-shared";

// Approved copy (2026-09-25; privacy line revised by Brett).
const CUSTOMER_PLACEHOLDER = "e.g. Would they do $31,000? Is the sunroof included?";
const CUSTOMER_PRIVACY_LINE =
  "Only you and the LEVR team can see these messages. We don't send email or text alerts for new messages, so check back here or in Messages for replies.";

/**
 * Send box for an offer thread. The server action is authoritative about
 * whether the thread is open; callers only render this for an open thread.
 * Agent sends from the activity section pass `seenActivityAt`, so the reply
 * also marks that item reviewed (stale-page guarded server-side).
 */
export function OfferMessageComposer({
  offerId,
  sender,
  seenActivityAt = null,
}: {
  offerId: string;
  sender: "customer" | "agent";
  seenActivityAt?: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    const res =
      sender === "customer"
        ? await sendCustomerMessage(offerId, draft)
        : await sendAgentMessage(offerId, draft, seenActivityAt);
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setDraft("");
    router.refresh();
  }

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={MESSAGE_MAX_LENGTH}
        rows={3}
        placeholder={sender === "customer" ? CUSTOMER_PLACEHOLDER : "Reply to the customer…"}
        aria-label={sender === "customer" ? "Message your agent" : "Message the customer"}
        className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
      />
      <div className="mt-1 flex items-start justify-between gap-3 text-xs text-zinc-500">
        <span>{sender === "customer" ? CUSTOMER_PRIVACY_LINE : "The customer sees your first name."}</span>
        <span className="shrink-0">
          {draft.length}/{MESSAGE_MAX_LENGTH.toLocaleString()}
        </span>
      </div>
      <button
        type="button"
        disabled={sending}
        onClick={send}
        className="mt-2 rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
