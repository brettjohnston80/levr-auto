import { NextRequest, NextResponse } from "next/server";
import { generateDueArticleDrafts } from "@/lib/article-generation";

/**
 * Vercel Cron target (see vercel.json) — finds every not_started article
 * within DRAFT_GENERATION_LEAD_DAYS of its scheduled publish date and
 * generates a real draft (web-search-backed body + social captions) for
 * it. Same Authorization: Bearer $CRON_SECRET pattern as every other cron
 * route.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await generateDueArticleDrafts();

  return NextResponse.json({
    ok: true,
    generated: summary.generated,
    errors: summary.errors,
  });
}
