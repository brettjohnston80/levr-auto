import { RESUME_WINDOW_DAYS } from "./vehicle-data";

// Extracted out of account/page.tsx (2026-09-22) so /account/deal can reuse
// the exact same already-approved strings instead of holding a second copy
// that could drift -- same "shared so it can't disagree" reasoning this
// codebase already applies everywhere else (combinationLabel(),
// categoryHasRealChoiceAcrossTrims, etc).

/**
 * Minimal shape either DashboardSearch (customer-dashboard.ts) or
 * DealDetails satisfies -- these functions only ever need these four
 * fields, so neither type has to be widened or narrowed to share them.
 */
export interface SearchStatusFields {
  searchStatus: string;
  paidAt: string | null;
  make: string | null;
  pausedAt: string | null;
}

// awaiting_finalization has two very different real meanings depending on
// paid_at: "just paid, ready to finalize" (the common case) vs. "checkout
// was started but abandoned/never completed" (paid_at still null -- intake
// creates this row before the customer ever reaches Stripe). The unpaid
// case used SEARCH_STATUS_COPY's normal "Payment received..." text before
// this fix, which was wrong, plus a live "Finalize this search" link that
// dead-ended at /finalize's own paid_at guard. See getStatusCopy below,
// which branches on paidAt before falling back to this table.
export const SEARCH_STATUS_COPY: Record<string, string> = {
  awaiting_finalization: "Payment received — finalize trim, color, and options to start your search.",
  pending_refinement:
    "Finalized — you're in the 24-hour window to change trim, color, or options before dealer outreach begins.",
  searching: "Actively searching — we'll show new offers here as they come in.",
  // Defensive fallback only -- a real paused row always has paused_at set
  // (day60-extension.ts's pauseOverdueSearches sets both together), so
  // getStatusCopy branches to getPausedResumeInfo's countdown/expired copy
  // before this is ever actually shown.
  paused: "Search paused.",
  closed: "Search closed.",
  switched: "Superseded by a newer search.",
  cancelled: "This search was cancelled. To search again, start a new $699 search from the homepage.",
  // Defensive fallback only -- SearchCard renders PurchasedCelebration
  // instead of this text for a purchased search, never falls through here.
  purchased: "This search is complete — you purchased your vehicle.",
};

export const UNPAID_AWAITING_FINALIZATION_COPY =
  "Checkout wasn't completed — this search hasn't been paid for, so it hasn't started.";

export const PAUSED_EXPIRED_COPY = "This search has ended. To continue, you'll need to start a new search.";

// Locked copy from the finalized Day-60 paused-state policy (CLAUDE.md,
// 2026-08-15) -- deliberately no hint of the hidden agent bypass anywhere
// in either branch, expired or not. withinWindow gates whether
// ExtendSearchButton renders -- matches createExtensionCheckoutSession's
// own eligibility gate (RESUME_WINDOW_DAYS after paused_at), so the button
// never appears somewhere the RPC would just reject it.
export function getPausedResumeInfo(pausedAt: string | null): { copy: string; withinWindow: boolean } {
  if (!pausedAt) {
    return { copy: SEARCH_STATUS_COPY.paused, withinWindow: false };
  }

  const resumeWindowEnds = new Date(pausedAt);
  resumeWindowEnds.setUTCDate(resumeWindowEnds.getUTCDate() + RESUME_WINDOW_DAYS);
  const msRemaining = resumeWindowEnds.getTime() - Date.now();

  if (msRemaining <= 0) {
    return { copy: PAUSED_EXPIRED_COPY, withinWindow: false };
  }

  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  return {
    copy: `Your search is paused. You have ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left to resume it by extending — after that, you'll need to start a new search.`,
    withinWindow: true,
  };
}

export const UNDECIDED_PAID_COPY =
  "We're finding the right vehicle for you — your agent will reach out soon to talk through what you're looking for.";

// The undecided copy promises a call that is still coming, so it is only
// true while the search is actually waiting for one. An ALLOW-LIST, not a
// block-list, matching this file's own canCancel/canSwitch convention and
// getOverdueFollowUpQueue's: a status added later defaults to the plain
// status copy rather than silently inheriting a promise of agent contact.
export const UNDECIDED_COPY_STATUSES = ["awaiting_finalization"];

export function getStatusCopy(search: SearchStatusFields): string {
  if (search.paidAt && !search.make && UNDECIDED_COPY_STATUSES.includes(search.searchStatus)) {
    return UNDECIDED_PAID_COPY;
  }
  if (search.searchStatus === "awaiting_finalization" && !search.paidAt) {
    return UNPAID_AWAITING_FINALIZATION_COPY;
  }
  if (search.searchStatus === "paused") {
    return getPausedResumeInfo(search.pausedAt).copy;
  }
  return SEARCH_STATUS_COPY[search.searchStatus] ?? "";
}

// The raw search_status badge says "awaiting finalization" even when
// paid_at is null, which visually contradicts getStatusCopy's accurate body
// text for that same unpaid case ("hasn't been paid for, so it hasn't
// started"). This branches the badge the same way.
export function getStatusBadge(search: SearchStatusFields): string {
  if (search.searchStatus === "awaiting_finalization" && !search.paidAt) {
    return "checkout incomplete";
  }
  return search.searchStatus.replace(/_/g, " ");
}
