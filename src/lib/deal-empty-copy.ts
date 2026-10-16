// Your Deal with no offers yet: why it's empty (tester feedback, approved by
// Brett 2026-10-16). One place for the wording, so the page can't drift from
// what was signed off.

/** Saved but not paid. */
export const DEAL_UNPAID_COPY = {
  heading: "Complete payment to start your search",
  text: "Your search is saved. Once you pay, we'll start finding offers.",
  button: "Review your search",
} as const;

/** Paid, but the customer hasn't finalized trim, color and options yet. */
export const DEAL_NOT_FINALIZED_COPY = {
  heading: "Finish your search to start getting deals",
  text: "We need a few more details about the car you want before we can start finding offers.",
  /** Same, once the customer has asked for a finalization call. */
  callRequestedText: "Your agent will call you to go over the details. You can also finish it yourself in Your Car.",
  button: "Finish in Your Car",
} as const;

/** Paid, vehicle not chosen yet: the agent picks it with the customer. The text
 *  is the already-approved UNDECIDED_PAID_COPY (search-status-copy.ts). */
export const DEAL_UNDECIDED_HEADING = "Let's pick your car";

/** Finalized, inside the 24-hour change window. {time} is the window's end. */
export const DEAL_CHANGE_WINDOW_COPY = {
  heading: "Your search starts soon",
  textBefore: "You can still make changes in Your Car until ",
  textAfter: ". After that we start searching dealers, and your offers will show up here.",
  button: "Make changes in Your Car",
} as const;

/** Finalized and live (searching), no offers yet. */
export const DEAL_SEARCHING_NO_OFFERS_COPY = {
  heading: "We're on it",
  text: "We have everything we need and we're searching dealers for your car now. We'll let you know as soon as your first offer comes in.",
} as const;

/** The customer's search was cancelled (and nothing newer is in play). */
export const DEAL_CANCELLED_COPY = {
  heading: "This search was cancelled",
  text: "To search again, start a new $699 search from the homepage.",
} as const;
