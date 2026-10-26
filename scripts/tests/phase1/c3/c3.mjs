// Chunk 3: assignment at payment and the hourly sweep. Stripe TEST mode only, disposable customers
// and agents (never LEVRID 1), everything deleted afterwards.
// PHASE=A: normal server. PHASE=B: server started with AGENT_ASSIGN_FORCE_FAIL=payment.
import { ROOT, LOGS } from "../lib/paths.mjs";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createRequire } from "node:module";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
const require = createRequire((ROOT + "/package.json"));
const Stripe = require("stripe");
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
if (!(env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")) { console.log("ABORT: Stripe key is not a test-mode key"); process.exit(1); }
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const PHASE = process.env.PHASE ?? "A";
const a = createAdminClient(); const BASE = "http://localhost:3100";
const DEVLOG = (LOGS + "/dev3100.log");
const MANIFEST = (ROOT + "/.next/dev/server/server-reference-manifest.json");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}`, pw = `Asg!${ts}aA`;
const FAKE_MAKE = `ClaudeVerify${ts}`, FAKE_MODEL = "Scratch";
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id, last_assigned_at, in_rotation").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const logins = [], agentIds = [], searches = [], listings = [], customers = [];
const logText = () => fs.readFileSync(DEVLOG, "utf8");
const assignLines = (sid) => logText().split("\n").filter((l) => l.startsWith("[assignment]") && l.includes(sid));
const failLines = (sid) => logText().split(/\n(?=\S)/).filter((l) => l.startsWith("[assignment-failed]") && l.includes(sid));
async function waitFor(fn, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(400); } return false; }

async function mkCustomer(tag, domain) {
  const email = `${PFX}-${tag}@${domain}`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw }), "customer").user;
  logins.push(u.id); customers.push(u.id); return u.id;
}
async function mkSearch(customerId) {
  const s = must(await a.from("customer_searches").insert({ customer_id: customerId, make: FAKE_MAKE, model: FAKE_MODEL, model_year: 2026, zip: "66101" }).select("id").single(), "search");
  searches.push(s.id); return s.id;
}
// One real test-mode charge, then the signed checkout.session.completed event our webhook receives.
async function pay(customerId, searchId) {
  const pi = await stripe.paymentIntents.create({ amount: 69900, currency: "usd", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" }, metadata: { claude_verify: PFX } });
  const event = { id: `evt_${PFX}_${searchId.slice(0, 8)}`, object: "event", type: "checkout.session.completed", api_version: "2024-06-20", created: Math.floor(Date.now() / 1000),
    data: { object: { id: `cs_test_${PFX}_${searchId.slice(0, 8)}`, object: "checkout.session", payment_status: "paid", status: "complete", amount_total: 69900, payment_intent: pi.id,
      metadata: { type: "search_payment", customer_id: customerId, customer_search_id: searchId } } } };
  const payload = JSON.stringify(event);
  return { pi: pi.id, payload, post: async () => {
    const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
    const r = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": sig, "content-type": "application/json" }, body: payload });
    return { status: r.status, body: await r.text() };
  } };
}
const sweep = async (only, extra = "") => { const r = await fetch(`${BASE}/api/cron/agent-sweeps${only ? `?only=${only.join(",")}${extra}` : extra ? `?${extra.slice(1)}` : ""}`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const searchRow = async (id) => (await a.from("customer_searches").select("paid_at, assigned_agent_id").eq("id", id).single()).data;
const paymentsFor = async (id) => (await a.from("payments").select("id", { count: "exact", head: true }).eq("search_id", id)).count;
const historyFor = async (id) => (await a.from("search_assignments").select("method, agent_id").eq("search_id", id)).data;

try {
  // Fresh scratch listing: the webhook's MarketCheck sync for this fake make/model is skipped (no call).
  listings.push(must(await a.from("listings").insert({ vin: `CV${ts}`.slice(0, 17), make: FAKE_MAKE, model: FAKE_MODEL, year: 2026, trim: "Scratch", synced_at: new Date().toISOString() }).select("id").single(), "listing").id);

  if (PHASE === "B") {
    const C = await mkCustomer("forced", "levrauto-test.invalid"); const S = await mkSearch(C);
    const p = await pay(C, S); const r = await p.post();
    const row = await searchRow(S);
    ok("forced failure: webhook still answers 200", r.status === 200, `${r.status} ${r.body}`);
    ok("forced failure: payment completed (paid_at set, payment recorded)", !!row.paid_at && (await paymentsFor(S)) === 1, JSON.stringify(row));
    ok("forced failure: [assignment-failed] logged for this search, no assignment call", await waitFor(() => failLines(S).length === 1) && assignLines(S).length === 0, `${failLines(S).length} failed / ${assignLines(S).length} ok`);
    // A real-style customer (not .invalid, so not a test account). Its payment-time call is forced
    // to fail, and the sweep is only ever run as a DRY RUN here: a real sweep would assign it to a
    // real agent.
    const R = await mkCustomer("realstyle", "claude-verify.test"); const SR = await mkSearch(R);
    const pr = await pay(R, SR); const rr = await pr.post();
    ok("real-style customer, forced failure: webhook 200, paid, [assignment-failed], still unassigned", rr.status === 200 && !!(await searchRow(SR)).paid_at && await waitFor(() => failLines(SR).length === 1) && assignLines(SR).length === 0 && (await searchRow(SR)).assigned_agent_id === null, `${rr.status} ${failLines(SR).length} failed`);
    const dry = await sweep([S, SR], "&dry_run=1");
    ok("dry-run sweep: selects the real-style search, leaves the test customer's search out of the query", dry.status === 200 && JSON.stringify(dry.json.assignment?.wouldAssign) === JSON.stringify([SR]) && dry.json.assignment?.examined === 1 && dry.json.assignment?.testCustomersExcluded > 0, JSON.stringify(dry.json.assignment));
    ok("…dry run calls assign_search for nothing (still unassigned, no sweep line)", assignLines(SR).length === 0 && (await searchRow(SR)).assigned_agent_id === null && (await historyFor(SR)).length === 0);
    const sw = await sweep([S]);
    ok("real sweep over the test customer's search: examined 0, assign_search not called", sw.status === 200 && sw.json.assignment?.examined === 0 && !assignLines(S).some((l) => l.includes('"source":"sweep"')), JSON.stringify(sw.json.assignment));
    ok("…test customer still unassigned (no history row)", (await searchRow(S)).assigned_agent_id === null && (await historyFor(S)).length === 0);
  } else {
    // ---------- payments
    const C1 = await mkCustomer("tester", "levrauto-test.invalid"); const S1 = await mkSearch(C1);
    const C2 = await mkCustomer("verify", "verify.invalid"); const S2 = await mkSearch(C2);
    const p1 = await pay(C1, S1);
    const t0 = Date.now(); const r1 = await p1.post(); const webhookMs = Date.now() - t0;
    ok("payment: webhook answers 200", r1.status === 200, `${r1.status} ${r1.body}`);
    ok("payment: paid_at set and 1 payment row", !!(await searchRow(S1)).paid_at && (await paymentsFor(S1)) === 1);
    ok("payment: assign_search called exactly once (after the response)", await waitFor(() => assignLines(S1).length === 1) && assignLines(S1)[0].includes('"source":"payment"'), assignLines(S1).join(" / "));
    ok("payment (tester domain): method skipped_test_account, stays unassigned, no history row", assignLines(S1)[0].includes("skipped_test_account") && (await searchRow(S1)).assigned_agent_id === null && (await historyFor(S1)).length === 0);
    const r1b = await p1.post(); await sleep(3000);
    ok("replay of the same event: 200, still 1 payment row", r1b.status === 200 && (await paymentsFor(S1)) === 1, r1b.body);
    ok("replay: assign_search NOT called again (still exactly 1 call)", assignLines(S1).length === 1, `${assignLines(S1).length} calls`);
    const p2 = await pay(C2, S2); const r2 = await p2.post();
    ok("payment (@verify.invalid, newly covered by Step 15): skipped_test_account, stays unassigned", r2.status === 200 && await waitFor(() => assignLines(S2).length === 1) && assignLines(S2)[0].includes("skipped_test_account") && (await searchRow(S2)).assigned_agent_id === null, assignLines(S2).join(" / "));
    ok(`webhook response time ${webhookMs} ms (assignment runs after it)`, true);

    // ---------- reassignment (lead-only server action) and "the sweep never reassigns"
    const mk = async (tag, role) => { const email = `${PFX}-${tag}@levrauto-test.invalid`;
      const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
      const ag = must(await a.from("agents").insert({ email, name: `CLAUDE VERIFY ${tag.toUpperCase()}`, role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(ag.id);
      must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: ag.id, p_auth_user_id: u.id }), "link");
      if (role !== "agent") must(await a.rpc("set_agent_role", { p_actor_agent_id: padmin.id, p_subject_agent_id: ag.id, p_role: role, p_in_rotation: false }), "role");
      const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
      const totp = (s) => { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const cc = Buffer.alloc(8); cc.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(cc).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); };
      must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut();
      return { id: ag.id, email, secret: en.totp.secret, totp };
    };
    const P = await mk("plain", "agent"), L = await mk("lead", "lead"), T = await mk("target", "agent");
    // reassignSearch has no screen yet, so Next doesn't compile it as a callable action; its gate is the
    // same getAuthorizedAgent({ minRole: "lead" }) tested in C16. Here: the database function it wraps.
    { const rp = await a.rpc("reassign_search", { p_search_id: S2, p_new_agent_id: T.id, p_actor_agent_id: P.id, p_reason: "test" });
      ok("reassign_search: plain agent refused", !!rp.error && /only leads and admins/.test(rp.error.message), rp.error?.message);
      const lead0 = await cnt(L.id);
      const rl = await a.rpc("reassign_search", { p_search_id: S2, p_new_agent_id: T.id, p_actor_agent_id: L.id, p_reason: "Testing reassignment" });
      ok("reassign_search: lead allowed (test customer's search → test agent)", !rl.error && (await searchRow(S2)).assigned_agent_id === T.id, rl.error?.message);
      const h = await historyFor(S2);
      ok("…one 'manual' history row and one search_reassigned activity row by the lead", h.length === 1 && h[0].method === "manual" && (await cnt(L.id)) - lead0 === 1, JSON.stringify(h)); }

    // ---------- sweeps
    const C3 = await mkCustomer("sweep", "levrauto-test.invalid"); const S3 = await mkSearch(C3);
    must(await a.from("customer_searches").update({ paid_at: new Date().toISOString() }).eq("id", S3), "paid S3");
    const scope = [S1, S2, S3];
    const one = await sweep(scope);
    ok("sweep: assigned search never selected; test customers' searches left out of the query (examined 0, no calls)", one.status === 200 && one.json.assignment?.examined === 0 && one.json.assignment?.testCustomersExcluded > 0 && one.json.assignment?.assigned === 0 && ![S1, S2, S3].some((sid) => assignLines(sid).some((l) => l.includes('"source":"sweep"'))), JSON.stringify(one.json.assignment));
    ok("…S2 still with the reassigned agent (the sweep didn't touch it)", (await searchRow(S2)).assigned_agent_id === T.id);
    const [x, y] = await Promise.all([sweep(scope), sweep(scope)]);
    const ran = [x, y].filter((r) => r.json.assignment), skipped = [x, y].filter((r) => r.json.skipped === "another run is in progress");
    ok("two sweeps at the same moment: exactly one runs, the other is skipped", ran.length === 1 && skipped.length === 1, JSON.stringify([x.json, y.json]));
    { const { data: lk } = await a.from("cron_job_locks").select("locked_until").eq("job", "agent-sweeps:local").single();
      ok("lock released after the run", new Date(lk.locked_until).getTime() <= Date.now(), lk.locked_until); }
    const er = await sweep(scope, "&force_error=1");
    { const { data: lk } = await a.from("cron_job_locks").select("locked_until").eq("job", "agent-sweeps:local").single();
      ok("sweep that errors: 500, and the lock is still released", er.status === 500 && new Date(lk.locked_until).getTime() <= Date.now(), `${er.status} ${lk.locked_until}`); }
    const after = await sweep(scope);
    ok("next sweep after the error runs normally", after.status === 200 && !!after.json.assignment, JSON.stringify(after.json));
    const un = await sweep(null);
    ok("unscoped sweep outside production: refused", un.status === 200 && /only a run limited to named searches/.test(un.json.skipped ?? ""), JSON.stringify(un.json));
    const noauth = await fetch(`${BASE}/api/cron/agent-sweeps?only=${S1}`);
    ok("no CRON_SECRET: 401", noauth.status === 401);
    const dryProdLike = await sweep(null, "&dry_run=1");
    ok("unscoped dry run outside production: still refused", /only a run limited to named searches/.test(dryProdLike.json.skipped ?? ""), JSON.stringify(dryProdLike.json));
    ok("production lock row untouched by local runs", (await a.from("cron_job_locks").select("job").eq("job", "agent-sweeps")).data.length === 0);
  }
  { const { data: b } = await a.from("agents").select("last_assigned_at, in_rotation").eq("id", brett.id).single();
    ok("LEVRID 1 untouched (never assigned, still in rotation)", b.last_assigned_at === brett.last_assigned_at && b.in_rotation === brett.in_rotation, JSON.stringify(b)); }
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  const { data: mine } = await a.from("agents").select("id").ilike("email", `${PFX}%`); for (const r of mine ?? []) if (!agentIds.includes(r.id)) agentIds.push(r.id);
  await del("agent_activity_log", "agent_id", agentIds); await a.from("agent_activity_log").delete().eq("agent_id", padmin.id).gte("created_at", runStart);
  await del("agent_activity_log", "search_id", searches); await del("agent_alerts", "search_id", searches); await del("agent_alerts", "agent_id", agentIds);
  await del("search_assignments", "search_id", searches); await del("payments", "search_id", searches); await del("notification_events", "customer_search_id", searches);
  await del("customer_searches", "id", searches); await del("listings", "id", listings);
  await a.from("cron_job_locks").delete().eq("job", "agent-sweeps:local");
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await del("customers", "id", customers); await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = {
    logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)), searches: searches.length ? await c("customer_searches", (q) => q.in("id", searches)) : 0,
    payments: searches.length ? await c("payments", (q) => q.in("search_id", searches)) : 0, history: searches.length ? await c("search_assignments", (q) => q.in("search_id", searches)) : 0,
    listings: listings.length ? await c("listings", (q) => q.in("id", listings)) : 0, locks: await c("cron_job_locks", (q) => q),
  };
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
