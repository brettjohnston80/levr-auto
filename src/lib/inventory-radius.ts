// Single place to change the "how far counts as nearby" radius used by the
// Step 2 real inventory count (src/lib/inventory-count.ts) and the intake UI
// that displays it. Split out of inventory-count.ts because a "use server"
// file may only export async functions -- a plain constant can't live there.
export const INVENTORY_RADIUS_MILES = 100;

// The nearby-inventory line: a count of the listings we've synced near the
// customer, never a limit on where we search. BAE's feedback (2026-10-29):
// our listings are a sample, not the market, so a count is shown only when we
// have synced listings for the model, and never called the nationwide total.
// DRAFT wording, awaiting Brett's sign-off (2026-10-29).
export function nearbyInventoryCopy(count: number, syncedForModel: number): string {
  if (syncedForModel === 0) return "We search dealers nationwide.";
  return count === 0
    ? "None found near you yet — we search dealers nationwide."
    : `${count.toLocaleString()} found within ${INVENTORY_RADIUS_MILES} miles of you so far — and we search dealers nationwide.`;
}

/** Shown under a count (DRAFT, 2026-10-29). */
export const INVENTORY_SOURCE_NOTE = "Based on current dealer listings.";

/** A synced count on the trim lists and Matchmaker (DRAFT, 2026-10-29): never "nationwide". */
export const listingsFoundCopy = (n: number) => `${n.toLocaleString()} ${n === 1 ? "listing" : "listings"} found so far`;
