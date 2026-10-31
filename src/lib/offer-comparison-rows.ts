/**
 * Offer comparison (offer entry, Chunk 10; plan 4.C "Side-by-side comparison", wording 6.3
 * signed off 2026-10-25): the rows, the "Lowest out-the-door" badge and the out-the-door sort
 * key. Pure and import-free (the Node unit tests load it directly); the caller passes each
 * offer's delivery facts already worked out by delivery-estimate.ts.
 */

export interface CompareOffer {
  id: string;
  status: string;
  offerPriceCents: number;
  msrpCents: number;
  vehicleExteriorColor: string | null;
  vehicleInteriorColor: string | null;
  sentToCustomerAt: string | null;
  goodUntil: string | null;
  otd: { totalCents: number; source: "dealer_quote" | "estimate" } | null;
  addons: { description: string; amountCents: number; dealerSaysRemovable?: boolean | null }[];
  fees: { kind: "doc_fee" | "sales_tax" | "title_registration" | "other"; amountCents: number }[];
  options: { name: string; customerAskedFor: boolean; onTheCar: boolean }[];
  /** Price plus the delivery estimate when the customer takes delivery and it's known. */
  totalPriceCents: number;
  /** The customer would take this car by delivery (beyond their pickup range, or they chose delivery). */
  takesDelivery: boolean;
  /** The dealer's delivery estimate, when provided (0 = free). */
  deliveryEstimateCents: number | null;
  /** Takes delivery but the estimate isn't in yet. */
  deliveryPending: boolean;
}

/**
 * What the badge and "Best total price" compare (Brett, 2026-10-29): out-the-door plus the
 * delivery estimate for an offer the customer would take by delivery, out-the-door alone within
 * the pickup range. Null without an out-the-door figure.
 */
export function comparedTotalCents(o: CompareOffer): number | null {
  if (!o.otd) return null;
  return o.otd.totalCents + (o.takesDelivery && o.deliveryEstimateCents != null ? o.deliveryEstimateCents : 0);
}

/** Offers the customer can still act on. Declined and withdrawn offers aren't compared. */
export const OPEN_STATUSES = ["pending", "customer_accepted"];
export const isOpen = (o: { status: string }) => OPEN_STATUSES.includes(o.status);

export const COMPARE_COPY = {
  button: "Compare offers",
  /** Approved 2026-10-29: the delivery-inclusive total row. */
  otdWithDelivery: "Out-the-door with delivery",
  title: "Compare your offers",
  badge: "Lowest out-the-door",
  viewAndAccept: "View and accept",
  match: "✓",
  notYourPick: "not your pick",
  removable: "can be removed",
  figuresFrom: { dealer_quote: "Dealer's quote", estimate: "Our estimate", requested: "Requested" },
  pager: (a: number, b: number, n: number) => `${a} and ${b} of ${n}`,
  noRating: "New to LEVR — no rating yet",
  rating: (r: number, count: number) => `LEVRating ${r.toFixed(1)} (${count})`,
  miles: (n: number) => `${Math.round(n)} miles`,
  optionsCount: (n: number, m: number) => `${n} of ${m}`,
};

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
const DASH = "—";

/**
 * "Lowest out-the-door": only when at least two open offers have an out-the-door figure (a
 * dealer's quote or our estimate both count). An offer still waiting on a delivery estimate
 * can't carry it, the same hold the old "Best value" badge had. Ties go to price + delivery.
 */
export function lowestOtdOfferId(offers: CompareOffer[]): string | null {
  const withOtd = offers.filter((o) => isOpen(o) && o.otd);
  if (withOtd.length < 2) return null;
  const eligible = withOtd.filter((o) => !o.deliveryPending);
  if (eligible.length === 0) return null;
  const best = [...eligible].sort((a, b) => comparedTotalCents(a)! - comparedTotalCents(b)! || a.totalPriceCents - b.totalPriceCents)[0];
  return best.id;
}

/**
 * "Best total price" ordering between two offers of the same status: offers with an
 * out-the-door figure first (lowest first), then the rest by price + delivery as before, with
 * offers waiting on a delivery estimate after the known ones in each group.
 */
export function compareByOtd(a: CompareOffer, b: CompareOffer): number {
  const ga = a.otd ? 0 : 1, gb = b.otd ? 0 : 1;
  if (ga !== gb) return ga - gb;
  const pa = a.deliveryPending ? 1 : 0, pb = b.deliveryPending ? 1 : 0;
  if (pa !== pb) return pa - pb;
  const ta = comparedTotalCents(a), tb = comparedTotalCents(b);
  if (ta != null && tb != null && ta !== tb) return ta - tb;
  return a.totalPriceCents - b.totalPriceCents;
}

