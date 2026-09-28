"use client";

import { useState } from "react";
import { OfferMessageList } from "@/components/offer-message-list";
import { OfferMessageComposer } from "@/components/offer-message-composer";
import type { OfferMessage } from "@/lib/offer-messages-shared";

/**
 * Agent view of one offer's customer thread, collapsed to a "Messages (N)"
 * toggle (or "Message customer" when empty) so a search card with several
 * offers stays scannable. Frozen threads stay readable with no send box.
 * With `offerId` null it's the customer's general thread (2026-09-27), which
 * is always open and labelled "General messages".
 */
export function AgentOfferThread({
  offerId,
  customerId = null,
  messages,
  open,
}: {
  offerId: string | null;
  customerId?: string | null;
  messages: OfferMessage[];
  open: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!open && messages.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="text-xs text-emerald-400 underline hover:text-emerald-300"
      >
        {offerId === null
          ? `General messages (${messages.length})`
          : messages.length > 0
            ? `Messages (${messages.length})`
            : "Message customer"}
      </button>
      {expanded && (
        <div className="mt-2 max-w-xl space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
          {messages.length > 0 && <OfferMessageList messages={messages} viewer="agent" />}
          {open ? (
            <OfferMessageComposer offerId={offerId} customerId={customerId} sender="agent" />
          ) : (
            <p className="text-xs text-zinc-500">Thread closed (offer released or search ended) — read only.</p>
          )}
        </div>
      )}
    </div>
  );
}
