import { NextRequest, NextResponse } from "next/server";
import {
  getWeeklyAndMonthlyMakeModels,
  OTHER_MODEL_REFRESH_HOURS,
  RECENT_SEARCH_REFRESH_HOURS,
  runBatchSync,
} from "@/lib/marketcheck-scheduler";

/**
 * Vercel Cron target (see vercel.json), Sundays. Covers every make/model
 * already known via `listings` without a live search: those a real customer
 * searched in the last 90 days refresh weekly, the rest only once they are
 * ~4 weeks old (monthly). Vercel automatically sends Authorization: Bearer
 * $CRON_SECRET on cron-triggered requests once CRON_SECRET is set.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekly, monthly } = await getWeeklyAndMonthlyMakeModels();
  const weeklyResults = await runBatchSync(weekly, RECENT_SEARCH_REFRESH_HOURS);
  const monthlyResults = await runBatchSync(monthly, OTHER_MODEL_REFRESH_HOURS);
  const results = [...weeklyResults, ...monthlyResults];

  return NextResponse.json({
    ok: true,
    tier: "weekly+monthly",
    weekly: weekly.length,
    monthly: monthly.length,
    synced: results.filter((r) => r.ok && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    weeklyResults,
    monthlyResults,
  });
}
