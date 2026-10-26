/**
 * Offer pricing: the discount, the out-the-door sum and its arithmetic check, and the
 * guarantee price test (offer-entry plan, sections 4.A step 4, 4.B and 4.C).
 *
 * Pure functions on integer cents, shared by the agent's Log Offer page, the dealer
 * submission page (in the browser and again on the server) and the customer views.
 *
 * The guarantee test is unchanged: an offer counts when its price is below the car's own
 * sticker (Total SRP), exactly the database's generated `is_below_msrp`. Add-ons, fees,
 * taxes and delivery never enter it (decision 3, Brett 2026-10-18). The trim condition is
 * the agent's separate `trim_match_confirmed` tick, required before an offer is sent.
 */

/** A total may differ from the sum of its lines by up to $1 (rounding on a dealer's sheet). */
export const OTD_TOLERANCE_CENTS = 100;

/** No single amount over $250,000 (plan 4.B, server check). */
export const MAX_LINE_CENTS = 25_000_000;

export type OfferFeeKind = "doc_fee" | "sales_tax" | "title_registration" | "other";

export interface OfferFeeLine {
  kind: OfferFeeKind;
  amountCents: number;
  /** Sales tax the customer pays at registration, not to the dealer: shown, not summed. */
  paidAtRegistration?: boolean;
}

export interface OfferAddonLine {
  amountCents: number;
}

export interface OfferPriceInput {
  stickerCents: number;
  priceCents: number;
  addons: OfferAddonLine[];
  fees: OfferFeeLine[];
}

/** Sticker minus price. Negative when the price is above the sticker. */
export function discountCents(stickerCents: number, priceCents: number): number {
  return stickerCents - priceCents;
}

/**
 * The discount as a whole percent of the sticker, rounded to the nearest point
 * ($2,795 off $30,895 is 9%). Null when there's no positive sticker to divide by.
 */
export function discountPercent(stickerCents: number, priceCents: number): number | null {
  if (!(stickerCents > 0)) return null;
  return Math.round((discountCents(stickerCents, priceCents) / stickerCents) * 100);
}

/** The guarantee price test, the same as `qualifying_offers.is_below_msrp`. */
export function priceBelowSticker(stickerCents: number, priceCents: number): boolean {
  return priceCents < stickerCents;
}

/** Car price + add-ons + fees the dealer collects. Tax paid at registration is left out. */
export function outTheDoorSumCents(input: Pick<OfferPriceInput, "priceCents" | "addons" | "fees">): number {
  let sum = input.priceCents;
  for (const a of input.addons) sum += a.amountCents;
  for (const f of input.fees) {
    if (f.kind === "sales_tax" && f.paidAtRegistration) continue;
    sum += f.amountCents;
  }
  return sum;
}

export type OtdCheck =
  | { ok: true; sumCents: number; differenceCents: number }
  | { ok: false; sumCents: number; differenceCents: number };

/** Does an entered out-the-door total match the lines, to within $1? */
export function checkOutTheDoorTotal(
  input: Pick<OfferPriceInput, "priceCents" | "addons" | "fees">,
  enteredTotalCents: number
): OtdCheck {
  const sumCents = outTheDoorSumCents(input);
  const differenceCents = enteredTotalCents - sumCents;
  return { ok: Math.abs(differenceCents) <= OTD_TOLERANCE_CENTS, sumCents, differenceCents };
}

export type AmountProblem =
  | { field: "sticker"; problem: "not_positive" | "too_large" | "not_whole_cents" }
  | { field: "price"; problem: "not_positive" | "too_large" | "not_whole_cents" }
  | { field: "addon"; index: number; problem: "not_positive" | "too_large" | "not_whole_cents" }
  | { field: "fee"; index: number; problem: "negative" | "too_large" | "not_whole_cents" };

/**
 * The server's bounds on every amount: sticker and price above zero, add-ons above zero
 * (the database requires it), fees zero or more, nothing over $250,000, whole cents only.
 * Returns every problem found; an empty list means the amounts are acceptable.
 */
export function amountProblems(input: OfferPriceInput): AmountProblem[] {
  const out: AmountProblem[] = [];
  const positive = (v: number) =>
    !Number.isInteger(v) ? "not_whole_cents" : v <= 0 ? "not_positive" : v > MAX_LINE_CENTS ? "too_large" : null;
  const s = positive(input.stickerCents);
  if (s) out.push({ field: "sticker", problem: s });
  const p = positive(input.priceCents);
  if (p) out.push({ field: "price", problem: p });
  input.addons.forEach((a, index) => {
    const problem = positive(a.amountCents);
    if (problem) out.push({ field: "addon", index, problem });
  });
  input.fees.forEach((f, index) => {
    const v = f.amountCents;
    const problem = !Number.isInteger(v) ? "not_whole_cents" : v < 0 ? "negative" : v > MAX_LINE_CENTS ? "too_large" : null;
    if (problem) out.push({ field: "fee", index, problem });
  });
  return out;
}
