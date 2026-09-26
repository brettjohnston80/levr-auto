"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { respondToOffer } from "@/lib/offer-response-actions";
import { computeOfferSavings } from "@/lib/offer-comparison";
import { formatCents } from "@/lib/dashboard-format";
import { SilhouetteIcon } from "@/components/vehicle-silhouette";
import { HighlightToggle, NoteEditor } from "@/components/offer-highlight-controls";
import type { DashboardOffer } from "@/lib/customer-dashboard";

// Approved copy (2026-09-25). "refundable" deliberately removed.
const ACCEPT_EXPLANATION =
  "Accepting tells your agent this is the car you want. They'll confirm it's still available and help you place a deposit with the dealer. You can accept one offer per search.";

/**
 * Full offer detail, in place over the "Your Deal" page (not a separate
 * route). Also the ONLY place an accept can be confirmed: the card's Accept
 * button opens this rather than accepting directly, so the customer sees
 * every detail first. Decline stays a direct action (card and here).
 *
 * Deliberately never shows dealer phone/email/listing link -- same rule as
 * dealer_contact, which customers have never been shown.
 *
 * Portaled to document.body, with scrolling and centering on separate
 * elements -- both lessons from VehicleDetailModal (the page wrapper's
 * will-change-transform traps fixed children; items-center on a scroll
 * container makes a tall card's top unreachable).
 */
