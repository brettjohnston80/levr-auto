/**
 * Whether a qualifying_offers row currently "counts" toward the Day-30
 * guarantee. Deliberately not a stored column (see the comment on
 * qualifying_offers in the schema) — this is a derived, read-time
 * determination, since the sold-before-response edge case means the answer
 * can change after delivery as later facts (a response, a sale) come in.
 *
 * The sold-before-response rule, exactly as decided:
 *   - No response within 24h of delivered_at, and the vehicle sells to
 *     someone else -> the offer still counts (guarantee satisfied).
 *   - Customer responds within 24h, but the vehicle sells before the
 *     purchase goes through anyway -> doesn't count, LEVR keeps searching.
 * The rule keys only on whether the response landed inside the 24h window,
 * not on the relative timing between the response and vehicle_sold_at.
 *
 * Withdrawn offers (Brett, 2026-10-27): an offer an agent withdrew, whether
 * pending or accepted then released, doesn't count. The one exception is the
 * reason "Car sold": then the sold rule above decides (withdrawing with that
 * reason sets vehicle_sold_at). A withdrawal recorded without a reason code
 * (the live release on main, before offer entry) doesn't count either.
 */

export const GUARANTEE_RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type GuaranteeContribution =
  | "not_qualifying"
  | "not_yet_delivered"
  | "counts"
  | "does_not_count";

export interface OfferGuaranteeInput {
  isBelowMsrp: boolean;
  deliveredAt: string | null;
  customerRespondedAt: string | null;
  vehicleSoldAt: string | null;
  status: string;
  withdrawalReasonCode: string | null;
}

export function evaluateOfferGuaranteeContribution(
  offer: OfferGuaranteeInput
): GuaranteeContribution {
  if (!offer.isBelowMsrp) {
    return "not_qualifying";
  }
  if (!offer.deliveredAt) {
    return "not_yet_delivered";
  }
  if (offer.status === "withdrawn" && offer.withdrawalReasonCode !== "car_sold") {
    return "does_not_count";
  }
  if (!offer.vehicleSoldAt) {
    return "counts";
  }

  const deadline = new Date(offer.deliveredAt).getTime() + GUARANTEE_RESPONSE_WINDOW_MS;
  const respondedInWindow =
    offer.customerRespondedAt !== null && new Date(offer.customerRespondedAt).getTime() <= deadline;

  return respondedInWindow ? "does_not_count" : "counts";
}
