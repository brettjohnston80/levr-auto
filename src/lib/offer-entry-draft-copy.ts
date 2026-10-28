/**
 * DRAFT agent-facing wording for the Log Offer page (offer entry, Chunk 4), waiting for
 * Brett's sign-off. Everything else on the page is approved wording from the offer-entry plan,
 * sections 6.1 and 6.4 (or Log Offer's existing, approved lines). Nothing ships until this
 * whole file is approved and folded into offer-entry-copy.ts.
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
