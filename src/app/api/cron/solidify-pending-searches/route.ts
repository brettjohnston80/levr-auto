import { NextRequest, NextResponse } from "next/server";
import { runSolidification } from "@/lib/search-solidification";

/**
 * Vercel Cron target (see vercel.json) — auto-solidifies any
 * customer_searches row still 'pending_refinement' at least 24h after
 * finalized_at, per the Refinement Window rule (Core-Processes-v1.md §2
 * step 3). Anchored to finalized_at, not paid_at -- finalization (trim/
 * color/options via finalize-actions.ts or an agent call) is now a
 * separate, explicit event that can happen well after payment.
 * Vercel automatically sends Authorization: Bearer $CRON_SECRET on
 * cron-triggered requests once CRON_SECRET is set as a project env var.
 *
 * Runs hourly, not daily like the other crons — 24h is a short,
 * customer-facing-promised window, and a daily cadence could let a search
 * sit unsolidified for nearly 48h in the worst case, meaningfully
 * stretching that promise. No external API cost here, so there's no
 * resource reason to prefer a coarser cadence the way there was for
 * MarketCheck.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runSolidification();

  return NextResponse.json({
    ok: true,
    solidified: summary.solidified,
    errors: summary.errors,
  });
}
