"use client";

import { useState } from "react";
import { respondToOffer } from "@/lib/offer-response-actions";

// allowAccept is false while another offer on the same search is already
// accepted -- only Decline is offered, with a short note. respondToOffer
// still refuses a second accept server-side (a stale tab can reach it);
// hiding the button just means customers rarely see that error.
export function OfferResponseButtons({ offerId, allowAccept = true }: { offerId: string; allowAccept?: boolean }) {
  const [submitting, setSubmitting] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRespond(response: "accepted" | "declined") {
    setSubmitting(response);
    setError(null);

    const res = await respondToOffer(offerId, response);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      setSubmitting(null);
    }
    // On success, revalidatePath refreshes the page with the new status —
    // no local state to reset.
  }

  return (
    <div className="mt-3">
      {!allowAccept && (
        <p className="mb-2 text-xs text-zinc-500">You&apos;ve already accepted another offer on this search.</p>
      )}
      <div className="flex gap-2">
        {allowAccept && (
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => handleRespond("accepted")}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {submitting === "accepted" ? "Accepting…" : "Accept"}
          </button>
        )}
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => handleRespond("declined")}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {submitting === "declined" ? "Declining…" : "Decline"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
