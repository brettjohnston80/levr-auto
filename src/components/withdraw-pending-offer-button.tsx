"use client";

import { useState } from "react";
import { withdrawPendingOffer } from "@/lib/offer-submission-actions";
import { WITHDRAW_COPY } from "@/lib/offer-entry-draft-copy";
import { WithdrawReasonFields, withdrawReasonProblem } from "./withdraw-reason-fields";

// Agent-only (OE-5b): withdraw an offer the customer hasn't accepted, e.g. to send a corrected one.
export function WithdrawPendingOfferButton({ offerId }: { offerId: string }) {
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleConfirm() {
    const problem = withdrawReasonProblem(reasonCode, note);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await withdrawPendingOffer(offerId, reasonCode, note);
    setSubmitting(false);
    if (!res.ok) {
      setError(WITHDRAW_COPY.refusals[res.code] ?? "Something went wrong.");
      return;
    }
    setDone(WITHDRAW_COPY.done(res.customerFirstName));
  }

  if (done) return <span className="ml-2 text-xs text-amber-400">{done}</span>;

  if (open) {
    return (
      <span className="mt-1 flex flex-col items-start gap-2">
        <WithdrawReasonFields
          idPrefix={`withdraw-${offerId}`}
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
            {submitting ? "Withdrawing…" : WITHDRAW_COPY.confirm}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setOpen(false);
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
      onClick={() => setOpen(true)}
      className="rounded border border-amber-500/30 px-2 py-0.5 text-xs text-amber-400 hover:bg-amber-500/10"
    >
      {WITHDRAW_COPY.button}
    </button>
  );
}
