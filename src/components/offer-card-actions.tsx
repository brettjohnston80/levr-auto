"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { respondToOffer } from "@/lib/offer-response-actions";
import { HighlightToggle } from "@/components/offer-highlight-controls";
import { OfferDetailModal } from "@/components/offer-detail-modal";
import { OPEN_OFFER_EVENT } from "@/components/offer-map-view";
import type { DashboardOffer } from "@/lib/customer-dashboard";

/**
 * Every interactive control on an offer card, plus the detail modal they
 * open. Accept doesn't accept -- it opens the detail view, and the accept is
 * confirmed from there, after the customer has seen every detail. Decline
 * stays direct.
 *
 * While another offer on the search is accepted, a pending offer offers only
 * Decline (respondToOffer still refuses a second accept server-side for a
 * stale tab). Highlight is pending-only. The message thread (2026-09-25,
 * replaced the customer note) opens in the detail view; the card only shows
 * the entry point and an unread badge, and never marks anything read.
 */
// Server snapshot false, client true: the modal portals into document.body,
// so a deep-linked (initially open) modal must wait until the client --
// rendering it during SSR throws "document is not defined".
const noopSubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function OfferCardActions({
  offer,
  make,
  model,
  isBestValue,
  anotherOfferAccepted,
  initiallyOpen = false,
}: {
  offer: DashboardOffer;
  make: string | null;
  model: string | null;
  isBestValue: boolean;
  anotherOfferAccepted: boolean;
  /** Deep link (/account/deal?offer=...) -- open this offer's detail view on load. */
  initiallyOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const isClient = useIsClient();

  // A map pin's "View details" (Your Deal's Map view) opens this offer.
  useEffect(() => {
    function onOpen(e: Event) {
      if ((e as CustomEvent<{ offerId: string }>).detail?.offerId === offer.id) setOpen(true);
    }
    window.addEventListener(OPEN_OFFER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_OFFER_EVENT, onOpen);
  }, [offer.id]);

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

      {offer.hasUnreadMessages && (
        <span className="mt-2 inline-block rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
          New message from your agent
        </span>
      )}
      {(offer.messages.length > 0 || offer.threadOpen) && (
        <div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 text-xs text-emerald-400 underline hover:text-emerald-300"
          >
            {offer.messages.length > 0 ? `Messages (${offer.messages.length})` : "Message your agent"}
          </button>
        </div>
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

      {open && isClient && (
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
