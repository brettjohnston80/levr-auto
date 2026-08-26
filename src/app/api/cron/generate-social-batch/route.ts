import { NextRequest, NextResponse } from "next/server";
import { generateWeeklySocialBatch } from "@/lib/social-generation";

/**
 * Vercel Cron target (see vercel.json) — runs Sunday evening, generating
 * the upcoming week's 7-theme social batch from real data pulled from the
 * just-completed week (Testimonial/Deal-of-the-Week). Same
 * Authorization: Bearer $CRON_SECRET pattern as every other cron route.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await generateWeeklySocialBatch();

  return NextResponse.json({
    ok: true,
    generated: summary.generated,
    skipped: summary.skipped,
    errors: summary.errors,
  });
}
