/** "$699", or "$12.50" when there are cents. Shared by the refund actions and the refunds-due screen. */
export function formatRefundAmount(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type RefundPartKind = "search_fee" | "switch_fee";

export function refundPartLabel(kind: RefundPartKind): string {
  return kind === "search_fee" ? "search fee" : "switch fee";
}

/** "$699 search fee + $100 switch fee" */
export function describeRefundParts(parts: { kind: RefundPartKind; amountCents: number }[]): string {
  return parts.map((p) => `${formatRefundAmount(p.amountCents)} ${refundPartLabel(p.kind)}`).join(" + ");
}
