// Chunk 7b, part 2: lookups by long id lists. 700 scratch test customers (past the ~650 failure
// point), each with one active search carrying a switch and a cancellation call request.
// LABEL=before|after. Runs the real queue functions through tsx; the Day-60 lookups are jobs that
// act on real (tester) data, so their exact query shape is run directly instead.
import { ROOT, LOGS } from "../lib/paths.mjs";
import fs from "node:fs"; import { execFileSync } from "node:child_process";
import { createAdminClient } from "../lib/admin.mjs";
const LABEL = process.env.LABEL ?? "after";
const a = createAdminClient();
const ts = Date.now(), PFX = `claude-verify-${ts}`, N = 700;
const MAKE = `ClaudeVerifyIds${ts}`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const must = (r, w) => { if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data; };
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id);
const logins = [], searchIds = [];
try {
  for (let i = 0; i < N; i += 20) {
    const batch = await Promise.all(Array.from({ length: Math.min(20, N - i) }, (_, k) =>
      a.auth.admin.createUser({ email: `${PFX}-c${String(i + k).padStart(3, "0")}@levrauto-test.invalid`, email_confirm: true, password: `Ids!${ts}aA` })));
    for (const r of batch) logins.push(must(r, "customer").user.id);
  }
  const now = new Date().toISOString();
  for (let i = 0; i < logins.length; i += 350) {
    searchIds.push(...must(await a.from("customer_searches").insert(logins.slice(i, i + 350).map((cid) => ({ customer_id: cid, zip: "66101", make: MAKE, model: "Many", model_year: 2026, search_status: "searching", paid_at: now, switch_call_requested_at: now, cancellation_call_requested_at: now }))).select("id"), "searches").map((r) => r.id));
  }
  console.log(`scratch: ${logins.length} customers, ${searchIds.length} searches`);
  const idsFile = `${LOGS}/c7b/ids-${ts}.json`;
  fs.writeFileSync(idsFile, JSON.stringify(searchIds));
  const raw = execFileSync("npx", ["tsx", "--conditions=react-server", "--env-file=.env.local", new URL("./harness.mts", import.meta.url).pathname, idsFile], { cwd: (ROOT + ""), encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  const line = raw.split("\n").find((l) => l.startsWith("HARNESS ")); const h = JSON.parse(line.slice(8));
  // The Day-60 lookups' exact shape: customers by the due searches' customer ids (one request vs chunks of 200).
  const single = await a.from("customers").select("id, email, first_name, last_name").in("id", logins);
  const chunked = []; for (let i = 0; i < logins.length; i += 200) { const { data, error } = await a.from("customers").select("id, email, first_name, last_name").in("id", logins.slice(i, i + 200)).order("id"); if (error) throw new Error(error.message); chunked.push(...data); }
  const metrics = { ...h, "day60 shape, one request": single.error ? `error: ${single.error.message}` : `${single.data.length} rows`, "day60 shape, chunks of 200": `${chunked.length} rows` };
  console.log(`METRICS ${LABEL}: ${JSON.stringify(metrics)}`);
  if (LABEL !== "before") {
    for (const name of ["outreach (active searches)", "switch calls", "cancellation calls"]) {
      ok(`${name}: all ${N} scratch searches, each with its customer's email`, h[name]?.rows === N && h[name]?.withEmail === N, JSON.stringify(h[name]));
    }
    ok("day60 shape: one request of 700 ids is refused; chunks of 200 return all 700 (the code now uses the chunked form)", !!single.error && chunked.length === N, metrics["day60 shape, one request"]);
  }
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  for (let i = 0; i < searchIds.length; i += 300) await a.from("customer_searches").delete().in("id", searchIds.slice(i, i + 300));
  for (let i = 0; i < logins.length; i += 20) await Promise.all(logins.slice(i, i + 20).map((id) => a.auth.admin.deleteUser(id)));
  for (let i = 0; i < logins.length; i += 300) await a.from("customers").delete().in("id", logins.slice(i, i + 300));
  const left = { searches: (await a.from("customer_searches").select("id", { count: "exact", head: true }).eq("make", MAKE)).count };
  let loginsLeft = 0; for (let i = 0; i < logins.length; i += 50) loginsLeft += (await Promise.all(logins.slice(i, i + 50).map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length;
  left.logins = loginsLeft;
  const b1 = await cnt(brett.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | Brett activity ${b0} -> ${b1}`);
  if (left.searches || left.logins || b1 !== b0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
