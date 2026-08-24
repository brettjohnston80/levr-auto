import { NextRequest, NextResponse } from "next/server";
import { sendPostDealSurveys } from "@/lib/post-deal-survey";

/**
 * Vercel Cron target (see vercel.json) — creates and sends the post-deal
 * survey for any purchased search at least POST_DEAL_SURVEY_DELAY_DAYS past
 * purchased_at with no existing post_deal_surveys row. Same
 * Authorization: Bearer $CRON_SECRET pattern as every other cron route.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await sendPostDealSurveys();

  return NextResponse.json({
    ok: true,
    sent: summary.sent,
    errors: summary.errors,
  });
}
