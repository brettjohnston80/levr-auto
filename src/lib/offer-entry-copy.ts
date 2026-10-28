/**
 * Agent-facing wording for the offer-entry draft and send actions (Chunk 3).
 *
 * Lines marked APPROVED are signed off in the offer-entry plan, section 6.1. Lines marked
 * DRAFT are new and wait for Brett's sign-off; nothing ships until every line is approved.
 */

/** APPROVED (6.1). */
export const DRAFT_SAVED = "Draft saved. The customer can't see it.";
/** APPROVED (6.1): "Sent to {customer first name}." The fallback "the customer" is DRAFT. */
export const sentTo = (firstName: string | null) => `Sent to ${firstName?.trim() || "the customer"}.`;
/** APPROVED (6.1). */
export const OTD_MISSING_AT_SEND =
  'No out-the-door figures yet. The customer will see "Out-the-door quote requested", and can\'t accept until you record the dealer\'s quote.';

/** DRAFT: the database function's refusal codes, and the server's own checks. */
export const SEND_REFUSALS: Record<string, string> = {
  agent_not_active: "Your agent account isn't active, so you can't send offers.",
  submission_not_found: "This draft no longer exists. Reload the page.",
  submission_not_sendable: "This offer has already been sent or discarded. Reload the page.",
  search_inactive: "This search isn't active. Tick the warning to send it anyway.",
  trim_not_confirmed: "Confirm the trim matches what the customer chose before sending.",
  above_sticker_unconfirmed: "The price isn't below the sticker. Tick the warning to send it anyway.",
  addons_contradiction: 'List the add-ons, or tick "No add-ons".',
  other_fees_contradiction: 'List any other fees, or tick "No other fees".',
  warnings_unconfirmed: "Tick each warning to send this offer.",
  vin_invalid: "That VIN isn't valid. Check for a mistyped character.",
  amounts_invalid: "Check the amounts: the sticker and price must be above $0, add-ons above $0, and no line over $250,000.",
  otd_mismatch: "The out-the-door total doesn't match the lines (within $1). Check for a missing or extra line.",
  good_until_invalid: "Good until must be today or later, and no more than 60 days out.",
  delivery_estimate_needed:
    "This dealer is beyond the customer's pickup range (or they prefer delivery), so a delivery estimate is standard: enter the dealer's fee, mark it requested from the dealer, or mark that the dealer doesn't deliver.",
  search_not_found: "That search no longer exists.",
  dealer_name_missing: "Enter the dealer's name.",
  discard_reason_needed: "Say why you're discarding this submission.",
  discard_only_dealer: "Only a dealer's submission can be discarded.",
  send_failed: "The offer wasn't sent. Nothing reached the customer. Try again.",
  not_authorized: "You're signed out. Sign in again to continue.",
};
