import { jobScope, scopeReport } from "@/lib/job-scope";
import { NextRequest, NextResponse } from "next/server";
import { sendResumeReminders } from "@/lib/day60-extension";

/**
 * Vercel Cron target (see vercel.json) — sends the "your paused search will
 * end soon" email to any paused search within 7 days of its resume window
 * closing that hasn't already gotten a reminder for that exact paused_at
 * value. Same Authorization: Bearer $CRON_SECRET pattern as every other
 * cron route.
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
  // A scoped run (?only=) is logged and says so in the response, so it is never taken for a
  // scheduled one.
  const report = scopeReport("day60-resume-reminder", scope.onlyIds);
  const summary = await sendResumeReminders({ onlySearchIds: scope.onlyIds });

  return NextResponse.json({
    ok: true,
    ...report,
    remindersSent: summary.remindersSent,
    errors: summary.errors,
  });
}
