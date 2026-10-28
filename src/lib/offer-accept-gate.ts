/**
 * Accept gating (offer-entry plan 4.C; decided 2026-10-17/18 and 2026-10-25). An offer sent
 * through the offer-entry flow (sent_to_customer_at set) can be accepted only once the dealer's
 * out-the-door quote is recorded; "Our estimate" figures don't unblock it. Offers logged before
 * the feature stay acceptable as today. Pure: the card, detail view, respondToOffer and
 * confirmDepositReceived all ask the same question.
 */
export function awaitingOtdQuote(offer: { sentToCustomerAt: string | null; otdSource: string | null }): boolean {
  return offer.sentToCustomerAt != null && offer.otdSource !== "dealer_quote";
}
