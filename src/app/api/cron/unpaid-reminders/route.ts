import { NextRequest, NextResponse } from "next/server";
import { sendUnpaidReminders } from "@/lib/unpaid-reminders";

/**
 * Vercel Cron target (hourly, see vercel.json) -- the 24h/72h "finish your
 * search" reminders for saved, unpaid searches. Sends nothing while
 * REMINDER_MAILING_ADDRESS or UNSUBSCRIBE_SECRET is unset. Same
 * Authorization: Bearer $CRON_SECRET pattern as every other cron route.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await sendUnpaidReminders();

  return NextResponse.json({ ok: true, ...summary });
}
