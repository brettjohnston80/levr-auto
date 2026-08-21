"use client";

import { useState } from "react";
import { markSearchPurchased } from "@/lib/outreach-actions";

export function MarkPurchasedButton({ searchId, offerId }: { searchId: string; offerId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    const res = await markSearchPurchased(searchId, offerId);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      setConfirming(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    return <span className="ml-2 text-xs text-emerald-400">Marked purchased</span>;
  }

  if (confirming) {
    return (
      <span className="ml-2 inline-flex flex-col items-start gap-1">
        <span className="text-xs text-zinc-300">
          This ends outreach and shows the customer a &ldquo;purchased&rdquo; celebration screen instead of their
          normal offer tracking. You can revert it later if the deal falls through.
        </span>
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className="rounded border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
          >
            {submitting ? "Marking…" : "Confirm"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setConfirming(false)}
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
    <span className="ml-2 inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-500/10"
      >
        Mark as purchased
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
