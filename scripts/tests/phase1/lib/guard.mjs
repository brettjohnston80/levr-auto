// Before-run check (lib/run.sh runs it first; any problem aborts the whole run).
//   1. No test file contains Brett's ids or emails (they are looked up at runtime, never written in).
//   2. Every use of Brett's agent row or login in a test is a read: a count of his activity rows,
//      a select of his own row, or a comparison. Anything else (passing his id to an action, a
//      database function, a link, a sign-in, an auth change) aborts.
//   3. The service-role client refuses a write naming his account (lib/protect.mjs): checked here
//      with a harmless probe that must be refused.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.mjs";
import { adminClient } from "./env.mjs";
import { loadProtected, PROTECTED_EMAILS } from "./protect.mjs";
import { createRequire } from "node:module";

const TESTS = path.join(ROOT, "scripts/tests/phase1");
const { createClient } = createRequire(path.join(ROOT, "package.json"))("@supabase/supabase-js");
const fsEnv = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n").map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const raw = createClient(fsEnv.NEXT_PUBLIC_SUPABASE_URL, fsEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const values = await loadProtected(raw);

const problems = [];
const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.name === "node_modules" || e.name === "gen" ? [] : e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]);
// Reads that are allowed to name Brett's row (each is a select, count or comparison).
const ALLOWED = [
  /\.from\("agents"\)\.select\([^)]*\)\.eq\("levrid", 1\)/,                                   // look up his row
  /\.from\("agent_activity_log"\)\.select\("id", \{ count: "exact", head: true \}\)\.eq\("agent_id", (brett|b)\.id\)/, // count his activity
  /\.from\("agents"\)\.select\([^)]*\)\.eq\("id", brett\.id\)\.single\(\)/,                    // re-read his row
  /cnt\(brett\.id\)/, /actCount\(\)/, /agentState\(\(q\) => q\.eq\("levrid", 1\)/,
  /(===|!==) brett\.(id|auth_user_id|email)\b|brett\.(id|auth_user_id|email) (===|!==)/,       // comparisons
  /\.eq\("levrid", 1\)\.single\(\)\)\.data\.email/,                                            // read his email to find his row on a page
];
for (const f of files(TESTS).filter((x) => /\.(mjs|mts|cjs|sh|json)$/.test(x) && !x.endsWith("package-lock.json") && !x.includes("/lib/protect.mjs") && !x.includes("/lib/guard.mjs"))) {
  const rel = path.relative(TESTS, f);
  fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    const low = line.toLowerCase();
    for (const v of values) if (low.includes(v.toLowerCase())) problems.push(`${rel}:${i + 1} contains Brett's ${v.includes("@") ? "email " + v : "id " + v.slice(0, 8) + "…"}`);
    const uses = line.match(/\bbrett\.(id|auth_user_id|email)\b|\.eq\("levrid", 1\)/g);
    if (uses && !ALLOWED.some((re) => re.test(line))) problems.push(`${rel}:${i + 1} uses Brett's row in a way that isn't a plain read: ${line.trim().slice(0, 160)}`);
  });
}

// The guarded client must refuse a write naming him (an update that would match no rows anyway).
const brettAgentId = (await raw.from("agents").select("id").eq("levrid", 1).single()).data.id;
let refused = false;
try {
  const r = await adminClient().from("agents").update({ name: "never" }).eq("id", brettAgentId).eq("email", "no-such-row@levrauto-test.invalid");
  refused = /TEST GUARD/.test(r.error?.message ?? "");
} catch (e) { refused = /TEST GUARD/.test(e.message); }
if (!refused) problems.push("the test database client did not refuse a write naming Brett's agent row");

if (problems.length) { console.log("GUARD: ABORT\n" + problems.join("\n")); process.exit(1); }
console.log(`GUARD: ok (${values.size} protected values: Brett's agent row, his logins and ${PROTECTED_EMAILS.length} emails; every test use of his row is a read; the client refuses writes naming him)`);
