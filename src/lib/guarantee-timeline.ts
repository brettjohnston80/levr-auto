import { formatLongDate } from "./dashboard-format";

// Guarantee timeline on Your Deal (2026-09-27, plan:
// docs/plans/guarantee-progress-notifications-plan.md). Derived at read time
// from data that already exists -- no stored stage, same convention as
// deriveSearchTimeline. Copy approved 2026-09-27.

const DAY_MS = 24 * 60 * 60 * 1000;
const GUARANTEE_DAYS = 30;
const SEARCH_DAYS = 60;

export const GUARANTEE_TIMELINE_HEADING = "Your guarantee";

export interface GuaranteeTimelineInput {
  searchStatus: string;
  solidifiedAt: string | null;
  /** pending | met | refunded (locked in by the Day-30 job). */
  guaranteeStatus: string;
  guaranteeResolvedAt: string | null;
  /** Earliest delivered_at among offers that currently count, or null. */
  guaranteeDeliveredAt: string | null;
  /** effectiveDeadline() as ISO. */
  searchDeadline: string | null;
}

export type GuaranteeMarkerState = "reached" | "muted" | "upcoming";

export interface GuaranteeTimelineInfo {
  /** null = no bar (purchased): just the lines. */
  bar: {
    /** Search started, Day 30, Day 60. */
    markers: { label: string; state: GuaranteeMarkerState }[];
    /** 0..1 along the track from "Search started" to "Day 60". */
    fill: number;
  } | null;
  lines: string[];
}

const MARKER_LABELS = ["Search started", "Day 30", "Day 60"];

function deliveredLine(date: string): string {
  return `Guarantee delivered ${formatLongDate(date)} — you received an offer below Total SRP.`;
}

/** Returns null when the timeline is hidden (not started, cancelled,
 *  switched, closed, or purchased without a counting offer). */
export function deriveGuaranteeTimeline(
  input: GuaranteeTimelineInput,
  now: number = Date.now(),
): GuaranteeTimelineInfo | null {
  if (!input.solidifiedAt || !input.searchDeadline) return null;
  if (["cancelled", "switched", "closed"].includes(input.searchStatus)) return null;

  const refunded = input.guaranteeStatus === "refunded";
  // "met" is locked; before Day 30 a counting offer is provisionally delivered.
  const deliveredAt =
    input.guaranteeStatus === "met"
      ? (input.guaranteeDeliveredAt ?? input.guaranteeResolvedAt)
      : input.guaranteeStatus === "pending"
        ? input.guaranteeDeliveredAt
        : null;

  if (input.searchStatus === "purchased") {
    return deliveredAt ? { bar: null, lines: [`Guarantee delivered ${formatLongDate(deliveredAt)}.`] } : null;
  }

  const started = new Date(input.solidifiedAt).getTime();
  const elapsedDays = (now - started) / DAY_MS;
  const paused = input.searchStatus === "paused";
  const fill = paused ? 1 : Math.min(1, Math.max(0, elapsedDays / SEARCH_DAYS));

  const day30State: GuaranteeMarkerState = refunded
    ? "muted"
    : deliveredAt || elapsedDays >= GUARANTEE_DAYS
      ? "reached"
      : "upcoming";
  const markers = [
    { label: MARKER_LABELS[0], state: "reached" as const },
    { label: MARKER_LABELS[1], state: day30State },
    { label: MARKER_LABELS[2], state: (paused || elapsedDays >= SEARCH_DAYS ? "reached" : "upcoming") as GuaranteeMarkerState },
  ];
  const through = formatLongDate(input.searchDeadline);

  let lines: string[];
  if (paused) {
    // The pause banner above already explains the resume window.
    lines = deliveredAt
      ? [deliveredLine(deliveredAt)]
      : refunded && input.guaranteeResolvedAt
        ? [`Your $699 refund was approved on ${formatLongDate(input.guaranteeResolvedAt)}.`]
        : [];
  } else if (refunded) {
    lines = [
      `We didn't find an offer below Total SRP within 30 days, so your $699 is being refunded. We'll keep searching through ${through}.`,
    ];
  } else if (deliveredAt) {
    lines = [deliveredLine(deliveredAt), `Your search continues through ${through}.`];
  } else {
    const daysLeft = Math.ceil((started + GUARANTEE_DAYS * DAY_MS - now) / DAY_MS);
    // Past Day 30 but the daily Day-30 job hasn't run yet: say nothing rather
    // than "0 days left".
    lines =
      daysLeft >= 1
        ? [`${daysLeft} day${daysLeft === 1 ? "" : "s"} left for us to bring you an offer below Total SRP.`]
        : [];
  }

  return { bar: { markers, fill }, lines };
}
