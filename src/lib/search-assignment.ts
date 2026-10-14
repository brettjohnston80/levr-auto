import "server-only";
import { createAdminClient } from "./supabase/admin";
import { isProductionDeploy, runtimeEnv } from "./runtime-env";

/**
 * Search assignment (Phase 1, Chunk 3; plan section 4).
 *
 * assign_search (database) does the choosing: test accounts (every .invalid address, Step 15)
 * are never auto-assigned, then continuity, round-robin, a lead fallback, or unassigned with an
 * admin alert. It takes an advisory lock and returns "already_assigned" for an assigned search,
 * so calling it twice can never double-assign or write a second history row.
 *
 * Two callers:
 *   - payment time: the Stripe webhook's search_payment branch, after the response is sent
 *     (next/server after()), so assignment can never fail, delay or roll back a payment;
 *   - the hourly sweep (/api/cron/agent-sweeps at :15): every real paid, unassigned, still-active
 *     search, so anything payment time missed (an error, an outage) is picked up within the hour.
 */

export type AssignOutcome =
  | { ok: true; method: string; agentId: string | null; alertId: string | null }
  | { ok: false; error: string };

// Test-only switch, never honoured in production: AGENT_ASSIGN_FORCE_FAIL="payment" makes the
// payment-time call fail (it calls a function name that doesn't exist), so the test can show the
// payment still completes and the sweep picks the search up.
function forcedPaymentFailure(): boolean {
  return !isProductionDeploy() && (process.env.AGENT_ASSIGN_FORCE_FAIL ?? "").split(",").includes("payment");
}

/** Calls assign_search for one search. Never throws. */
export async function assignSearch(searchId: string, source: "payment" | "sweep"): Promise<AssignOutcome> {
  try {
    const admin = createAdminClient();
    const fn = source === "payment" && forcedPaymentFailure() ? "assign_search_forced_missing" : "assign_search";
    const { data, error } = await admin.rpc(fn, { p_search_id: searchId });
    if (error) {
      console.error("[assignment-failed]", { source, searchId, error: error.message });
      return { ok: false, error: error.message };
    }
    const result = (data ?? {}) as { method?: string; agent_id?: string | null; alert_id?: string | null };
    // One searchable line per call, so a test (or Vercel logs) can count calls per search.
    console.log("[assignment]", JSON.stringify({ source, searchId, method: result.method, agentId: result.agent_id ?? null }));
    return { ok: true, method: result.method ?? "unknown", agentId: result.agent_id ?? null, alertId: result.alert_id ?? null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[assignment-failed]", { source, searchId, error: message });
    return { ok: false, error: message };
  }
}

/** Payment-time assignment. Skipped on a preview build (which shares the production database). */
export async function assignSearchAtPayment(searchId: string): Promise<void> {
  if (runtimeEnv() === "preview") {
    console.log("[assignment] skipped on a preview build", { searchId });
    return;
  }
  await assignSearch(searchId, "payment");
}

// Searches that have ended never need an agent.
const ENDED_STATUSES = ["switched", "cancelled", "closed"];
const PAGE = 500;
const MAX_PER_RUN = 2000;

export interface SweepCounts {
  examined: number;
  assigned: number;
  byMethod: Record<string, number>;
  skippedTest: number;
  unassigned: number;
  errors: { searchId: string; error: string }[];
  stoppedEarly: boolean;
}

/**
 * Every real paid, unassigned, still-active search, oldest payment first (keyset paging on
 * paid_at, id, so rows that become assigned mid-run can't shift the pages). Already-assigned
 * searches are never selected, so the sweep never reassigns anything. `onlySearchIds` limits a
 * run to those searches (local and test runs). Stops at `deadline` (ms since epoch) or 2,000.
 */
export async function assignUnassignedPaidSearches(opts: { onlySearchIds?: string[]; deadline: number }): Promise<SweepCounts> {
  const admin = createAdminClient();
  const counts: SweepCounts = { examined: 0, assigned: 0, byMethod: {}, skippedTest: 0, unassigned: 0, errors: [], stoppedEarly: false };
  let after: { paidAt: string; id: string } | null = null;

  while (counts.examined < MAX_PER_RUN) {
    let q = admin
      .from("customer_searches")
      .select("id, paid_at")
      .not("paid_at", "is", null)
      .is("assigned_agent_id", null)
      .not("search_status", "in", `(${ENDED_STATUSES.join(",")})`)
      .order("paid_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(PAGE);
    if (opts.onlySearchIds) q = q.in("id", opts.onlySearchIds.length ? opts.onlySearchIds : ["00000000-0000-0000-0000-000000000000"]);
    if (after) q = q.or(`paid_at.gt."${after.paidAt}",and(paid_at.eq."${after.paidAt}",id.gt.${after.id})`);
    const { data, error } = await q;
    if (error) throw new Error(`Could not load unassigned searches: ${error.message}`);
    const rows = (data ?? []) as { id: string; paid_at: string }[];

    for (const row of rows) {
      if (Date.now() > opts.deadline || counts.examined >= MAX_PER_RUN) {
        counts.stoppedEarly = true;
        return counts;
      }
      counts.examined++;
      const r = await assignSearch(row.id, "sweep");
      if (!r.ok) {
        counts.errors.push({ searchId: row.id, error: r.error });
        continue;
      }
      counts.byMethod[r.method] = (counts.byMethod[r.method] ?? 0) + 1;
      if (r.method === "skipped_test_account") counts.skippedTest++;
      else if (r.method === "unassigned") counts.unassigned++;
      else if (r.method !== "already_assigned") counts.assigned++;
    }
    if (rows.length < PAGE) break;
    after = { paidAt: rows[rows.length - 1].paid_at, id: rows[rows.length - 1].id };
  }
  if (counts.examined >= MAX_PER_RUN) counts.stoppedEarly = true;
  return counts;
}

/**
 * Who may run the sweep, and over what:
 *   - production: the full sweep (Vercel Cron runs only on the production deployment);
 *   - preview: never (it shares the production database);
 *   - local and anything else: only a run limited to named searches, so a local run can never
 *     sweep the real data.
 */
export function sweepScope(onlySearchIds: string[] | null): { allowed: true; scoped: boolean } | { allowed: false; reason: string } {
  const env = runtimeEnv();
  if (env === "production") return { allowed: true, scoped: !!onlySearchIds };
  if (env === "preview") return { allowed: false, reason: "not run on a preview build" };
  if (!onlySearchIds || onlySearchIds.length === 0) {
    return { allowed: false, reason: "outside production only a run limited to named searches is allowed" };
  }
  return { allowed: true, scoped: true };
}
