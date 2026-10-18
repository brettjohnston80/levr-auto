// Single place to change the "how far counts as nearby" radius used by the
// Step 2 real inventory count (src/lib/inventory-count.ts) and the intake UI
// that displays it. Split out of inventory-count.ts because a "use server"
// file may only export async functions -- a plain constant can't live there.
export const INVENTORY_RADIUS_MILES = 100;

// The nearby-inventory line (approved 2026-10-17): a count of what's for sale
// near the customer, never a limit on where we search.
export function nearbyInventoryCopy(count: number): string {
  return count === 0
    ? "None for sale near you right now — we search dealers nationwide."
    : `${count.toLocaleString()} for sale within ${INVENTORY_RADIUS_MILES} miles of you right now — and we search nationwide.`;
}
