import { formatLongDate } from "./dashboard-format";

// Automatic progress notes on Your Deal (2026-09-27). One line under the
// status timeline for a searching search, derived from data that already
// exists. Deliberately no counts and no claims about outreach: outreach isn't
// logged anywhere, so a note may only say what the data shows. Copy approved
// 2026-09-27 (all seven lines). Paused/cancelled/switched keep their banners;
// purchased shows the celebration instead.

const DAY_MS = 24 * 60 * 60 * 1000;
const JUST_STARTED_DAYS = 3;

export interface ProgressNoteInput {
  searchStatus: string;
  solidifiedAt: string | null;
  guaranteeStatus: string;
  searchDeadline: string | null;
  offers: {
    status: string;
    dealProgress: { availabilityReconfirmedAt: string | null; depositConfirmedAt: string | null } | null;
  }[];
}

/** null when the search isn't in "searching" (the caller keeps its old copy). */
export function deriveProgressNote(input: ProgressNoteInput, now: number = Date.now()): string | null {
  if (input.searchStatus !== "searching" || !input.solidifiedAt) return null;

  const accepted = input.offers.find((o) => o.status === "customer_accepted");
  if (accepted) {
    if (accepted.dealProgress?.depositConfirmedAt) {
      return "Deposit confirmed. Your agent will help you finish the purchase.";
    }
    if (accepted.dealProgress?.availabilityReconfirmedAt) {
      return "The dealer confirmed it's still available. Next step: the deposit.";
    }
    return "You accepted an offer. Next, your agent will confirm it's still available.";
  }

  if (input.offers.some((o) => o.status === "pending")) {
    return "You have offers to review below.";
  }

  if (input.guaranteeStatus === "refunded" && input.searchDeadline) {
    return `Your search continues through ${formatLongDate(input.searchDeadline)}.`;
  }

  const liveDays = (now - new Date(input.solidifiedAt).getTime()) / DAY_MS;
  return liveDays < JUST_STARTED_DAYS
    ? "Your search is live — your agent is lining up dealer outreach."
    : "Your search is in progress — we'll post offers here as they come in.";
}
