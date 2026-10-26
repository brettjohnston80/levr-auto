// Chunk 4 review: (R) open "assignment failed" alerts close automatically once the search has an agent;
// (S) the immediate "nobody in rotation" emails, with the server simulating an empty rotation
// (AGENT_ASSIGN_SIMULATE_NO_ROTATION=1) so nobody's real rotation is touched. Test customers only.
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { createRequire } from "node:module";
import { createAdminClient } from "../lib/admin.mjs";
const require = createRequire((ROOT + "/package.json"));
const Stripe = require("stripe");
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
if (!(env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")) { console.log("ABORT: Stripe key is not a test-mode key"); process.exit(1); }
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const PHASE = process.env.PHASE ?? "R";
const a = createAdminClient(); const BASE = "http://localhost:3100";
const DEVLOG = (LOGS + "/dev3100.log");
const MANIFEST = (ROOT + "/.next/dev/server/server-reference-manifest.json");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}`, pw = `Res!${ts}aA`;
const MAKE = `ClaudeVerify${ts}`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const { data: padmin } = await a.from("agents").select("id, name").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id, last_assigned_at, in_rotation").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const { count: alerts0 } = await a.from("agent_alerts").select("id", { count: "exact", head: true });
const logins = [], customers = [], searches = [], agentIds = [], listings = [];
const logText = () => fs.readFileSync(DEVLOG, "utf8");
const assignLines = (sid) => logText().split("\n").filter((l) => l.startsWith("[assignment]") && l.includes(sid));
const alertLines = (id) => logText().split("\n").filter((l) => l.startsWith("[agent-alert]") && l.includes(id)).map((l) => JSON.parse(l.slice("[agent-alert] ".length)));
async function waitFor(fn, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(400); } return false; }
async function mkCustomer(tag) { const email = `${PFX}-${tag}@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw }), "customer").user; logins.push(u.id); customers.push(u.id);
  must(await a.from("customers").update({ first_name: "Jordan", last_name: "Sample" }).eq("id", u.id), "name"); return { id: u.id, email }; }
async function mkSearch(c, f = {}) { const s = must(await a.from("customer_searches").insert({ customer_id: c, zip: "66101", make: MAKE, model: "Scratch", model_year: 2026, ...f }).select("id").single(), "search"); searches.push(s.id); return s.id; }
const failAlert = async (sid) => must(await a.from("agent_alerts").insert({ kind: "assignment_failed", audience: "leads", search_id: sid, details: { error: "statement timeout", source: "payment" }, notified_at: new Date().toISOString() }).select("id").single(), "alert").id;
const alertRow = async (id) => (await a.from("agent_alerts").select("resolved_at, resolved_by_agent_id, details, notified_at, kind, audience").eq("id", id).single()).data;
const row = async (id) => (await a.from("customer_searches").select("superseded_by_id, assigned_agent_id, paid_at").eq("id", id).single()).data;
async function post(metadata, amount, tag) {
  const pi = await stripe.paymentIntents.create({ amount, currency: "usd", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" }, metadata: { claude_verify: PFX } });
  const payload = JSON.stringify({ id: `evt_${PFX}_${tag}`, object: "event", type: "checkout.session.completed", api_version: "2024-06-20", created: Math.floor(Date.now() / 1000),
    data: { object: { id: `cs_test_${PFX}_${tag}`, object: "checkout.session", payment_status: "paid", status: "complete", amount_total: amount, payment_intent: pi.id, metadata } } });
  const r = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET }), "content-type": "application/json" }, body: payload });
  return { status: r.status, body: await r.text() };
}
function actionIds() { const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); const out = {};
  for (const v of Object.values(m.node)) for (const w of Object.values(v.workers)) { const q = decodeURIComponent((w.moduleId.split("actions=")[1] ?? "").split("&")[0]);
    try { for (const [file, list] of JSON.parse(q)) for (const x of list) out[`${path.basename(file, ".ts")}.${x.exportedName ?? x.name}`] = x.id; } catch {} }
  return out; }

