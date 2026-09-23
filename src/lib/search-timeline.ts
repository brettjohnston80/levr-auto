import type { DashboardSearch } from "./customer-dashboard";

/**
 * Customer-facing journey stages, in order. There is deliberately no new
 * "status" column behind this -- current stage is derived at read time from
 * data that already exists (search_status + the offers array), the same
 * convention this codebase already uses for evaluateOfferGuaranteeContribution
 * (guarantee.ts) and getStatusCopy/getPausedResumeInfo (account/page.tsx). A
 * derived value can't drift from the real underlying data the way a second
 * stored copy could.
 */
export type SearchTimelineStageKey = "searching" | "offer_received" | "accepted" | "purchased";

export interface SearchTimelineStage {
  key: SearchTimelineStageKey;
  label: string;
}

// Labels are the customer-facing copy for this feature and still need
// sign-off -- flagging explicitly rather than treating "Searching / Offer
// received / Accepted / Purchased" as already approved just because they
// matched the original request's own example wording.
export const SEARCH_TIMELINE_STAGES: SearchTimelineStage[] = [
  { key: "searching", label: "Searching" },
  { key: "offer_received", label: "Offer received" },
  { key: "accepted", label: "Accepted" },
  { key: "purchased", label: "Purchased" },
];

/**
 * paused/cancelled/switched aren't timeline stages -- they're interruptions
 * layered on top of whichever stage the search had already reached (see
 * SearchStatusTimeline's `banner` prop). No new copy is introduced for these:
 * account/page.tsx resolves the actual banner text from the same
 * already-approved SEARCH_STATUS_COPY / getPausedResumeInfo strings it
 * already renders elsewhere, so there's nothing new to sign off on for the
 * banner text itself.
 */
export type SearchTimelineBannerTone = "paused" | "cancelled" | "switched";

export interface SearchTimelineInfo {
  stages: SearchTimelineStage[];
  currentStageIndex: number;
  bannerTone: SearchTimelineBannerTone | null;
}

/**
 * Returns null when the search hasn't reached "searching" yet (still
 * awaiting_finalization / pending_refinement, or cancelled/switched before
 * ever solidifying) -- there is no journey to show a timeline for yet, so
 * SearchCard falls back to its existing plain status text in that case.
 */
export function deriveSearchTimeline(search: DashboardSearch): SearchTimelineInfo | null {
  if (!search.solidifiedAt && search.searchStatus !== "purchased") {
    return null;
  }

  const hasAcceptedOffer = search.offers.some((o) => o.status === "customer_accepted");
  const hasAnyOffer = search.offers.length > 0;

  const currentStageIndex =
    search.searchStatus === "purchased" ? 3 : hasAcceptedOffer ? 2 : hasAnyOffer ? 1 : 0;

  const bannerTone: SearchTimelineBannerTone | null =
    search.searchStatus === "paused"
      ? "paused"
      : search.searchStatus === "cancelled"
        ? "cancelled"
        : search.searchStatus === "switched"
          ? "switched"
          : null;

  return { stages: SEARCH_TIMELINE_STAGES, currentStageIndex, bannerTone };
}
