import { jobScope } from "@/lib/job-scope";
import { NextRequest, NextResponse } from "next/server";
import { pauseOverdueSearches } from "@/lib/day60-extension";

/**
 * Vercel Cron target (see vercel.json) — pauses any active search whose
 * Day-60 (or rolling post-extension) deadline has passed with no
 * extension. Hard cutoff, no grace period. Same Authorization: Bearer
 * $CRON_SECRET pattern as every other cron route.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Outside production only the search ids in ?only= (job-scope.ts); production runs everything.
  const scope = jobScope(request);
  if (!scope.allowed) {
    return NextResponse.json({ ok: true, skipped: scope.reason });
  }
  const summary = await pauseOverdueSearches({ onlySearchIds: scope.onlyIds });

  return NextResponse.json({
    ok: true,
    paused: summary.paused,
    autoRenewed: summary.autoRenewed,
    errors: summary.errors,
  });
}
