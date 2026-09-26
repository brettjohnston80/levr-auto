"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { respondToOffer } from "@/lib/offer-response-actions";
import { HighlightToggle } from "@/components/offer-highlight-controls";
import { OfferDetailModal } from "@/components/offer-detail-modal";
import type { DashboardOffer } from "@/lib/customer-dashboard";

/**
 * Every interactive control on an offer card, plus the detail modal they
 * open. Accept doesn't accept -- it opens the detail view, and the accept is
 * confirmed from there, after the customer has seen every detail. Decline
 * stays direct.
 *
 * While another offer on the search is accepted, a pending offer offers only
 * Decline plus a note (respondToOffer still refuses a second accept
 * server-side for a stale tab). Highlight/note are pending-only; on any other
 * status an existing note is shown read-only.
 */
export function OfferCardActions({
  offer,
  make,
  model,
  isBestValue,
  anotherOfferAccepted,
}: {
  offer: DashboardOffer;
  make: string | null;
  model: string | null;
  isBestValue: boolean;
  anotherOfferAccepted: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);

  const isPending = offer.status === "pending";

  async function decline() {
    setDeclining(true);
    setError(null);
    const res = await respondToOffer(offer.id, "declined");
    setDeclining(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5"
        >
          View details
        </button>
        {isPending && <HighlightToggle offerId={offer.id} highlighted={!!offer.customerHighlightedAt} />}
      </div>

      {offer.customerNote ? (
        <p className="mt-2 line-clamp-1 text-xs text-zinc-400">
          Your note: <span className="text-zinc-300">&ldquo;{offer.customerNote}&rdquo;</span>
          {isPending && (
            <button type="button" onClick={() => setOpen(true)} className="ml-2 text-emerald-400 underline">
              Edit note
            </button>
          )}
        </p>
      ) : (
        isPending && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 text-xs text-emerald-400 underline hover:text-emerald-300"
          >
            Add a note for your agent
          </button>
        )
      )}

      {isPending && (
        <div className="mt-3">
          {anotherOfferAccepted && (
            <p className="mb-2 text-xs text-zinc-500">You&apos;ve already accepted another offer on this search.</p>
          )}
          <div className="flex gap-2">
            {!anotherOfferAccepted && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950"
              >
                Accept
              </button>
            )}
            <button
              type="button"
              disabled={declining}
              onClick={decline}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {declining ? "Declining…" : "Decline"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      )}

      {open && (
        <OfferDetailModal
          offer={offer}
          make={make}
          model={model}
          isBestValue={isBestValue}
          anotherOfferAccepted={anotherOfferAccepted}
          onClose={close}
        />
      )}
    </div>
  );
}
