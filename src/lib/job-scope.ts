import "server-only";
import type { NextRequest } from "next/server";
import { runtimeEnv } from "./runtime-env";

/**
 * Who may run a scheduled job, and over what (Phase 1 Chunk 8; the same rule as the assignment
 * sweep's sweepScope):
 *   - production: the whole job, as Vercel Cron runs it. A manual call with ?only=<id>,<id>
 *     (it needs CRON_SECRET) limits that run to the named ids; Vercel Cron never sends it;
 *   - a preview build: never (it shares the production database);
 *   - local and anything else: only on the ids named in ?only=, so a local run can never touch
 *     real or tester data.
 * What the ids are depends on the job (searches, customers or articles); each route says.
 * A scoped run is always logged and reported (scopeReport), so a manual run is never mistaken
 * for a scheduled one.
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

/**
 * Logs a scoped run (job name, "scoped", the ids) and returns the fields every job response
 * carries: { scoped: false } for a whole-job run, { scoped: true, onlyIds } for a scoped one.
 * `ids` maps a label (e.g. "searches", "alerts") to the ids for jobs with more than one list.
 */
export function scopeReport(
  job: string,
  ids: string[] | undefined | Record<string, string[] | null | undefined>,
): { scoped: false } | { scoped: true; onlyIds: string[] | Record<string, string[]> } {
  if (Array.isArray(ids) || ids === undefined) {
    if (!ids || ids.length === 0) return { scoped: false };
    console.log(`[job-scoped] ${job} scoped ids=${ids.join(",")}`);
    return { scoped: true, onlyIds: ids };
  }
  const named: Record<string, string[]> = {};
  for (const [label, list] of Object.entries(ids)) if (list && list.length) named[label] = list;
  if (Object.keys(named).length === 0) return { scoped: false };
  console.log(`[job-scoped] ${job} scoped ${Object.entries(named).map(([l, v]) => `${l}=${v.join(",")}`).join(" ")}`);
  return { scoped: true, onlyIds: named };
}
