/** "$699", or "$12.50" when there are cents. Shared by the refund actions and the refunds-due screen. */
export function formatRefundAmount(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
