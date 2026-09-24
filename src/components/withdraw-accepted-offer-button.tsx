"use client";

import { useState } from "react";
import { withdrawAcceptedOffer } from "@/lib/outreach-actions";

// Agent-only. Same inline confirm shape as MarkPurchasedButton, plus a
// required reason -- releasing an accepted offer is a real judgment call
// worth a note, like revertPurchasedSearch.
export function WithdrawAcceptedOfferButton({ offerId }: { offerId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await withdrawAcceptedOffer(offerId, reason);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return <span className="ml-2 text-xs text-amber-400">Offer released</span>;
  }

  if (confirming) {
    return (
      <span className="mt-1 flex flex-col items-start gap-1">
        <span className="text-xs text-zinc-300">
          This moves the offer to &ldquo;withdrawn&rdquo; so the customer can accept a different offer on this
          search. It can&apos;t be undone — if the deal comes back, log it as a new offer.
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Why is this deal being released? (required)"
          className="w-full max-w-md rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white"
        />
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className="rounded border border-amber-500/30 px-2 py-0.5 text-xs text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
          >
            {submitting ? "Releasing…" : "Confirm release"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
            className="rounded border border-white/10 px-2 py-0.5 text-xs text-zinc-400 hover:bg-white/5"
          >
            Cancel
          </button>
        </span>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="ml-2 rounded border border-amber-500/30 px-2 py-0.5 text-xs text-amber-400 hover:bg-amber-500/10"
    >
      Release this accepted offer
    </button>
  );
}
