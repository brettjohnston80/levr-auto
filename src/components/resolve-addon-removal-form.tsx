"use client";

import { useState } from "react";
import { resolveAddonRemoval, type AddonRemovalOutcome } from "@/lib/outreach-actions";

const OUTCOME_LABELS: Record<AddonRemovalOutcome, string> = {
  dealer_accepted: "Dealer accepted",
  dealer_declined: "Dealer declined",
  dealer_countered: "Dealer countered",
};

export function ResolveAddonRemovalForm({ addonId }: { addonId: string }) {
  const [dealerResponse, setDealerResponse] = useState("");
  const [submitting, setSubmitting] = useState<AddonRemovalOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve(outcome: AddonRemovalOutcome) {
    setSubmitting(outcome);
    setError(null);

    const res = await resolveAddonRemoval(addonId, outcome, dealerResponse.trim() || null);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      setSubmitting(null);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-3">
      <label className="block text-xs text-zinc-400">What did the dealer say? (optional)</label>
      <textarea
        value={dealerResponse}
        onChange={(e) => setDealerResponse(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {(Object.keys(OUTCOME_LABELS) as AddonRemovalOutcome[]).map((outcome) => (
          <button
            key={outcome}
            type="button"
            disabled={submitting !== null}
            onClick={() => handleResolve(outcome)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/5 disabled:opacity-50"
          >
            {submitting === outcome ? "Saving…" : OUTCOME_LABELS[outcome]}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
