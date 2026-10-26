// jobScope (src/lib/job-scope.ts) as each environment sees it. Environment variables are set per case
// exactly as Vercel/next set them: production = NODE_ENV production + VERCEL_ENV production + VERCEL_REGION.
import { NextRequest } from "next/server.js";
import { jobScope } from "../../../../../src/lib/job-scope";
const envs: Record<string, Record<string, string | undefined>> = {
  "production (Vercel)": { NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_REGION: "pdx1" },
  "preview (Vercel)": { NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_REGION: "pdx1" },
  "local next dev": { NODE_ENV: "development", VERCEL_ENV: "production", VERCEL_REGION: undefined },
};
const urls = ["https://www.levrauto.com/api/cron/day60-pause-overdue-searches", "https://www.levrauto.com/api/cron/day60-pause-overdue-searches?only=a,b"];
for (const [name, vars] of Object.entries(envs)) {
  for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete (process.env as Record<string, string | undefined>)[k]; else (process.env as Record<string, string>)[k] = v; }
  for (const u of urls) console.log(`${name.padEnd(20)} ${u.includes("?only") ? "with ?only=a,b " : "no parameter   "} → ${JSON.stringify(jobScope(new NextRequest(u)))}`);
}
