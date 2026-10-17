// Option prices in words, shared by every configurator surface and the agent
// card, so a manufacturer credit reads the same everywhere.
//
// Credits (Brett, 2026-10-17): a negative price is a manufacturer credit and
// reads "−$3,000" with a true minus sign (U+2212), never "+$-3,000".

export const MINUS_SIGN = "−";

/** "$1,850", or "−$3,000" for a negative amount. */
export function formatUsd(cents: number): string {
  const dollars = Math.round(Math.abs(cents) / 100).toLocaleString("en-US");
  return cents < 0 ? `${MINUS_SIGN}$${dollars}` : `$${dollars}`;
}

/** An option's price against the base trim: "+$1,850", or "−$3,000" for a credit. */
export function formatOptionPrice(cents: number): string {
  return cents < 0 ? formatUsd(cents) : `+${formatUsd(cents)}`;
}
