import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDealDetails } from "@/lib/customer-dashboard";
import { OfferCard } from "@/components/offer-card";
import { bestValueOfferId, summarizeOfferPrices } from "@/lib/offer-comparison";
import { PurchasedCelebration } from "@/components/purchased-celebration";
import { PostDealSurveyPrompt } from "@/components/post-deal-survey-prompt";
import { SearchStatusTimeline } from "@/components/search-status-timeline";
import { deriveSearchTimeline, type SearchTimelineBannerTone } from "@/lib/search-timeline";
import { SEARCH_STATUS_COPY, getPausedResumeInfo, getStatusCopy, getStatusBadge } from "@/lib/search-status-copy";
import { formatCents } from "@/lib/dashboard-format";
import { GetStartedButton } from "@/components/get-started-button";
import { PickupRangeControl } from "@/components/pickup-range-control";
import { OFFER_SORT_LABEL, OFFER_SORT_OPTIONS, parseOfferSort, sortOffers } from "@/lib/offer-sort";
import { isBeyondPickupRange, travelToValue } from "@/lib/pickup-travel";
import { mapAvailable } from "@/lib/map/config";
import { MAP_COPY, pinStatus, type OfferMapData } from "@/lib/map/pins";
import { OfferMapView } from "@/components/offer-map-view";
import { GuaranteeTimeline } from "@/components/guarantee-timeline";
import { deriveGuaranteeTimeline } from "@/lib/guarantee-timeline";
import { deriveProgressNote } from "@/lib/progress-note";
import { GENERAL_THREAD_COPY } from "@/lib/offer-messages-shared";

export const metadata: Metadata = {
  title: "Your Deal — LEVR Auto",
};

export const dynamic = "force-dynamic";

// Same exclusion list /account/vehicle uses -- a superseded/withdrawn/
// admin-closed search describes nothing real to negotiate anymore.
// Deliberately NOT including "purchased" here, same reasoning as that page:
// that search's offers are exactly what a customer would want this tab to
// keep showing (their permanent record of how the deal went).
const TERMINAL_STATUSES = ["switched", "cancelled", "closed"];

