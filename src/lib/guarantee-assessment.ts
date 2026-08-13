import "server-only";
import { createAdminClient } from "./supabase/admin";
import { evaluateOfferGuaranteeContribution } from "./guarantee";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Searches due for their Day-30 guarantee determination: at least 30 days
 * have elapsed since solidified_at (not paid_at) — the guarantee clock
 * starts once the customer has locked in make/model and all refinement
 * decisions (see search-solidification.ts), not at the moment of payment.
 * guarantee_status must still be 'pending'.
 *
 * Deliberately an "elapsed >= 30 days" check, not "elapsed == exactly 30
 * days" — a once-daily cron that only matched an exact day would create a
 * permanent gap for any row whose day got skipped (an outage, a transient
 * error). The guarantee_status = 'pending' guard is what makes this safe to
 * run daily without re-processing already-resolved rows: a search only ever
 * appears here once, and if a run is missed it's simply caught by the next
 * one instead of being lost.
 *
 * No search_status filter — a row that was later switched to a different
 * make/model already solidified and collected its fee, and still owes its
 * own Day-30 resolution based on whatever offers arrived on it before the
 * switch.
 */
export async function getDueSearches(): Promise<{ id: string }[]> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const { data, error } = await admin
    .from("customer_searches")
    .select("id")
    .eq("guarantee_status", "pending")
    .not("solidified_at", "is", null)
    .lte("solidified_at", cutoff);

  if (error) {
    throw new Error(`Failed to load searches due for guarantee assessment: ${error.message}`);
  }

  return data ?? [];
}

export type AssessmentOutcome = "met" | "refunded";

/**
 * Assesses one search: met if any of its qualifying_offers currently
 * evaluates to "counts" per evaluateOfferGuaranteeContribution, refunded
 * otherwise. The 'refunded' case only ever sets guarantee_status here — it
 * does not touch Stripe. guarantee_status = 'refunded' is itself the
 * queryable worklist for a human to process the actual refund; see
 * CLAUDE.md.
 *
 * Also stamps guarantee_resolved_at — a dedicated column set only here, at
 * the moment of resolution, so it can't drift the way updated_at would if
 * the row is ever touched again later for an unrelated reason (e.g. a
 * post-resolution switch-make/model request).
 *
 * The write is guarded by .eq("guarantee_status", "pending") so a
 * concurrent/overlapping run can't double-process the same row — if another
 * run already resolved it first, this returns null rather than erroring.
 */
export async function assessSearch(searchId: string): Promise<AssessmentOutcome | null> {
  const admin = createAdminClient();

  const { data: offers, error: offersError } = await admin
    .from("qualifying_offers")
    .select("is_below_msrp, delivered_at, customer_responded_at, vehicle_sold_at")
    .eq("customer_search_id", searchId);

  if (offersError) {
    throw new Error(`Failed to load offers for search ${searchId}: ${offersError.message}`);
  }

  const guaranteeMet = (offers ?? []).some(
    (offer) =>
      evaluateOfferGuaranteeContribution({
        isBelowMsrp: offer.is_below_msrp,
        deliveredAt: offer.delivered_at,
        customerRespondedAt: offer.customer_responded_at,
        vehicleSoldAt: offer.vehicle_sold_at,
      }) === "counts"
  );

  const outcome: AssessmentOutcome = guaranteeMet ? "met" : "refunded";

  const { data: updated, error: updateError } = await admin
    .from("customer_searches")
    .update({ guarantee_status: outcome, guarantee_resolved_at: new Date().toISOString() })
    .eq("id", searchId)
    .eq("guarantee_status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to set guarantee_status for search ${searchId}: ${updateError.message}`);
  }

  return updated ? outcome : null;
}

export interface Day30AssessmentSummary {
  met: string[];
  refunded: string[];
  errors: { searchId: string; error: string }[];
}

/**
 * Runs the assessment across every due search, sequentially (predictable
 * load, easier to reason about in logs), continuing past individual
 * failures rather than aborting the whole batch — same style as
 * runBatchSync in marketcheck-scheduler.ts.
 */
export async function runDay30Assessment(): Promise<Day30AssessmentSummary> {
  const due = await getDueSearches();

  const summary: Day30AssessmentSummary = { met: [], refunded: [], errors: [] };

  for (const { id } of due) {
    try {
      const outcome = await assessSearch(id);
      if (outcome === "met") {
        summary.met.push(id);
      } else if (outcome === "refunded") {
        summary.refunded.push(id);
      }
      // outcome === null means another run already resolved this row first — no-op.
    } catch (error) {
      summary.errors.push({
        searchId: id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return summary;
}
