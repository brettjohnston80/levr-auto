import { NextRequest, NextResponse } from "next/server";
import { syncListingsForMakeModel } from "@/lib/marketcheck-sync";

/**
 * Manually triggers a MarketCheck sync for one make/model. Authenticated the
 * same way Vercel Cron authenticates its own requests (`Authorization: Bearer
 * $CRON_SECRET`), so this route doubles as the target for a future cron job
 * without changes. The demand-driven scheduling loop (which make/models to
 * sync, on what cadence) is a separate, not-yet-built step — this route
 * always syncs exactly the make/model it's given.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { make, model } = await request.json();
  if (!make || !model) {
    return NextResponse.json({ error: "make and model are required" }, { status: 400 });
  }

  try {
    const result = await syncListingsForMakeModel(make, model);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("MarketCheck sync failed:", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
