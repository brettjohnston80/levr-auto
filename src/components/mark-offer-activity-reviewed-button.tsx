"use client";

import { useState } from "react";
import { markOfferActivityReviewed } from "@/lib/outreach-actions";

// Same shape as ResolveNotificationCallbackButton. seenActivityAt is echoed
// back so a customer change made after this page loaded can't be marked
// reviewed without the agent seeing it.
export function MarkOfferActivityReviewedButton({
  offerId,
  seenActivityAt,
}: {
  offerId: string;
  seenActivityAt: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);

    const res = await markOfferActivityReviewed(offerId, seenActivityAt);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <button
        type="button"
        disabled={submitting}
        onClick={handleClick}
        className="rounded border border-white/10 px-2 py-0.5 text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Mark reviewed"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
