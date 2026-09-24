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
  searchParams: Promise<{ searchId?: string }>;
}) {
  const { searchId: requestedSearchId } = await searchParams;
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

        {deal.searchStatus === "purchased" && deal.make && deal.model ? (
          <>
            <PurchasedCelebration make={deal.make} model={deal.model} trim={deal.trim} />

            {acceptedOffer && (
              <ul className="mt-5 space-y-3">
                <OfferCard
                  offer={acceptedOffer}
                  make={deal.make}
                  model={deal.model}
                  isBestValue={acceptedOffer.id === bestOfferId}
                  anotherOfferAccepted={false}
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
            {!suppressStatusParagraph && (
              <p className="mt-3 text-sm text-zinc-400">{getStatusCopy(deal)}</p>
            )}

            <div className="mt-5">
              <h2 className="text-sm font-semibold text-zinc-300">
                {deal.offers.length > 0 ? `Offers (${deal.offers.length})` : "No offers yet"}
              </h2>
              {deal.offers.length > 0 && (
                <ul className="mt-3 space-y-3">
                  {deal.offers.map((offer) => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      make={deal.make}
                      model={deal.model}
                      isBestValue={offer.id === bestOfferId}
                      anotherOfferAccepted={anOfferIsAccepted}
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
