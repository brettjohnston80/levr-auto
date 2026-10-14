import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProductionDeploy } from "@/lib/runtime-env";
import { assignUnassignedPaidSearches, sweepScope } from "@/lib/search-assignment";

/**
 * Vercel Cron target, hourly at :15 (vercel.json; plan section 4). For now it runs the
 * assignment sweep; the follow-up and alert-email sweeps join it in later chunks.
 *
 * - Auth: Authorization: Bearer $CRON_SECRET, like every cron route.
 * - Where it runs: production sweeps everything; a preview build never runs it; anywhere else
 *   (local) only a run limited to named searches (?only=<id>,<id>) is allowed. See sweepScope().
 * - Never overlaps itself: it claims the job lock first (cron_job_locks, Step 15) and returns
 *   "skipped" if another run holds it. The lock lasts LOCK_SECONDS, well past the longest run
 *   (the function stops itself at RUN_BUDGET_MS, inside maxDuration), and is released in a
 *   `finally`, so an error never leaves it held. If the function is killed outright, the lock
 *   still expires on its own.
 */
export const maxDuration = 300;
const RUN_BUDGET_MS = 240_000; // stop taking new searches after 4 minutes
const LOCK_SECONDS = 600; // 10 minutes: twice maxDuration

export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const onlyParam = request.nextUrl.searchParams.get("only");
  const onlySearchIds = onlyParam ? onlyParam.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const scope = sweepScope(onlySearchIds);
  if (!scope.allowed) {
    return NextResponse.json({ ok: true, skipped: scope.reason });
  }

  // Local and test runs use their own lock name, so a local run can never hold up production's.
  const job = isProductionDeploy() ? "agent-sweeps" : "agent-sweeps:local";
  const admin = createAdminClient();
  const { data: runId, error: claimError } = await admin.rpc("claim_cron_job", { p_job: job, p_seconds: LOCK_SECONDS });
  if (claimError) {
    console.error("[agent-sweeps] could not claim the lock", claimError.message);
    return NextResponse.json({ ok: false, error: "could not claim the lock" }, { status: 500 });
  }
  if (!runId) {
    console.log("[agent-sweeps] another run is in progress; skipped");
    return NextResponse.json({ ok: true, skipped: "another run is in progress" });
  }

  const started = Date.now();
  try {
    // Test-only: ?force_error=1 (ignored in production) throws mid-run, to show the lock is still
    // released.
    if (!isProductionDeploy() && request.nextUrl.searchParams.get("force_error") === "1") {
      throw new Error("forced test error");
    }
    // Test-only: ?dry_run=1 (ignored in production) lists the searches the sweep would assign
    // without calling assign_search, so a test can check the selection on a real-style customer
    // without assigning it to a real agent.
    const dryRun = !isProductionDeploy() && request.nextUrl.searchParams.get("dry_run") === "1";
    const assignment = await assignUnassignedPaidSearches({
      onlySearchIds: onlySearchIds ?? undefined,
      deadline: started + RUN_BUDGET_MS,
      dryRun,
    });
    console.log("[agent-sweeps]", JSON.stringify({ job, ms: Date.now() - started, ...assignment }));
    return NextResponse.json({ ok: true, ms: Date.now() - started, assignment });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[agent-sweeps] failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    const { error: releaseError } = await admin.rpc("release_cron_job", { p_job: job, p_run_id: runId });
    if (releaseError) console.error("[agent-sweeps] could not release the lock (it expires on its own)", releaseError.message);
  }
}
