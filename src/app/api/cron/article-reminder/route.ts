import { jobScope, scopeReport } from "@/lib/job-scope";
import { NextRequest, NextResponse } from "next/server";
import { sendArticleReminders } from "@/lib/article-reminders";

/**
 * Vercel Cron target (see vercel.json) — sends escalating "review this
 * draft" reminders (5/2/1/0 days before scheduled publish) to every active
 * agent for any article still status='draft'. Same Authorization: Bearer
 * $CRON_SECRET pattern as every other cron route.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Outside production only the article ids in ?only= (job-scope.ts); production runs everything.
  const scope = jobScope(request);
  if (!scope.allowed) {
    return NextResponse.json({ ok: true, skipped: scope.reason });
  }
  // A scoped run (?only=) is logged and says so in the response, so it is never taken for a
  // scheduled one.
  const report = scopeReport("article-reminder", scope.onlyIds);
  const summary = await sendArticleReminders({ onlyArticleIds: scope.onlyIds });

  return NextResponse.json({
    ok: true,
    ...report,
    remindersSent: summary.remindersSent,
    errors: summary.errors,
  });
}
