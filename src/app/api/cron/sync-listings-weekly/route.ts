import { NextRequest, NextResponse } from "next/server";
import { getWeeklyMakeModels, runBatchSync } from "@/lib/marketcheck-scheduler";

/**
 * Vercel Cron target (see vercel.json) — syncs every make/model already
 * known via `listings` that isn't currently in nightly's active-demand set.
 * Vercel automatically sends Authorization: Bearer $CRON_SECRET on
 * cron-triggered requests once CRON_SECRET is set as a project env var.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const makeModels = await getWeeklyMakeModels();
  const results = await runBatchSync(makeModels);

  return NextResponse.json({ ok: true, tier: "weekly", count: results.length, results });
}