/** The comparison's column order: the badge's offer pinned first, then the given order. */
export function comparisonOrder(offers: CompareOffer[]): CompareOffer[] {
  const open = offers.filter(isOpen);
  const pin = lowestOtdOfferId(open);
  return pin ? [...open.filter((o) => o.id === pin), ...open.filter((o) => o.id !== pin)] : open;
}

export type CellTone = "plain" | "good" | "muted";
export interface CompareCell {
  /** One or more lines. */
  lines: string[];
  tone: CellTone;
}
export interface CompareRow {
  key: string;
  label: string;
  cells: CompareCell[];
}

const cell = (lines: string[] | string, tone: CellTone = "plain"): CompareCell => ({
  lines: Array.isArray(lines) ? lines : [lines],
  tone,
});
const dash = () => cell(DASH, "muted");

function colourCell(colour: string | null, picks: string[]): CompareCell {
  if (!colour) return dash();
  if (picks.length === 0) return cell(colour);
  const mine = picks.some((p) => p.trim().toLowerCase() === colour.trim().toLowerCase());
  return mine ? cell(`${colour} ${COMPARE_COPY.match}`, "good") : cell([colour, COMPARE_COPY.notYourPick], "muted");
}

function feeCell(o: CompareOffer, kind: CompareOffer["fees"][number]["kind"]): CompareCell {
  const lines = o.fees.filter((f) => f.kind === kind);
  if (lines.length === 0) return dash();
  return cell(money(lines.reduce((t, f) => t + f.amountCents, 0)));
}

function formatGoodUntil(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The rows in the approved order (plan 6.3). */
export function comparisonRows(offers: CompareOffer[], picks: { exterior: string[]; interior: string[] }): CompareRow[] {
  const row = (key: string, label: string, f: (o: CompareOffer) => CompareCell): CompareRow => ({ key, label, cells: offers.map(f) });
  return [
    row("exterior", "Exterior", (o) => colourCell(o.vehicleExteriorColor, picks.exterior)),
    row("interior", "Interior", (o) => colourCell(o.vehicleInteriorColor, picks.interior)),
    row("options", "Options you want", (o) => {
      const asked = o.options.filter((x) => x.customerAskedFor);
      if (asked.length === 0) return dash();
      const on = asked.filter((x) => x.onTheCar).length;
      return cell(COMPARE_COPY.optionsCount(on, asked.length), on === asked.length ? "good" : "plain");
    }),
    row("also", "Also on the car", (o) => {
      const extra = o.options.filter((x) => !x.customerAskedFor && x.onTheCar).map((x) => x.name);
      return extra.length ? cell(extra) : dash();
    }),
    row("sticker", "Window sticker", (o) => cell(money(o.msrpCents))),
    row("discount", "Discount", (o) => {
      const d = o.msrpCents - o.offerPriceCents;
      if (d <= 0 || o.msrpCents <= 0) return dash();
      return cell(`−${money(d)} (${Math.round((d / o.msrpCents) * 100)}%)`, "good");
    }),
    row("price", "Car price", (o) => cell(money(o.offerPriceCents))),
    row("addons", "Dealer add-ons", (o) =>
      o.addons.length
        ? cell(o.addons.map((a) => `${a.description.trim()} ${money(a.amountCents)}${a.dealerSaysRemovable ? ` · ${COMPARE_COPY.removable}` : ""}`))
        : dash(),
    ),
    row("doc_fee", "Doc fee", (o) => feeCell(o, "doc_fee")),
    row("sales_tax", "Sales tax", (o) => feeCell(o, "sales_tax")),
    row("title_registration", "Title & registration", (o) => feeCell(o, "title_registration")),
    row("otd", "Out-the-door", (o) => (o.otd ? cell(money(o.otd.totalCents)) : dash())),
    // Only when some offer would come by delivery: the estimate, then the total the badge uses.
    ...(offers.some((o) => o.takesDelivery)
      ? [
          row("delivery", "Delivery estimate", (o) => {
            if (!o.takesDelivery) return dash();
            if (o.deliveryEstimateCents != null) return cell(`+${money(o.deliveryEstimateCents)}`);
            return o.deliveryPending ? cell(COMPARE_COPY.figuresFrom.requested, "muted") : dash();
          }),
          row("otd_with_delivery", COMPARE_COPY.otdWithDelivery, (o) =>
            o.takesDelivery && o.otd && o.deliveryEstimateCents != null ? cell(money(comparedTotalCents(o)!)) : dash(),
          ),
        ]
      : []),
    row("figures_from", "Figures from", (o) => {
      if (o.otd) return cell(COMPARE_COPY.figuresFrom[o.otd.source], o.otd.source === "dealer_quote" ? "good" : "plain");
      return o.sentToCustomerAt ? cell(COMPARE_COPY.figuresFrom.requested, "muted") : dash();
    }),
    row("good_until", "Good until", (o) => (o.goodUntil ? cell(formatGoodUntil(o.goodUntil)) : dash())),
  ];
}
