/**
 * Warnings an agent must confirm before an offer is sent (offer-entry plan 4.A, "Warnings
 * that need a confirm click"). Each needs its own tick; the ticked codes are stored in
 * `qualifying_offers.warnings_confirmed`, whose check constraint allows exactly these codes.
 *
 * Pure: the caller loads the search's status and its existing offers. Returns data only;
 * the signed-off wording (plan 6.1) is rendered by the page.
 */

// Same normalisation as vin-check.ts's normalizeVin. Kept local so this module has no imports
// (the Node unit tests load these files directly, and tsc refuses ".ts" import paths).
const normalizeVin = (raw: string) => raw.toUpperCase().replace(/[\s-]/g, "");

export const WARNING_CODES = ["above_sticker", "duplicate_vin", "duplicate_dealer", "inactive_search"] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export interface ExistingOffer {
  id: string;
  vin: string | null;
  dealerAliasId: string | null;
  dealerName: string;
  status: "pending" | "customer_accepted" | "customer_declined" | "withdrawn";
  createdAt: string;
}

export interface NewOfferFacts {
  stickerCents: number;
  priceCents: number;
  vin: string | null;
  dealerAliasId: string | null;
  dealerName: string;
  searchStatus: string;
}

export type OfferWarning =
  | { code: "above_sticker"; priceCents: number; stickerCents: number }
  | { code: "duplicate_vin"; dealerName: string; createdAt: string }
  | { code: "duplicate_dealer"; dealerName: string }
  | { code: "inactive_search"; searchStatus: string };

/** An offer the customer can still act on: not declined and not withdrawn. */
const OPEN = new Set(["pending", "customer_accepted"]);

// The same dealer record, or the same name. A name typed without a city becomes its own dealer
// record, so ids alone miss the duplicate; this is a confirm tick, so erring towards asking is fine.
function sameDealer(a: { dealerAliasId: string | null; dealerName: string }, b: ExistingOffer): boolean {
  if (a.dealerAliasId && b.dealerAliasId && a.dealerAliasId === b.dealerAliasId) return true;
  return a.dealerName.trim().toLowerCase() === b.dealerName.trim().toLowerCase();
}

export function offerWarnings(offer: NewOfferFacts, existing: ExistingOffer[]): OfferWarning[] {
  const out: OfferWarning[] = [];
  if (offer.priceCents >= offer.stickerCents) {
    out.push({ code: "above_sticker", priceCents: offer.priceCents, stickerCents: offer.stickerCents });
  }
  if (offer.vin) {
    const vin = normalizeVin(offer.vin);
    // Any earlier offer for the same car on this search, unless it was withdrawn.
    const match = existing.find((e) => e.status !== "withdrawn" && e.vin && normalizeVin(e.vin) === vin);
    if (match) out.push({ code: "duplicate_vin", dealerName: match.dealerName, createdAt: match.createdAt });
  }
  const dealerMatch = existing.find((e) => OPEN.has(e.status) && sameDealer(offer, e));
  if (dealerMatch) out.push({ code: "duplicate_dealer", dealerName: dealerMatch.dealerName });
  if (offer.searchStatus !== "searching") {
    out.push({ code: "inactive_search", searchStatus: offer.searchStatus });
  }
  return out;
}

/** Warnings shown but not ticked. Send is allowed only when this is empty. */
export function unconfirmedWarnings(warnings: OfferWarning[], confirmed: readonly string[]): WarningCode[] {
  const ticked = new Set(confirmed);
  return warnings.map((w) => w.code).filter((c) => !ticked.has(c));
}
