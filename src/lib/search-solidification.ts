import "server-only";
import { createAdminClient } from "./supabase/admin";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Searches due to auto-solidify: still in the 24h post-payment refinement
 * window (Core-Processes-v1.md §2 step 3 — "Search doesn't start until
 * solidification"), and that window has elapsed.
 *
 * Built for the current flow, where solidification is purely a passive
 * 24h-elapsed timer off paid_at. This will need revisiting once the
 * pending pivot's Steps 4-6 make finalization an explicit event (a
 * self-service save or an agent call) rather than an automatic
 * payment-triggered timer — expected future rework, not a bug here.
 *
 * Deliberately an "elapsed >= 24h" check, not "elapsed == exactly 24h" —
 * same idempotent, catch-up-tolerant pattern as getDueSearches in
 * guarantee-assessment.ts, for the same reason: a missed run can't create a
 * permanent gap, it's just caught by the next one.
 */
export async function getSearchesDueForSolidification(): Promise<{ id: string }[]> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();

  const { data, error } = await admin
    .from("customer_searches")
    .select("id")
    .eq("search_status", "pending_refinement")
    .not("paid_at", "is", null)
    .lte("paid_at", cutoff);

  if (error) {
    throw new Error(`Failed to load searches due for solidification: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Solidifies one search: sets solidified_at and flips search_status to
 * 'searching' together, in the same write — the two describe the same
 * event. solidified_at is what the Day-30/Day-60 guarantee clock now
 * anchors to (see guarantee-assessment.ts).
 *
 * Guarded by .eq("search_status", "pending_refinement") so a
 * concurrent/overlapping run can't double-process the same row — returns
 * false rather than erroring if another run already solidified it first.
 */
export async function solidifySearch(searchId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: updated, error } = await admin
    .from("customer_searches")
    .update({ solidified_at: new Date().toISOString(), search_status: "searching" })
    .eq("id", searchId)
    .eq("search_status", "pending_refinement")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to solidify search ${searchId}: ${error.message}`);
  }

  return !!updated;
}

export interface SolidificationSummary {
  solidified: string[];
  errors: { searchId: string; error: string }[];
}

/**
 * Runs solidification across every due search, sequentially, continuing
 * past individual failures — same style as runDay30Assessment.
 */
export async function runSolidification(): Promise<SolidificationSummary> {
  const due = await getSearchesDueForSolidification();
  const summary: SolidificationSummary = { solidified: [], errors: [] };

  for (const { id } of due) {
    try {
      const didSolidify = await solidifySearch(id);
      if (didSolidify) {
        summary.solidified.push(id);
      }
      // false means another run already solidified this row first — no-op.
    } catch (error) {
      summary.errors.push({
        searchId: id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return summary;
}
