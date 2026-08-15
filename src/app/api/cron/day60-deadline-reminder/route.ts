import { NextRequest, NextResponse } from "next/server";
import { sendDay60Reminders } from "@/lib/day60-extension";

/**
 * Vercel Cron target (see vercel.json) — sends the "extend anytime for 30
 * more days" email to any active search within 7 days of its Day-60 (or
 * rolling post-extension) deadline that hasn't already gotten a reminder
 * for that exact deadline value. Same Authorization: Bearer $CRON_SECRET
 * pattern as every other cron route.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await sendDay60Reminders();

  return NextResponse.json({
    ok: true,
    remindersSent: summary.remindersSent,
    errors: summary.errors,
  });
}
