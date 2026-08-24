import { NextRequest, NextResponse } from "next/server";
import { sendNotificationDigests } from "@/lib/notification-digest";

/**
 * Vercel Cron target (see vercel.json) — sends the daily rollup email to
 * every communication_frequency = 'daily_digest' customer with at least
 * one undelivered notification_events row. Same
 * Authorization: Bearer $CRON_SECRET pattern as every other cron route.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await sendNotificationDigests();

  return NextResponse.json({
    ok: true,
    sent: summary.sent,
    errors: summary.errors,
  });
}
