import { NextRequest, NextResponse } from "next/server";
import { runDay30Assessment } from "@/lib/guarantee-assessment";

/**
 * Vercel Cron target (see vercel.json) — resolves guarantee_status for any
 * customer_searches row at least 30 days past paid_at that's still
 * 'pending'. Vercel automatically sends Authorization: Bearer $CRON_SECRET
 * on cron-triggered requests once CRON_SECRET is set as a project env var.
 *
 * 'refunded' rows only ever get their status set here — no Stripe refund is
 * triggered. guarantee_status = 'refunded' is itself the worklist for a
 * human to process the actual refund (see CLAUDE.md).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runDay30Assessment();

  return NextResponse.json({
    ok: true,
    assessed: summary.met.length + summary.refunded.length,
    met: summary.met,
    refunded: summary.refunded,
    errors: summary.errors,
  });
}
