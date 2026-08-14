// Single place to change the "how far counts as nearby" radius used by the
// Step 2 real inventory count (src/lib/inventory-count.ts) and the intake UI
// that displays it. Split out of inventory-count.ts because a "use server"
// file may only export async functions -- a plain constant can't live there.
export const INVENTORY_RADIUS_MILES = 100;
