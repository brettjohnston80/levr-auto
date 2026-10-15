import { jobScope } from "@/lib/job-scope";
import { NextRequest, NextResponse } from "next/server";
import { sendNotificationDigests } from "@/lib/notification-digest";

/**
 * Vercel Cron target (see vercel.json) — sends the daily update email
 * (2026-09-27) to every customer with email on who has an agent reply they
 * haven't read and haven't been told about yet, or a routine update. See
 * notification-digest.ts. Same Authorization: Bearer $CRON_SECRET pattern as
 * every other cron route.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Outside production only the customer ids in ?only= (job-scope.ts); production runs everything.
  const scope = jobScope(request);
  if (!scope.allowed) {
    return NextResponse.json({ ok: true, skipped: scope.reason });
  }
  const summary = await sendNotificationDigests({ onlyCustomerIds: scope.onlyIds });

  return NextResponse.json({
    ok: true,
    sent: summary.sent,
    errors: summary.errors,
  });
}
