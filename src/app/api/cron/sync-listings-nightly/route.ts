import { NextRequest, NextResponse } from "next/server";
import { getNightlyMakeModels, LIVE_SEARCH_REFRESH_HOURS, runBatchSync } from "@/lib/marketcheck-scheduler";

/**
 * Vercel Cron target (see vercel.json), daily -- covers every make/model with
 * at least one customer_searches row at search_status = 'searching', and
 * refreshes each one only once it is ~3 days old (2026-10-11, was nightly).
 * Vercel automatically sends Authorization: Bearer $CRON_SECRET on
 * cron-triggered requests once CRON_SECRET is set as a project env var.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const makeModels = await getNightlyMakeModels();
  const results = await runBatchSync(makeModels, LIVE_SEARCH_REFRESH_HOURS);

  return NextResponse.json({
    ok: true,
    tier: "live-search (every 3 days)",
    count: results.length,
    synced: results.filter((r) => r.ok && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    results,
  });
}
