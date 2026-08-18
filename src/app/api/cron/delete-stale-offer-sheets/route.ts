import { NextRequest, NextResponse } from "next/server";
import { deleteStaleOfferSheets } from "@/lib/offer-sheet-cleanup";

/**
 * Vercel Cron target (see vercel.json) — deletes offer-sheet PDFs whose
 * owning search has reached a terminal status (cancelled, purchased,
 * switched). Same Authorization: Bearer $CRON_SECRET pattern as every
 * other cron route. No grace period — eligible on the run right after the
 * status change.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await deleteStaleOfferSheets();

  return NextResponse.json({
    ok: true,
    deleted: summary.deleted,
    errors: summary.errors,
  });
}
