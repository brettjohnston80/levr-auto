/**
 * Agent-facing wording for the Log Offer page (offer entry, Chunk 4). APPROVED by Brett
 * 2026-10-27. Everything else on the page is approved wording from the offer-entry plan,
 * sections 6.1 and 6.4, or Log Offer's existing lines. Recorded in
 * docs/business/site-language-inventory.md, section 17.
 */
import type { ManufacturerFee } from "./offer-entry-context";

export const OFFER_ENTRY_DRAFT_COPY = {
  backToOutreach: "Back to outreach",
  draftsHeading: "Drafts on this search",
  noDealerYet: "No dealer yet",
  savedAt: (date: string) => `saved ${date}`,
  pasteText: "Paste text",
  trimField: "Trim on the car",
  noWantedOptions: "The customer didn't rank any options.",
  optionName: "Option name",
  installUnknown: "Installed by: not sure",
  installFactory: "Factory",
  installPort: "Port-installed",
  remove: "Remove",
  addonsHeading: "Dealer add-ons",
  addonName: "Add-on",
  addAddon: "+ Add an add-on",
  feeName: "Fee name",
  addFee: "+ Add a fee",
  manufacturerFeePrefilled: (f: ManufacturerFee) =>
    `Prefilled: ${f.make}'s $${f.amount.toLocaleString("en-US")} ${f.fee.toLowerCase()}${f.refundable ? "" : " (non-refundable)"}. Change or remove it if the store's paperwork differs.`,
  /** Reused from the dealer page (plan 6.2, approved). */
  linesAddUp: (sum: string) => `Your lines add up to ${sum}`,
  /** Reused from the dealer page's sum mismatch (plan 6.2, approved), adapted to the agent. */
  linesMismatch: (sum: string, entered: string) =>
    `The lines add up to ${sum}, but the out-the-door total is ${entered}. Check for a missing or extra line.`,
  agentNotes: "Notes for agents (not shown to the customer)",
  tickEveryOption: "Mark each option the customer wants as on the car or not on the car.",
  sidebarTrims: "Trims",
  sidebarCategory: { exterior_color: "Exterior", interior: "Interior", feature: "Options" } as Record<string, string>,
  noOtherOffers: "No other offers yet.",
  noOtdLine: "no out-the-door yet",
  status: {
    pending: "Waiting on the customer",
    customer_accepted: "Accepted",
    customer_declined: "Declined",
    withdrawn: "Released",
  } as Record<string, string>,
};

/** APPROVED (Brett, 2026-10-27; Chunk 9), agent-facing: deposit refused on an offer without the dealer's out-the-door quote. */
export const DEPOSIT_BLOCKED_AWAITING_OTD =
  "Record the dealer's out-the-door quote before confirming a deposit. The customer can't accept this offer until then.";

/** APPROVED (Brett, 2026-10-27; Chunk 9), agent-facing: the Record out-the-door panel. The
 *  "already recorded" line was revised the same day for the withdraw step (OE-5). */
export const RECORD_OTD_COPY = {
  waiting: "Waiting for the dealer's out-the-door quote. The customer can't accept until it's recorded.",
  totalLabel: "Out-the-door total (dealer's quote)",
  recorded: (firstName: string | null) => `Out-the-door recorded. ${firstName?.trim() || "The customer"} can now accept this offer.`,
  recordedLine: (amount: string) => `Out-the-door ${amount} · Dealer's quote`,
  refusals: {
    offer_not_sent: "This offer was logged before out-the-door pricing, so there's nothing to record.",
    offer_not_open: "This offer isn't open any more.",
    otd_already_recorded:
      "The dealer's out-the-door quote is already recorded and can't be changed. To correct it, withdraw this offer and send a corrected one.",
    otd_mismatch: "The out-the-door total doesn't match the lines (within $1). Check for a missing or extra line.",
  } as Record<string, string>,
};

/** APPROVED (Brett, 2026-10-27/28), agent-facing: withdrawing a pending offer, and the same
 *  reason choice on "Release this accepted offer". Reason labels match withdraw_pending_offer. */
export const WITHDRAW_REASONS = [
  { code: "car_sold", label: "Car sold" },
  { code: "dealer_pulled", label: "Dealer pulled the quote" },
  { code: "correcting", label: "Correcting the offer" },
  { code: "other", label: "Other" },
] as const;
export type WithdrawReasonCode = (typeof WITHDRAW_REASONS)[number]["code"];

export const WITHDRAW_COPY = {
  button: "Withdraw this offer",
  heading: "Why are you withdrawing this offer? The customer won't see your reason.",
  reasonLabel: "Reason",
  noteLabel: "Note (required for Other). The customer won't see it.",
  confirm: "Withdraw it",
  done: (firstName: string | null) => `Offer withdrawn. ${firstName?.trim() || "The customer"} has been told.`,
  refusals: {
    reason_missing: "Choose a reason.",
    reason_code_invalid: "Choose a reason.",
    note_required: 'Add a note for "Other".',
    offer_not_pending:
      'Only an offer the customer hasn\'t accepted can be withdrawn. To release an accepted offer, use "Release this accepted offer".',
    offer_not_found: "That offer no longer exists.",
    agent_not_active: "Not authorized.",
    not_authorized: "Not authorized.",
  } as Record<string, string>,
};

export function isWithdrawReasonCode(code: string): code is WithdrawReasonCode {
  return WITHDRAW_REASONS.some((r) => r.code === code);
}
