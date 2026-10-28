/**
 * Customer-facing wording for offers sent through offer entry (Chunk 9). Every line is
 * approved in the offer-entry plan: section 6.3 (signed off 2026-10-25), 6.4 and the new
 * empty/partial-state lines in 5.0.
 */

export const ACCEPT_BLOCKED_AWAITING_OTD = "Out-the-door quote requested — you can accept once it arrives.";
export const OTD_REQUESTED = "Out-the-door quote requested";
export const otdLine = (amount: string, source: "dealer_quote" | "estimate") =>
  `Out-the-door: ${amount} · ${source === "dealer_quote" ? "Dealer's quote" : "Our estimate"}`;
export const goodUntilLine = (date: string) => `Good until ${date}`;
export const levratingChip = (r: { rating: number; count: number } | null) =>
  r ? `LEVRating ${r.rating.toFixed(1)} (${r.count})` : "New to LEVR — no rating yet";
/** The card's price line once the out-the-door line is on the card (6.4). */
export const NEGOTIATED_PRICE_SHORT = "Negotiated price for the car.";
export const optionsSummary = (n: number, m: number) => `Options you wanted: ${n} of ${m}`;
export const OPTIONS_HEADING = "Options on this car";
export const OPTIONS_ASKED = "What you asked for";
export const OPTIONS_ALSO = "Also on this car";
export const OPTION_ON = "✓ On the car";
export const OPTION_OFF = "✗ Not on this car";
export const OPTIONS_NOT_RECORDED = "Your agent hasn't recorded this car's options yet.";
export const VIEW_WINDOW_STICKER = "View the window sticker";
export const AGENT_NOTE_HEADING = "A note from your agent";
export const ACCEPT_BLOCK_HEADING = "Your out-the-door price";

/** New-offer email line (6.3, added). */
export const newOfferEmailOtdLine = (amount: string | null, source: "dealer_quote" | "estimate" | null) =>
  amount && source
    ? `Out-the-door: ${amount} (${source === "dealer_quote" ? "dealer's quote" : "our estimate"}).`
    : "The dealer's out-the-door quote is on its way.";
/** Out-the-door arrived email (6.3). */
export const otdArrivedSubject = (dealer: string) => `Your out-the-door price from ${dealer} is in`;
export const otdArrivedBody = (dealer: string, vehicle: string, amount: string) =>
  `${dealer} sent their out-the-door price for your ${vehicle}: ${amount}. You can now accept this offer. Go to Your Deal.`;
