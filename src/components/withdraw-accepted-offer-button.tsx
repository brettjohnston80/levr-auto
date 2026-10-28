"use client";

import { useState } from "react";
import { withdrawAcceptedOffer } from "@/lib/outreach-actions";
import { WithdrawReasonFields, withdrawReasonProblem } from "./withdraw-reason-fields";

// Agent-only. Same inline confirm shape as MarkPurchasedButton, plus a
// required reason -- releasing an accepted offer is a real judgment call
// worth a note, like revertPurchasedSearch. Same reason choice as withdrawing a pending offer.
export function WithdrawAcceptedOfferButton({ offerId }: { offerId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    const problem = withdrawReasonProblem(reasonCode, note);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await withdrawAcceptedOffer(offerId, reasonCode, note);
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
        <WithdrawReasonFields
          idPrefix={`release-${offerId}`}
          reasonCode={reasonCode}
          note={note}
          onReasonCode={setReasonCode}
          onNote={setNote}
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
