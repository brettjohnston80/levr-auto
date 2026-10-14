import "server-only";
import { createAdminClient } from "./supabase/admin";
import { isProductionDeploy, runtimeEnv } from "./runtime-env";
import { raiseAssignmentFailedAlert, resolveAssignmentFailedAlerts, sendPendingAgentAlerts } from "./agent-alerts";

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

// Test-only switch, never honoured in production: AGENT_ASSIGN_FORCE_FAIL="payment" (and/or
// "sweep") makes that caller's assign_search call fail (it calls a function name that doesn't
// exist), so a test can show the payment still completes, the failure alert is raised once, and
// nothing is ever assigned.
function forcedFailure(source: "payment" | "sweep"): boolean {
  return !isProductionDeploy() && (process.env.AGENT_ASSIGN_FORCE_FAIL ?? "").split(",").includes(source);
}

// Test-only, never honoured in production: AGENT_ASSIGN_SIMULATE_NO_ROTATION=1 stands in for
// assign_search as if nobody were in rotation, without touching anyone's real rotation. It never
// assigns; it writes the alert assign_search would write (lead fallback, naming the persistent test
// admin as the lead; or, for a search whose model is "NoLead", the no-lead alert to admins) and
// returns its id, so the test can see the immediate email go out.
async function simulatedNoRotation(searchId: string): Promise<{ data: unknown; error: { message: string } | null } | null> {
  if (isProductionDeploy() || process.env.AGENT_ASSIGN_SIMULATE_NO_ROTATION !== "1") return null;
  const admin = createAdminClient();
  const { data: s } = await admin.from("customer_searches").select("model").eq("id", searchId).single();
  const noLead = s?.model === "NoLead";
  const { data: lead } = await admin.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
  const { data: alert, error } = await admin
    .from("agent_alerts")
    .insert(noLead
      ? { kind: "assignment_no_lead", audience: "admins", search_id: searchId, details: { simulated: true } }
      : { kind: "assignment_lead_fallback", audience: "leads", search_id: searchId, agent_id: lead?.id, details: { simulated: true } })
    .select("id")
    .single();
  if (error) return { data: null, error };
  return { data: { method: noLead ? "simulated_no_lead" : "simulated_lead_fallback", agent_id: null, alert_id: alert.id }, error: null };
}

/**
 * Calls assign_search for one search. Never throws. `previousSearchId` (a switch) is the search
 * this one replaced: once the new search has an agent, failure alerts on either are closed.
 */
