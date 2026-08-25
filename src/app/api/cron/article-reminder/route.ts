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

  const summary = await sendArticleReminders();

  return NextResponse.json({
    ok: true,
    remindersSent: summary.remindersSent,
    errors: summary.errors,
  });
}
