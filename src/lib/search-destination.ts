/**
 * Where "Continue your search" goes, and where sign-in lands (BAE #1, plan approved 2026-10-30,
 * docs/plans/bae-continue-your-search-plan.md): the customer's latest active search decides.
 * Pure and import-free (unit tested directly). Searches come oldest first.
 */

export interface DestinationSearch {
  id: string;
  searchStatus: string;
  paidAt: string | null;
  make: string | null;
  model: string | null;
}

/** Ended or replaced: never where the customer continues from. */
const INACTIVE = new Set(["cancelled", "switched", "closed"]);

export const NO_SEARCH_DESTINATION = "/#get-started";

export function latestActiveSearch<T extends DestinationSearch>(searches: T[]): T | null {
  return [...searches].reverse().find((s) => !INACTIVE.has(s.searchStatus)) ?? null;
}

export function searchDestination(searches: DestinationSearch[]): string {
  const s = latestActiveSearch(searches);
  if (!s) return NO_SEARCH_DESTINATION;
  if (s.searchStatus === "awaiting_finalization") {
    if (!s.paidAt) return `/account/vehicle?searchId=${s.id}`; // Review your search
    // Paid without a vehicle yet: the agent helps choose one; the dashboard says so.
    if (!s.make || !s.model) return "/account";
    return `/finalize/${s.id}`;
  }
  if (s.searchStatus === "pending_refinement") return `/account/vehicle?searchId=${s.id}`; // Your Car, Make changes
  return `/account/deal?searchId=${s.id}`; // live, paused or purchased
}