export async function assignSearch(
  searchId: string,
  source: "payment" | "sweep",
  opts: { previousSearchId?: string } = {},
): Promise<AssignOutcome> {
  try {
    const admin = createAdminClient();
    const fn = forcedFailure(source) ? "assign_search_forced_missing" : "assign_search";
    const { data, error } = (await simulatedNoRotation(searchId)) ?? (await admin.rpc(fn, { p_search_id: searchId }));
    if (error) {
      console.error("[assignment-failed]", { source, searchId, error: error.message });
      await alertFailure(searchId, source, error.message);
      return { ok: false, error: error.message };
    }
    const result = (data ?? {}) as { method?: string; agent_id?: string | null; alert_id?: string | null };
    // One searchable line per call, so a test (or Vercel logs) can count calls per search.
    console.log("[assignment]", JSON.stringify({ source, searchId, method: result.method, agentId: result.agent_id ?? null }));
    // A lead-fallback or no-lead alert goes out now rather than at the next hourly sweep.
    if (result.alert_id) await sendPendingAgentAlerts({ onlyAlertIds: [result.alert_id] });
    // The search has an agent now (newly, or already): any earlier failure alert is out of date.
    if (result.agent_id) {
      await resolveAssignmentFailedAlerts([searchId, opts.previousSearchId ?? ""], `${source} assignment (${result.method})`);
    }
    return { ok: true, method: result.method ?? "unknown", agentId: result.agent_id ?? null, alertId: result.alert_id ?? null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[assignment-failed]", { source, searchId, error: message });
    await alertFailure(searchId, source, message);
    return { ok: false, error: message };
  }
}

// A failed assignment for a real customer raises one assignment_failed alert (one open per
// search, so the hourly retries don't repeat it) and emails it straight away. Never throws.
async function alertFailure(searchId: string, source: string, message: string): Promise<void> {
  const alertId = await raiseAssignmentFailedAlert(searchId, source, message);
  if (alertId) await sendPendingAgentAlerts({ onlyAlertIds: [alertId] });
}

/**
 * Payment-time assignment (a $699 payment, or a switch: then `previousSearchId` is the old search).
 * Skipped on a preview build (which shares the production database).
 */
export async function assignSearchAtPayment(searchId: string, opts: { previousSearchId?: string } = {}): Promise<void> {
  if (runtimeEnv() === "preview") {
    console.log("[assignment] skipped on a preview build", { searchId });
    return;
  }
  await assignSearch(searchId, "payment", opts);
}

/**
 * Ids of every test customer: an auth email ending ".invalid", the same rule as
 * is_test_customer() (Step 15). Read from auth.users, never customers.email (which isn't unique
 * and is only a copy). Pages through every user.
 */
export async function testCustomerIds(): Promise<Set<string>> {
  const admin = createAdminClient();
  const ids = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) if ((u.email ?? "").toLowerCase().endsWith(".invalid")) ids.add(u.id);
    if (users.length < 1000) break;
  }
  return ids;
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
  testCustomersExcluded: number; // test customers whose searches were left out of the query
  wouldAssign?: string[]; // dry run only: the searches it would have passed to assign_search
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
export async function assignUnassignedPaidSearches(opts: { onlySearchIds?: string[]; deadline: number; dryRun?: boolean }): Promise<SweepCounts> {
  const admin = createAdminClient();
  const counts: SweepCounts = { examined: 0, assigned: 0, byMethod: {}, skippedTest: 0, testCustomersExcluded: 0, unassigned: 0, errors: [], stoppedEarly: false };
  if (opts.dryRun) counts.wouldAssign = [];
  let after: { paidAt: string; id: string } | null = null;

  // Test customers are never auto-assigned, so their searches are left out of the query instead
  // of being sent to assign_search every hour. assign_search still refuses them (the final word);
  // this only saves the calls. The list is small (test accounts), so it goes in the filter while it
  // stays short and is applied in code either way.
  const testIds = await testCustomerIds();
  const testIdList = [...testIds];
  counts.testCustomersExcluded = testIds.size;

  while (counts.examined < MAX_PER_RUN) {
    let q = admin
      .from("customer_searches")
      .select("id, paid_at, customer_id")
      .not("paid_at", "is", null)
      .is("assigned_agent_id", null)
      .not("search_status", "in", `(${ENDED_STATUSES.join(",")})`)
      .order("paid_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(PAGE);
    if (opts.onlySearchIds) q = q.in("id", opts.onlySearchIds.length ? opts.onlySearchIds : ["00000000-0000-0000-0000-000000000000"]);
    if (testIdList.length > 0 && testIdList.length <= 200) q = q.filter("customer_id", "not.in", `(${testIdList.join(",")})`);
    if (after) q = q.or(`paid_at.gt."${after.paidAt}",and(paid_at.eq."${after.paidAt}",id.gt.${after.id})`);
    const { data, error } = await q;
    if (error) throw new Error(`Could not load unassigned searches: ${error.message}`);
    const rows = (data ?? []) as { id: string; paid_at: string; customer_id: string }[];

    for (const row of rows) {
      if (Date.now() > opts.deadline || counts.examined >= MAX_PER_RUN) {
        counts.stoppedEarly = true;
        return counts;
      }
      if (testIds.has(row.customer_id)) continue; // only reached when the list was too long for the filter
      counts.examined++;
      if (opts.dryRun) {
        counts.wouldAssign!.push(row.id);
        continue;
      }
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
