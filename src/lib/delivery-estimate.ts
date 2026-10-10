// Delivery estimates on offers, before acceptance (Brett's walkthrough note 9,
// plan and wording approved 2026-10-10). Pure rules and copy, no server
// imports: the offer card, detail view, Best value badge, sort and the
// agent's form all decide the same way from here.

import { isBeyondPickupRange, type HandoffMethod, type PickupTravel } from "./pickup-travel";

export type DeliveryEstimateStatus = "requested" | "provided" | "unavailable";

export interface DeliveryEstimate {
  status: DeliveryEstimateStatus;
  /** Set only when status is "provided"; 0 = free delivery. */
  cents: number | null;
  note: string | null;
}

interface OfferForDelivery {
  offerPriceCents: number;
  handoffMethod: HandoffMethod | null;
  pickupTravel: PickupTravel | null;
  distanceMiles: number | null;
  deliveryEstimate: DeliveryEstimate | null;
}

/**
 * Standard = the agent should get an estimate without being asked: the
 * dealer is beyond the customer's pickup range, or the customer said they'd
 * rather have it delivered. Decided from the CURRENT range every time (never
 * stored), so changing the range on the map updates it immediately. Within
 * range, "any distance" or case by case, an estimate is optional.
 */
export function deliveryEstimateStandard(travel: PickupTravel | null, distanceMiles: number | null): boolean {
  if (travel?.choice === "prefer_delivery") return true;
  return isBeyondPickupRange(travel, distanceMiles, null);
}

/** Will the customer take delivery of this offer? Their own pickup/delivery
 *  answer wins; with none yet, delivery is assumed exactly when it's standard. */
export function takesDelivery(offer: OfferForDelivery): boolean {
  if (offer.handoffMethod) return offer.handoffMethod === "delivery";
  return deliveryEstimateStandard(offer.pickupTravel, offer.distanceMiles);
}

/** Price plus the delivery estimate when the customer takes delivery and the
 *  figure is known; otherwise the price alone. */
export function totalPriceCents(offer: OfferForDelivery): number {
  const e = offer.deliveryEstimate;
  if (takesDelivery(offer) && e?.status === "provided" && e.cents != null) return offer.offerPriceCents + e.cents;
  return offer.offerPriceCents;
}

/** Takes delivery but the figure isn't in yet. Such an offer is ranked by
 *  price, marked "+ delivery (estimate pending)", and can't carry the Best
 *  value badge until the estimate arrives. */
export function deliveryEstimatePending(offer: OfferForDelivery): boolean {
  if (!takesDelivery(offer)) return false;
  const status = offer.deliveryEstimate?.status ?? null;
  return status !== "provided" && status !== "unavailable";
}

// Approved copy (2026-10-10).
export const DELIVERY_ESTIMATE_COPY = {
  provided: (formatted: string) => `Delivery estimate: ${formatted}`,
  requested: "Delivery estimate requested from the dealer",
  request: "Get a delivery estimate",
  pendingMarker: "+ delivery (estimate pending)",
  unavailable: "This dealer doesn't offer delivery for this car.",
};
