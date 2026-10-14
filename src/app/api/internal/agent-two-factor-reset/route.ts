import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resetAgentTwoFactor } from "@/lib/agent-two-factor-reset";

/**
 * Two-factor reset until the Phase 3 team screens (Phase 1, Chunk 1e). Run by a
 * lead or admin with curl, like the seed route:
 *
 *   curl -X POST "$SITE/api/internal/agent-two-factor-reset" \
 *     -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
 *     -d '{"actorEmail":"<your work email>","agentEmail":"<the agent's work email>"}'
 *
 * The same rules as everywhere: leads reset agents, admins reset anyone, never
 * your own. Confirm it's really the agent by phone or video first.
 * The last admin resetting their own (break-glass) is NOT possible here; that's
 * a SQL Editor step (see CLAUDE.md).
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const actorEmail = typeof body?.actorEmail === "string" ? body.actorEmail.trim().toLowerCase() : "";
  const agentEmail = typeof body?.agentEmail === "string" ? body.agentEmail.trim().toLowerCase() : "";
  if (!actorEmail || !agentEmail) {
    return NextResponse.json({ error: "actorEmail and agentEmail are required" }, { status: 400 });
  }
  const admin = createAdminClient();
  const [{ data: actor }, { data: subject }] = await Promise.all([
    admin.from("agents").select("id").ilike("email", actorEmail).maybeSingle(),
    admin.from("agents").select("id").ilike("email", agentEmail).maybeSingle(),
  ]);
  if (!actor) return NextResponse.json({ error: "No agent with that actorEmail" }, { status: 404 });
  if (!subject) return NextResponse.json({ error: "No agent with that agentEmail" }, { status: 404 });
  const result = await resetAgentTwoFactor({ actorAgentId: actor.id, subjectAgentId: subject.id });
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
