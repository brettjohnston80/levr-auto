// Chunk 3 review: the three switch paths that set paid_at assign the new search after the response.
// Test customers only (so assign_search answers skipped_test_account and nothing reaches a real
// agent); a disposable lead (never LEVRID 1); Alfa Romeo Tonale with a fresh scratch listing so the
// switch syncs skip (no MarketCheck call). Everything deleted afterwards and confirmed by count.
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createRequire } from "node:module";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
const require = createRequire((ROOT + "/package.json"));
const Stripe = require("stripe");
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
if (!(env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")) { console.log("ABORT: Stripe key is not a test-mode key"); process.exit(1); }
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const a = createAdminClient(); const BASE = "http://localhost:3100";
const DEVLOG = (LOGS + "/dev3100.log");
const MANIFEST = (ROOT + "/.next/dev/server/server-reference-manifest.json");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}`, pw = `Swi!${ts}aA`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id, last_assigned_at, in_rotation").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const logins = [], agentIds = [], customers = [], oldSearches = [], listings = [], secrets = {};
const logText = () => fs.readFileSync(DEVLOG, "utf8");
const assignLines = (sid) => logText().split("\n").filter((l) => l.startsWith("[assignment]") && l.includes(sid));
async function waitFor(fn, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(400); } return false; }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c3s-")) });
async function ctxPage() { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 1280, height: 900 }); p.setDefaultTimeout(300000); return p; }
async function go(p, u) { await p.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 180000 }).catch(() => {}); }
async function submit(p, pred) { await p.click('form:has(input[name="password"]) button[type="submit"], form:has(input[name="code"]) button[type="submit"]'); await p.waitForFunction(pred, { timeout: 240000, polling: 300 }).catch(() => {}); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
function actionIds() { const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); const out = {};
  for (const v of Object.values(m.node)) for (const w of Object.values(v.workers)) { const q = decodeURIComponent((w.moduleId.split("actions=")[1] ?? "").split("&")[0]);
    try { for (const [file, list] of JSON.parse(q)) for (const x of list) out[`${path.basename(file, ".ts")}.${x.exportedName ?? x.name}`] = x.id; } catch {} }
  return out; }
async function call(p, name, args) {
  const id = actionIds()[name]; if (!id) throw new Error(`no action id for ${name}`);
  return p.evaluate(async (id, args) => {
    const outer = new FormData(); let n = 0; let multipart = false;
    const json = args.map((arg) => { if (arg && typeof arg === "object" && arg.__form) { multipart = true; n++; const ref = n;
      for (const [k, v] of Object.entries(arg.__form)) outer.append(`_${ref}_${k}`, String(v)); return `$K${ref.toString(16)}`; } return arg; });
    let r;
    if (multipart) { outer.append("0", JSON.stringify(json)); r = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body: outer }); }
    else r = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify(args) });
    return `${r.status} ${await r.text()}`; }, id, args);
}
async function mkCustomer(tag) {
  const email = `${PFX}-${tag}@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw }), "customer").user; logins.push(u.id); customers.push(u.id); return { id: u.id, email };
}
async function mkPaidSearch(customerId) {
  const now = new Date().toISOString();
  const s = must(await a.from("customer_searches").insert({ customer_id: customerId, make: "Alfa Romeo", model: "Tonale", model_year: 2026, zip: "66101", search_status: "searching", paid_at: now, finalized_at: now, solidified_at: now }).select("id").single(), "search");
  oldSearches.push(s.id); return s.id;
}
const row = async (id) => (await a.from("customer_searches").select("id, superseded_by_id, search_status, paid_at, assigned_agent_id").eq("id", id).single()).data;
const history = async (id) => (await a.from("search_assignments").select("method, agent_id").eq("search_id", id)).data;
const newIds = async () => (await Promise.all(oldSearches.map(row))).map((r) => r?.superseded_by_id).filter(Boolean);