export function OfferDetailModal({
  offer,
  make,
  model,
  isBestValue,
  anotherOfferAccepted,
  onClose,
}: {
  offer: DashboardOffer;
  make: string | null;
  model: string | null;
  isBestValue: boolean;
  anotherOfferAccepted: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPending = offer.status === "pending";
  const savings = computeOfferSavings(offer);
  const vehicleName = [make, model].filter(Boolean).join(" ");

  useEffect(() => {
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  async function respond(response: "accepted" | "declined") {
    setSubmitting(response);
    setError(null);
    const res = await respondToOffer(offer.id, response);
    setSubmitting(null);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    onClose();
    router.refresh();
  }

  const addressLines = [
    offer.dealerStreet,
    [offer.dealerCity, [offer.dealerState, offer.dealerZip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
  ].filter((line) => line && line.trim() !== "");

  const miles = offer.distanceMiles === null ? null : Math.max(1, Math.round(offer.distanceMiles));

  return createPortal(
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm sm:px-6" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`offer-detail-${offer.id}`}
          tabIndex={-1}
          className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/60 focus:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline gap-2 pr-8">
              <h2 id={`offer-detail-${offer.id}`} className="text-xl font-semibold text-white">
                {offer.dealerName}
              </h2>
              {isBestValue && (
                <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950">
                  Best value
                </span>
              )}
              {offer.isBelowMsrp && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                  Below Total SRP
                </span>
              )}
            </div>
            {vehicleName && <p className="mt-1 text-sm text-zinc-400">{vehicleName}</p>}

            <PhotoGallery offer={offer} alt={vehicleName} />

            <Section title="Price">
              <p className="text-sm text-zinc-400">
                Offer: <span className="text-white">{formatCents(offer.offerPriceCents)}</span> — Total Suggested
                Retail Price: {formatCents(offer.msrpCents)}
              </p>
              {savings && (
                <p className="mt-0.5 text-sm font-medium text-emerald-400">
                  {formatCents(savings.belowMsrpCents)} below Total SRP ({savings.belowMsrpPercent}% off)
                </p>
              )}
            </Section>

            {(addressLines.length > 0 || miles !== null) && (
              <Section title="Dealership">
                {addressLines.map((line) => (
                  <p key={line} className="text-sm text-zinc-300">
                    {line}
                  </p>
                ))}
                {miles !== null && (
                  <p className="mt-1 text-sm text-zinc-400">
                    About {miles} {miles === 1 ? "mile" : "miles"} from you.
                  </p>
                )}
              </Section>
            )}

            {(offer.vehicleTrim || offer.vehicleExteriorColor || offer.vin || offer.stockNumber || offer.inTransit) && (
              <Section title="Vehicle">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {offer.vehicleTrim && <Row label="Trim" value={offer.vehicleTrim} />}
                  {offer.vehicleExteriorColor && <Row label="Color" value={offer.vehicleExteriorColor} />}
                  {offer.vin && <Row label="VIN" value={offer.vin} />}
                  {offer.stockNumber && <Row label="Stock #" value={offer.stockNumber} />}
                </dl>
                {offer.inTransit && (
                  <span className="mt-2 inline-block rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
                    In transit to the dealer
                  </span>
                )}
              </Section>
            )}

            {offer.addons.length > 0 && (
              <Section title="Add-ons">
                <ul className="space-y-1 text-sm text-zinc-300">
                  {offer.addons.map((addon) => (
                    <li key={addon.id}>
                      {addon.description} — {formatCents(addon.amountCents)}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {offer.offerSheetUrl && (
              <a
                href={offer.offerSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-block text-sm text-emerald-400 underline hover:text-emerald-300"
              >
                View offer sheet (PDF)
              </a>
            )}

            {isPending ? (
              <Section title="Tell your agent">
                <HighlightToggle offerId={offer.id} highlighted={!!offer.customerHighlightedAt} />
                <p className="mt-2 text-xs text-zinc-500">
                  Interested but not ready to accept? Highlight it so your agent knows.
                </p>
                <div className="mt-4">
                  <NoteEditor offerId={offer.id} note={offer.customerNote} />
                </div>
              </Section>
            ) : (
              offer.customerNote && (
                <Section title="Tell your agent">
                  <p className="text-sm text-zinc-300">
                    Your note: <span className="text-zinc-200">&ldquo;{offer.customerNote}&rdquo;</span>
                  </p>
                </Section>
              )
            )}
          </div>

          {/* -bottom-8 + the extra 2rem of bottom padding cancel the backdrop's
              py-8: sticky positions inside the scroller's padding box, so a
              plain bottom-0 left a 32px strip where modal content scrolled
              visibly underneath the footer. */}
          <div className="sticky -bottom-8 rounded-b-3xl border-t border-white/10 bg-zinc-950/95 p-5 pb-13 backdrop-blur sm:px-8">
            {isPending && !anotherOfferAccepted && (
              <p className="mb-3 text-xs text-zinc-400">{ACCEPT_EXPLANATION}</p>
            )}
            {isPending && anotherOfferAccepted && (
              <p className="mb-3 text-xs text-zinc-500">You&apos;ve already accepted another offer on this search.</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {isPending && !anotherOfferAccepted && (
                <button
                  type="button"
                  disabled={submitting !== null}
                  onClick={() => respond("accepted")}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
                >
                  {submitting === "accepted" ? "Accepting…" : "Accept this offer"}
                </button>
              )}
              <button
                type="button"
                disabled={submitting !== null}
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Go back
              </button>
              {isPending && (
                <button
                  type="button"
                  disabled={submitting !== null}
                  onClick={() => respond("declined")}
                  className="ml-auto rounded-lg px-3 py-2 text-sm text-zinc-400 underline hover:text-white disabled:opacity-50"
                >
                  {submitting === "declined" ? "Declining…" : "Decline"}
                </button>
              )}
            </div>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="break-all text-zinc-200">{value}</dd>
    </>
  );
}

// Real dealer photos of this exact car when the offer is linked to a listing
// (and LISTING_PHOTOS_ENABLED is on); otherwise the one stock color photo,
// clearly labeled as NOT the dealer's car; otherwise the placeholder.
// Never presents a stock image as the actual vehicle.
function PhotoGallery({ offer, alt }: { offer: DashboardOffer; alt: string }) {
  const listing = offer.listingPhotoUrls;
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const markBroken = (url: string) => setBroken((prev) => new Set(prev).add(url));

  const usableListing = listing.filter((u) => !broken.has(u));
  if (usableListing.length > 0) {
    const current = usableListing[Math.min(active, usableListing.length - 1)];
    return (
      <div className="mt-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote dealer photos, not a fixed set next/image is configured for */}
        <img
          src={current}
          alt={alt}
          onError={() => markBroken(current)}
          className="aspect-[4/3] w-full rounded-2xl border border-white/10 object-cover"
        />
        <p className="mt-1 text-xs text-zinc-500">From the dealer&apos;s listing</p>
        {usableListing.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {usableListing.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Photo ${i + 1} of ${usableListing.length}`}
                className={`shrink-0 overflow-hidden rounded-md border ${
                  url === current ? "border-emerald-400" : "border-white/10"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                <img src={url} alt="" onError={() => markBroken(url)} className="h-14 w-20 object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (offer.photoUrl && !broken.has(offer.photoUrl)) {
    return (
      <div className="mt-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- public/ asset dropped in at deploy time */}
        <img
          src={offer.photoUrl}
          alt={alt}
          onError={() => markBroken(offer.photoUrl!)}
          className="aspect-[4/3] w-full rounded-2xl border border-white/10 bg-white object-contain"
        />
        <p className="mt-1 text-xs text-zinc-500">Stock photo of this color — not the dealer&apos;s actual car</p>
      </div>
    );
  }

  return (
    <div className="relative mt-5 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]">
      <span className="absolute top-3 left-3 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-amber-400 uppercase">
        Photo coming soon
      </span>
      <SilhouetteIcon vehicleType="" className="h-20 w-44 text-zinc-500" />
    </div>
  );
}
