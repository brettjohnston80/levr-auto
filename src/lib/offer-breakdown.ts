/**
 * "How the price adds up" (offer-entry plan 4.C), as rows. Pure: the agent's Log Offer
 * preview and the customer's offer detail (Chunk 9) build it from the same function, so what
 * the agent previews is exactly what the customer sees. Row labels are the approved wording
 * (plan 6.3).
 */

export type BreakdownFeeKind = "doc_fee" | "sales_tax" | "title_registration" | "other";

export interface BreakdownInput {
  stickerCents: number;
  priceCents: number;
  addons: { description: string; amountCents: number; dealerSaysRemovable?: boolean | null }[];
  fees: { kind: BreakdownFeeKind; label?: string | null; amountCents: number }[];
  /** A provided delivery estimate, passed only when the customer would take the car by delivery
   *  (Brett, 2026-10-29); null otherwise. */
  deliveryCents: number | null;
  /** The out-the-door total and where it came from; null = not recorded yet (requested). */
  otd: { totalCents: number; source: "dealer_quote" | "estimate" } | null;
}

export type BreakdownRowKind =
  | "sticker" | "discount" | "price" | "addons" | "doc_fee" | "sales_tax" | "title_registration" | "other_fees"
  | "delivery" | "otd" | "otd_with_delivery";

export interface BreakdownRow {
  kind: BreakdownRowKind;
  label: string;
  /** Signed: the discount is negative, lines added to the price are positive. */
  amountCents: number;
  /** Bar length, 0 to 1, scaled to the sticker. */
  barFraction: number;
  /** Whole percent off the sticker, on the discount row only. */
  percent?: number;
}

const LABELS: Record<BreakdownRowKind, string> = {
  sticker: "Window sticker",
  discount: "Discount",
  price: "Car price",
  addons: "Dealer add-ons",
  doc_fee: "Doc fee",
  sales_tax: "Sales tax",
  title_registration: "Title & registration",
  other_fees: "Other fees",
  delivery: "Delivery estimate",
  otd: "Out-the-door",
  /** Approved 2026-10-29. */
  otd_with_delivery: "Out-the-door with delivery",
};

export function breakdownRows(input: BreakdownInput): BreakdownRow[] {
  const sticker = input.stickerCents;
  const bar = (cents: number) => (sticker > 0 ? Math.max(0, Math.min(1, Math.abs(cents) / sticker)) : 0);
  const row = (kind: BreakdownRowKind, amountCents: number, extra: Partial<BreakdownRow> = {}): BreakdownRow => ({
    kind, label: LABELS[kind], amountCents, barFraction: bar(amountCents), ...extra,
  });
  const sum = (xs: { amountCents: number }[]) => xs.reduce((t, x) => t + x.amountCents, 0);

  const rows: BreakdownRow[] = [row("sticker", sticker)];
  // Shown only when the price is below the sticker: a price above it isn't a discount.
  const discount = input.priceCents - sticker;
  if (discount < 0) {
    rows.push(row("discount", discount, sticker > 0 ? { percent: Math.round((-discount / sticker) * 100) } : {}));
  }
  rows.push(row("price", input.priceCents));
  if (input.addons.length > 0) rows.push(row("addons", sum(input.addons)));
  for (const kind of ["doc_fee", "sales_tax", "title_registration"] as const) {
    const lines = input.fees.filter((f) => f.kind === kind);
    if (lines.length > 0) rows.push(row(kind, sum(lines)));
  }
  const other = input.fees.filter((f) => f.kind === "other");
  if (other.length > 0) rows.push(row("other_fees", sum(other)));
  // The dealer's out-the-door, then (by delivery) the estimate and the total compared across offers.
  if (input.otd) rows.push(row("otd", input.otd.totalCents));
  if (input.deliveryCents != null) {
    rows.push(row("delivery", input.deliveryCents));
    if (input.otd) rows.push(row("otd_with_delivery", input.otd.totalCents + input.deliveryCents));
  }
  return rows;
}

/** The approved per-add-on note (plan 6.3, 2026-10-25), for each add-on the dealer will remove. */
export function removableAddonNotes(input: Pick<BreakdownInput, "addons">): string[] {
  return input.addons
    .filter((a) => a.dealerSaysRemovable)
    .map((a) => `Don't want the ${a.description.trim()}? The dealer will remove it. Just tell your agent.`);
}

/** The approved delivery note (plan 6.4, 2026-10-25), shown when a delivery row is present. */
export const DELIVERY_NOTE = "Delivery isn't part of the car price.";