export default async function DealPage({
  searchParams,
}: {
  searchParams: Promise<{ searchId?: string; offer?: string; sort?: string; view?: string }>;
}) {
  const { searchId: requestedSearchId, offer: openOfferId, sort: sortParam, view: viewParam } = await searchParams;
  const sort = parseOfferSort(sortParam);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();

  // paid_at required (same as /account/vehicle) plus the extra gate that
  // matches deriveSearchTimeline's own: there's no deal to show until a
  // search has actually solidified, or it's a purchased search (which is
  // always solidified by the time it can reach that status).
  const { data: candidateSearches } = await admin
    .from("customer_searches")
    .select("id, make, model, search_status, solidified_at")
    .eq("customer_id", user.id)
    .not("paid_at", "is", null)
    .order("created_at", { ascending: false });

  const eligible = (candidateSearches ?? []).filter(
    (s) =>
      !TERMINAL_STATUSES.includes(s.search_status as string) &&
      (s.solidified_at !== null || s.search_status === "purchased"),
  );

  // No bounce to /account -- same reasoning as /account/vehicle's own empty
  // state: this tab is meant to be a stable, revisitable destination.
  if (eligible.length === 0) {
    return (
      <section className="bg-zinc-950 py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h1 className="text-2xl font-semibold text-white">No deal yet</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Once your search gets underway, this is where you&apos;ll come back to see your offers.
          </p>
          <GetStartedButton className="mt-8 inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400">
            Get Started
          </GetStartedButton>
          <div className="mt-6">
            <Link href="/account" className="text-sm text-zinc-400 hover:text-white">
              ← Back to your account
            </Link>
          </div>
        </div>
      </section>
    );
  }

  let targetId: string | null = null;
  if (requestedSearchId && eligible.some((s) => s.id === requestedSearchId)) {
    targetId = requestedSearchId;
  } else if (eligible.length === 1) {
    targetId = eligible[0].id as string;
  }

  // More than one candidate and none specified -- a real but rare case
  // (flat-fee/one-vehicle-at-a-time means this is normally exactly one).
  if (!targetId) {
    return (
      <section className="bg-zinc-950 py-24">
        <div className="mx-auto max-w-2xl px-6">
          <h1 className="text-2xl font-semibold text-white">Which deal?</h1>
          <p className="mt-2 text-sm text-zinc-400">
            You have more than one active search right now.
          </p>
          <ul className="mt-6 space-y-2">
            {eligible.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/account/deal?searchId=${s.id}`}
                  className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition-colors hover:border-white/25"
                >
                  {s.make} {s.model}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/account" className="mt-8 inline-block text-sm text-zinc-400 hover:text-white">
            ← Back to your account
          </Link>
        </div>
      </section>
    );
  }

  const deal = await getDealDetails(targetId, user.id);
  if (!deal) {
    redirect("/account");
  }

  const pausedInfo = deal.searchStatus === "paused" ? getPausedResumeInfo(deal.pausedAt) : null;
  const timelineInfo = deriveSearchTimeline(deal);
  // Same "reuse the already-approved text, never a second copy" rule the
  // timeline banner already follows on /account -- no new copy here.
  const timelineBanner: { tone: SearchTimelineBannerTone; text: string } | null = (() => {
    if (!timelineInfo?.bannerTone) return null;
    if (timelineInfo.bannerTone === "paused") {
      return { tone: "paused", text: pausedInfo?.copy ?? SEARCH_STATUS_COPY.paused };
    }
    return { tone: timelineInfo.bannerTone, text: SEARCH_STATUS_COPY[timelineInfo.bannerTone] };
  })();
  const suppressStatusParagraph = timelineBanner !== null;
  // A searching search gets an automatic progress note (2026-09-27) in place
  // of the old fixed "Actively searching…" line; other statuses keep theirs.
  const statusLine = deriveProgressNote(deal) ?? getStatusCopy(deal);
  const guaranteeTimeline = deriveGuaranteeTimeline(deal);
  const bestOfferId = bestValueOfferId(deal.offers);
  // At most one offer per search can be customer_accepted (2026-09-24), so
  // while one is, every pending card offers only Decline.
  const anOfferIsAccepted = deal.offers.some((o) => o.status === "customer_accepted");

  // Purchased-search-only. purchasedQualifyingOfferId is the source of truth
  // for which offer was actually bought (see its own comment on
  // DealDetails); the customer_accepted fallback only matters for a
  // purchased search predating that column's writer (2026-08-18).
  const acceptedOffer =
    deal.searchStatus === "purchased"
      ? (deal.offers.find((o) => o.id === deal.purchasedQualifyingOfferId) ??
        deal.offers.find((o) => o.status === "customer_accepted"))
      : undefined;
  const otherOffers = acceptedOffer ? deal.offers.filter((o) => o.id !== acceptedOffer.id) : [];
  const otherOffersSummary = summarizeOfferPrices(otherOffers);

  // List | Map toggle (2026-09-26): shown when there's at least one offer and
  // a Mapbox token is configured; List is the default. Both choices live in
  // the URL alongside sort.
  const canMap = mapAvailable() && deal.offers.length > 0;
  const showMap = canMap && viewParam === "map";
  const dealHref = (next: { sort?: string; view?: string }) => {
    const params = new URLSearchParams({ searchId: deal.searchId, sort: next.sort ?? sort });
    if ((next.view ?? (showMap ? "map" : "list")) === "map") params.set("view", "map");
    return `/account/deal?${params.toString()}`;
  };
  const mapData: OfferMapData | null = showMap
    ? {
        pins: deal.offers
          .filter((o) => o.mapLocation)
          .map((o) => ({
            offerId: o.id,
            lat: o.mapLocation!.lat,
            lng: o.mapLocation!.lng,
            approximate: o.mapLocation!.approximate,
            status: pinStatus(o.status),
            highlighted: o.status === "pending" && !!o.customerHighlightedAt,
            beyondRange: isBeyondPickupRange(deal.pickupTravel, o.distanceMiles, o.handoffMethod),
            dealerName: o.dealerName,
            priceCents: o.offerPriceCents,
            distanceMiles: o.distanceMiles,
            photoUrl: o.listingPhotoUrls[0] ?? o.photoUrl,
          })),
        unplacedCount: deal.offers.filter((o) => !o.mapLocation).length,
        customer: deal.customerLocation,
        rangeMiles: deal.pickupTravel?.choice === "distance" ? deal.pickupTravel.miles : null,
      }
    : null;

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-2xl px-6">
        <Link href="/account" className="text-sm text-zinc-400 hover:text-white">
          ← Back to your account
        </Link>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold text-white">
            {deal.make} {deal.model}
            {deal.trim ? <span className="text-zinc-400"> — {deal.trim}</span> : null}
          </h1>
          <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
            {getStatusBadge(deal)}
          </span>
        </div>

        {timelineInfo && (
          <SearchStatusTimeline
            stages={timelineInfo.stages}
            currentStageIndex={timelineInfo.currentStageIndex}
            banner={timelineBanner}
          />
        )}

        {deal.searchStatus !== "purchased" && !suppressStatusParagraph && (
          <p className="mt-3 text-sm text-zinc-400">{statusLine}</p>
        )}

        {guaranteeTimeline && <GuaranteeTimeline info={guaranteeTimeline} />}

        {deal.searchStatus === "purchased" && deal.make && deal.model ? (
          <>
            <PurchasedCelebration make={deal.make} model={deal.model} trim={deal.trim} />

            {acceptedOffer && (
              <ul className="mt-5 space-y-3">
                <OfferCard
                  searchId={deal.searchId}
                  offer={acceptedOffer}
                  make={deal.make}
                  model={deal.model}
                  isBestValue={acceptedOffer.id === bestOfferId}
                  anotherOfferAccepted={false}
                  initiallyOpen={acceptedOffer.id === openOfferId}
                />
              </ul>
            )}

            {/*
              Everything except the purchased offer, summarized rather than
              rendered as more cards -- a customer who already bought the
              car doesn't need every other dealer's full pitch again, just
              enough to know what else came in. Exact wording flagged for
              sign-off, not final.
            */}
            {otherOffersSummary && (
              <p className="mt-4 text-sm text-zinc-400">
                {otherOffersSummary.count} other offer{otherOffersSummary.count === 1 ? "" : "s"} received
                — lowest {formatCents(otherOffersSummary.lowestPriceCents)} · median{" "}
                {formatCents(otherOffersSummary.medianPriceCents)}
              </p>
            )}

            {deal.survey && <PostDealSurveyPrompt survey={deal.survey} />}
          </>
        ) : (
          <>
            <PickupRangeControl searchId={deal.searchId} value={travelToValue(deal.pickupTravel)} />

            <div className="mt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-300">
                  {deal.offers.length > 0 ? `Offers (${deal.offers.length})` : "No offers yet"}
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                {canMap && (
                  <nav aria-label="View" className="flex items-center gap-1 text-xs">
                    {(["list", "map"] as const).map((v) => (
                      <Link
                        key={v}
                        href={dealHref({ view: v })}
                        aria-current={(v === "map") === showMap ? "true" : undefined}
                        className={`rounded-full px-2.5 py-1 ${
                          (v === "map") === showMap ? "bg-white/10 font-semibold text-white" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {v === "map" ? MAP_COPY.toggleMap : MAP_COPY.toggleList}
                      </Link>
                    ))}
                  </nav>
                )}
                {deal.offers.length > 1 && (
                  <nav aria-label={OFFER_SORT_LABEL} className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-500">{OFFER_SORT_LABEL}</span>
                    {OFFER_SORT_OPTIONS.map((opt) => (
                      <Link
                        key={opt.value}
                        href={dealHref({ sort: opt.value })}
                        aria-current={sort === opt.value ? "true" : undefined}
                        className={`rounded-full px-2.5 py-1 ${
                          sort === opt.value
                            ? "bg-white/10 font-semibold text-white"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </Link>
                    ))}
                  </nav>
                )}
                </div>
              </div>
              {deal.offers.length === 0 && (
                <Link
                  href="/account/messages/general"
                  className="mt-2 inline-block text-sm text-emerald-400 underline hover:text-emerald-300"
                >
                  {GENERAL_THREAD_COPY.dealLink}
                </Link>
              )}
              {mapData && <OfferMapView data={mapData} />}
              {deal.offers.length > 0 && (
                // Kept mounted (hidden) in Map view so a pin's "View details"
                // can open the card's own detail view.
                <ul className={`mt-3 space-y-3 ${showMap ? "hidden" : ""}`}>
                  {sortOffers(deal.offers, sort).map((offer) => (
                    <OfferCard
                      key={offer.id}
                      searchId={deal.searchId}
                      offer={offer}
                      make={deal.make}
                      model={deal.model}
                      isBestValue={offer.id === bestOfferId}
                      anotherOfferAccepted={anOfferIsAccepted}
                      initiallyOpen={offer.id === openOfferId}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