let browser;
try {
  for (const m of ["Scratch", "NoLead"]) listings.push(must(await a.from("listings").insert({ vin: `CV${m[0]}${ts}`.slice(0, 17), make: MAKE, model: m, year: 2026, trim: "Scratch", synced_at: new Date().toISOString() }).select("id").single(), "listing").id);
  if (PHASE === "R") {
    // Alfa Romeo Tonale scratch listing so the switch syncs skip (no MarketCheck call).
    listings.push(must(await a.from("listings").insert({ vin: `CVR${ts}`.slice(0, 17), make: "Alfa Romeo", model: "Tonale", year: 2026, trim: "Scratch", synced_at: new Date().toISOString() }).select("id").single(), "listing").id);
    const L = must(await a.from("agents").insert({ email: `${PFX}-lead@levrauto-test.invalid`, name: "Casey Lead", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(L.id);
    const now = new Date().toISOString();
    const paidSearch = (c) => mkSearch(c, { make: "Alfa Romeo", model: "Tonale", search_status: "searching", paid_at: now, finalized_at: now, solidified_at: now });

    // 1. free switch: the old search has an agent and an open failure alert
    { const C = await mkCustomer("free"); const O = await paidSearch(C.id);
      must(await a.rpc("reassign_search", { p_search_id: O, p_new_agent_id: L.id, p_actor_agent_id: padmin.id, p_reason: "Claude verify: auto-resolve" }), "reassign");
      const A = await failAlert(O);
      browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c4b-")) });
      const p = await browser.newPage(); p.setDefaultTimeout(300000);
      await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await p.type('input[name="email"]', C.email); await p.type('input[name="password"]', pw);
      await p.click('form:has(input[name="password"]) button[type="submit"]'); await p.waitForFunction(() => location.pathname !== "/login", { timeout: 240000 });
      await p.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" }); await p.waitForNetworkIdle({ idleTime: 800 }).catch(() => {});
      const id = actionIds()["switch-self-service-actions.executeFreeSwitch"];
      const r = await p.evaluate(async (id, O) => { const res = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify([O, "Alfa Romeo", "Tonale", 2026]) }); return `${res.status} ${await res.text()}`; }, id, O);
      const N = (await row(O)).superseded_by_id; if (N) searches.push(N);
      await waitFor(() => assignLines(N ?? "-").length === 1);
      await waitFor(async () => !!(await alertRow(A)).resolved_at); // closed just after the assignment line
      const ar = await alertRow(A);
      ok("free switch: new search keeps the agent; the old search's open failure alert is closed automatically", /"ok":true/.test(r) && (await row(N)).assigned_agent_id === L.id && !!ar.resolved_at && ar.resolved_by_agent_id === null && ar.details.auto_resolved === true && ar.details.auto_resolved_by === "payment assignment (already_assigned)", JSON.stringify(ar));
      ok("…its original details kept (error, source)", ar.details.error === "statement timeout" && ar.details.source === "payment"); }

    // 2. paid switch (webhook): same, the other entry point
    { const C = await mkCustomer("fee"); const O = await paidSearch(C.id);
      must(await a.rpc("reassign_search", { p_search_id: O, p_new_agent_id: L.id, p_actor_agent_id: padmin.id, p_reason: "Claude verify: auto-resolve" }), "reassign");
      const A = await failAlert(O);
      const r = await post({ type: "switch_fee", customer_id: C.id, old_search_id: O, new_make: "Alfa Romeo", new_model: "Tonale", new_model_year: "2026" }, 10000, "fee");
      const N = (await row(O)).superseded_by_id; if (N) searches.push(N);
      await waitFor(async () => !!(await alertRow(A)).resolved_at);
      const ar = await alertRow(A);
      ok("paid switch: the old search's failure alert closed automatically", r.status === 200 && !!ar.resolved_at && ar.resolved_by_agent_id === null && ar.details.auto_resolved === true, JSON.stringify(ar)); }

    // 3. no agent: a test customer's payment (skipped_test_account) leaves the alert open
    { const C = await mkCustomer("none"); const S = await mkSearch(C.id); const A = await failAlert(S);
      const r = await post({ type: "search_payment", customer_id: C.id, customer_search_id: S }, 69900, "none");
      await waitFor(() => assignLines(S).length === 1); await sleep(1500);
      ok("no agent assigned (test customer): the failure alert stays open", r.status === 200 && assignLines(S)[0]?.includes("skipped_test_account") && (await alertRow(A)).resolved_at === null); }

    // 4. once closed, a new failure alert for that search can be raised again (not blocked)
    { const { data: open } = await a.from("agent_alerts").select("id").eq("kind", "assignment_failed").is("resolved_at", null).in("search_id", searches);
      ok("closed alerts no longer count as open for their searches (only case 3's stays open)", (open ?? []).length === 1, JSON.stringify(open)); }
  } else {
    // PHASE S: the server simulates an empty rotation. Payment-time assignment writes the alert
    // and must email it straight away.
    const C = await mkCustomer("sim");
    const S1 = await mkSearch(C.id, { model: "Scratch" });
    const r1 = await post({ type: "search_payment", customer_id: C.id, customer_search_id: S1 }, 69900, "s1");
    await waitFor(() => assignLines(S1).length === 1);
    const { data: a1 } = await a.from("agent_alerts").select("id").eq("search_id", S1).eq("kind", "assignment_lead_fallback");
    if (a1?.[0]) await waitFor(() => alertLines(a1[0].id).length === 1); // sent just after the assignment line
    const l1 = a1?.[0] ? alertLines(a1[0].id) : [];
    ok("simulated empty rotation (lead fallback): payment 200, alert written", r1.status === 200 && assignLines(S1)[0]?.includes("simulated_lead_fallback") && a1?.length === 1, assignLines(S1).join(" / "));
    ok("…emailed straight away (no sweep run), to leads, with the approved subject; notified_at set", l1.length === 1 && l1[0].audience === "leads" && l1[0].subject === `Search assigned to ${padmin.name}: nobody is in rotation` && l1[0].sent > 0 && !!(await alertRow(a1[0].id)).notified_at, JSON.stringify(l1[0] ?? null));
    ok("…body names the customer and vehicle", (l1[0]?.html ?? "").includes(`Jordan Sample's 2026 ${MAKE} Scratch search was paid and assigned to`));
    const S2 = await mkSearch(C.id, { model: "NoLead" });
    const r2 = await post({ type: "search_payment", customer_id: C.id, customer_search_id: S2 }, 69900, "s2");
    await waitFor(() => assignLines(S2).length === 1); await sleep(500);
    const { data: a2 } = await a.from("agent_alerts").select("id").eq("search_id", S2).eq("kind", "assignment_no_lead");
    if (a2?.[0]) await waitFor(() => alertLines(a2[0].id).length === 1);
    const l2 = a2?.[0] ? alertLines(a2[0].id) : [];
    ok("simulated empty rotation and no lead: alert to admins emailed straight away, approved subject", r2.status === 200 && l2.length === 1 && l2[0].audience === "admins" && l2[0].subject === "A paid search has no agent" && l2[0].sent > 0 && !!(await alertRow(a2[0].id)).notified_at, JSON.stringify(l2[0] ?? null));
    ok("…neither search was assigned to anyone", (await row(S1)).assigned_agent_id === null && (await row(S2)).assigned_agent_id === null);
  }
  const { data: b } = await a.from("agents").select("last_assigned_at, in_rotation").eq("id", brett.id).single();
  ok("LEVRID 1 untouched (never assigned, rotation unchanged)", b.last_assigned_at === brett.last_assigned_at && b.in_rotation === brett.in_rotation);
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser?.close().catch(() => {});
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  const { data: more } = await a.from("customer_searches").select("id").in("customer_id", customers.length ? customers : ["00000000-0000-0000-0000-000000000000"]);
  for (const r of more ?? []) if (!searches.includes(r.id)) searches.push(r.id);
  await a.from("agent_activity_log").delete().eq("agent_id", padmin.id).gte("created_at", runStart);
  await del("agent_activity_log", "agent_id", agentIds); await del("agent_activity_log", "search_id", searches);
  await del("agent_alerts", "search_id", searches); await del("agent_alerts", "agent_id", agentIds);
  await del("agent_bypass_log", "search_id", searches); await del("search_assignments", "search_id", searches); await del("payments", "search_id", searches);
  await del("notification_events", "customer_search_id", searches);
  await a.from("customer_searches").update({ superseded_by_id: null }).in("id", searches);
  await del("customer_searches", "id", searches); await del("listings", "id", listings);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await del("customers", "id", customers);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = { logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)), searches: searches.length ? await c("customer_searches", (q) => q.in("id", searches)) : 0,
    listings: listings.length ? await c("listings", (q) => q.in("id", listings)) : 0, alertsTotal: await c("agent_alerts", (q) => q) };
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} (alerts before: ${alerts0}) | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (left.logins || left.agents || left.searches || left.listings || left.alertsTotal !== alerts0 || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