try {
  listings.push(must(await a.from("listings").insert({ vin: `CVS${ts}`.slice(0, 17), make: "Alfa Romeo", model: "Tonale", year: 2026, trim: "Scratch", synced_at: new Date().toISOString() }).select("id").single(), "listing").id);

  // ---------- 1. switch_fee webhook (a $100 paid switch), old search never assigned
  { const C = await mkCustomer("fee"); const OLD = await mkPaidSearch(C.id);
    const pi = await stripe.paymentIntents.create({ amount: 10000, currency: "usd", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" }, metadata: { claude_verify: PFX } });
    const payload = JSON.stringify({ id: `evt_${PFX}_fee`, object: "event", type: "checkout.session.completed", api_version: "2024-06-20", created: Math.floor(Date.now() / 1000),
      data: { object: { id: `cs_test_${PFX}_fee`, object: "checkout.session", payment_status: "paid", status: "complete", amount_total: 10000, payment_intent: pi.id,
        metadata: { type: "switch_fee", customer_id: C.id, old_search_id: OLD, new_make: "Alfa Romeo", new_model: "Tonale", new_model_year: "2026" } } } });
    const post = async () => { const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
      const r = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": sig, "content-type": "application/json" }, body: payload }); return { status: r.status, body: await r.text() }; };
    const r = await post(); const NEW = (await row(OLD)).superseded_by_id;
    ok("switch_fee webhook: 200, old search switched, new search paid", r.status === 200 && !!NEW && !!(await row(NEW)).paid_at, `${r.status} ${r.body}`);
    ok("switch_fee webhook: assign_search called exactly once for the new search (source payment)", await waitFor(() => assignLines(NEW).length === 1) && assignLines(NEW)[0].includes('"source":"payment"'), assignLines(NEW).join(" / "));
    ok("…test customer: skipped_test_account, new search stays unassigned, no history row", assignLines(NEW)[0].includes("skipped_test_account") && (await row(NEW)).assigned_agent_id === null && (await history(NEW)).length === 0);
    const r2 = await post(); await sleep(3000);
    ok("switch_fee replay: 200 'already switched', assign_search NOT called again", r2.status === 200 && /already switched/.test(r2.body) && assignLines(NEW).length === 1, `${r2.body}; ${assignLines(NEW).length} calls`);
    ok("old search: not assigned by any of this", (await row(OLD)).assigned_agent_id === null && assignLines(OLD).length === 0); }

  // ---------- 2. agent switch (comped, from /internal/outreach), old search never assigned
  const email = `${PFX}-lead@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
  const L = must(await a.from("agents").insert({ email, name: "CLAUDE VERIFY LEAD", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(L.id);
  must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: L.id, p_auth_user_id: u.id }), "link");
  must(await a.rpc("set_agent_role", { p_actor_agent_id: padmin.id, p_subject_agent_id: L.id, p_role: "lead", p_in_rotation: false }), "role");
  { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
    must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut(); secrets[email] = en.totp.secret; }
  { const C = await mkCustomer("agentsw"); const OLD = await mkPaidSearch(C.id);
    const p = await ctxPage(); await go(p, "/agent"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
    await submit(p, () => !!document.querySelector('input[name="code"]') || location.pathname !== "/agent");
    if (await p.$('input[name="code"]')) { await p.type('input[name="code"]', totp(secrets[email])); await submit(p, () => location.pathname !== "/agent"); }
    await go(p, "/internal/outreach");
    const r = await call(p, "switch-actions.switchCustomerSearch", [{ __form: { old_search_id: OLD, new_make: "Alfa Romeo", new_model: "Tonale", new_model_year: "2026", reason_category: "Goodwill gesture", notes: "Claude verify" } }]);
    const NEW = (await row(OLD)).superseded_by_id;
    ok("agent switch: action ok, new search paid", /"ok":true/.test(r) && !!NEW && !!(await row(NEW)).paid_at, r.slice(-200));
    ok("agent switch: assign_search called exactly once for the new search (source payment), skipped_test_account, unassigned", await waitFor(() => assignLines(NEW).length === 1) && assignLines(NEW)[0].includes("skipped_test_account") && (await row(NEW)).assigned_agent_id === null, assignLines(NEW).join(" / "));
    await p.browserContext().close(); }

  // ---------- 3. free self-service switch; old search assigned (reassigned to the test lead) -> inherited
  { const C = await mkCustomer("freesw"); const OLD = await mkPaidSearch(C.id);
    must(await a.rpc("reassign_search", { p_search_id: OLD, p_new_agent_id: L.id, p_actor_agent_id: padmin.id, p_reason: "Claude verify: inherit check" }), "reassign");
    const p = await ctxPage(); await go(p, "/login"); await p.type('input[name="email"]', C.email); await p.type('input[name="password"]', pw);
    await submit(p, () => location.pathname !== "/login"); await go(p, "/account");
    const r = await call(p, "switch-self-service-actions.executeFreeSwitch", [OLD, "Alfa Romeo", "Tonale", 2026]);
    const NEW = (await row(OLD)).superseded_by_id;
    ok("free switch: action ok, new search paid", /"ok":true/.test(r) && !!NEW && !!(await row(NEW)).paid_at, r.slice(-200));
    ok("free switch: new search inherits the old agent (inherited_switch history row)", (await row(NEW)).assigned_agent_id === L.id && (await history(NEW)).some((h) => h.method === "inherited_switch"), JSON.stringify(await history(NEW)));
    ok("free switch: assign_search called once after the response and answered already_assigned (no change)", await waitFor(() => assignLines(NEW).length === 1) && assignLines(NEW)[0].includes("already_assigned") && (await history(NEW)).length === 1, assignLines(NEW).join(" / "));
    await p.browserContext().close(); }

  { const { data: b } = await a.from("agents").select("last_assigned_at, in_rotation").eq("id", brett.id).single();
    ok("LEVRID 1 untouched (never assigned, still in rotation)", b.last_assigned_at === brett.last_assigned_at && b.in_rotation === brett.in_rotation); }
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser.close().catch(() => {});
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  const news = await newIds(); const all = [...oldSearches, ...news];
  await del("agent_activity_log", "agent_id", agentIds); await a.from("agent_activity_log").delete().eq("agent_id", padmin.id).gte("created_at", runStart);
  await del("agent_activity_log", "search_id", all); await del("agent_alerts", "search_id", all); await del("agent_alerts", "agent_id", agentIds);
  await del("agent_bypass_log", "search_id", all); await del("search_assignments", "search_id", all); await del("payments", "search_id", all);
  await del("notification_events", "customer_search_id", all);
  await del("customer_searches", "id", oldSearches); await del("customer_searches", "id", news); await del("listings", "id", listings);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await del("customers", "id", customers); await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = {
    logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)), searches: all.length ? await c("customer_searches", (q) => q.in("id", all)) : 0,
    customersBySearch: customers.length ? await c("customer_searches", (q) => q.in("customer_id", customers)) : 0,
    payments: all.length ? await c("payments", (q) => q.in("search_id", all)) : 0, history: all.length ? await c("search_assignments", (q) => q.in("search_id", all)) : 0,
    bypass: all.length ? await c("agent_bypass_log", (q) => q.in("search_id", all)) : 0, listings: listings.length ? await c("listings", (q) => q.in("id", listings)) : 0,
  };
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
