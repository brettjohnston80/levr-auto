import "server-only";
import type { NextRequest } from "next/server";
import { runtimeEnv } from "./runtime-env";

/**
 * Who may run a scheduled job, and over what (Phase 1 Chunk 8; the same rule as the assignment
 * sweep's sweepScope):
 *   - production: the whole job, as Vercel Cron runs it (an optional ?only= limits it);
 *   - a preview build: never (it shares the production database);
 *   - local and anything else: only on the ids named in ?only=<id>,<id>, so a local run can never
 *     touch real or tester data.
 * What the ids are depends on the job (searches, customers or articles); each route says.
 */
export function jobScope(request: NextRequest): { allowed: true; onlyIds: string[] | undefined } | { allowed: false; reason: string } {
  const param = request.nextUrl.searchParams.get("only");
  const onlyIds = param ? param.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const env = runtimeEnv();
  if (env === "production") return { allowed: true, onlyIds: onlyIds.length ? onlyIds : undefined };
  if (env === "preview") return { allowed: false, reason: "not run on a preview build" };
  if (onlyIds.length === 0) return { allowed: false, reason: "outside production this job only runs on the ids named in ?only=" };
  return { allowed: true, onlyIds };
}
