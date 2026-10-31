// GX, second pass: switches into and out of an exception brand (free and paid screens, the paid
// switch's terms box and webhook), W12 in Matchmaker, and while-inventory-lasts (Rivian 2026 hidden,
// Polestar shown). Disposable accounts only; scratch listings on Tesla Model 3 and Toyota Camry
// make every inventory sync on the way skip (no MarketCheck calls); all deleted afterwards.
// Disposable customer (password login) and disposable agent (two-factor); the offers are sent
// by the branch's real sendOfferFor as that agent. Never Brett; everything deleted afterwards.
// Server: the offer-entry worktree's own dev server on :3400 (never Brett's :3000).
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/admin.mjs";
import { ROOT } from "../lib/paths.mjs";
import { createRequire } from "node:module";
const Stripe = createRequire(import.meta.url)("stripe");

const env = {}; for (const l of fs.readFileSync(ROOT + "/.env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const a = createAdminClient(); const BASE = "http://localhost:3600";
const SHOTS = path.join(os.homedir(), "Downloads/levr-gx-2026-10-30/second-pass"); fs.mkdirSync(SHOTS, { recursive: true });
const MANIFEST = ROOT + "/.next/dev/server/server-reference-manifest.json";
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}-${crypto.randomUUID().slice(0, 6)}`, pw = `Gx2!${ts}aA`;
const NEW = "x", OLD = "y"; const listings = [];
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
function actionIds() { const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); const out = {};
  for (const v of Object.values(m.node)) for (const w of Object.values(v.workers)) { const q = decodeURIComponent((w.moduleId.split("actions=")[1] ?? "").split("&")[0]);
    try { for (const [file, list] of JSON.parse(q)) for (const x of list) out[`${path.basename(file, ".ts")}.${x.exportedName ?? x.name}`] = x.id; } catch {} }
  return out; }

const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id);
const logins = [], searches = [], agentIds = [];
let browser, customerId = null;

async function shot(p, name) {
  for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
    await p.setViewport({ width: w, height: h }); await sleep(800);
    await p.screenshot({ path: `${SHOTS}/${name}-${tag}.png`, fullPage: true });
  }
  await p.setViewport({ width: 1440, height: 900 }); await sleep(300);
}
async function shotDialog(p, name) {
  // A tall viewport, so the whole dialog (a scroll container) is on screen for the shot.
  for (const [w, h, tag] of [[1440, 3200, "desktop"], [390, 4200, "phone"]]) {
    await p.setViewport({ width: w, height: h }); await sleep(900);
    const el = await p.$('[role="dialog"]');
    if (el) await el.screenshot({ path: `${SHOTS}/${name}-${tag}.png` }); else await p.screenshot({ path: `${SHOTS}/${name}-${tag}.png`, fullPage: true });
  }
  await p.setViewport({ width: 1440, height: 900 }); await sleep(300);
}
const bodyText = (p) => p.evaluate(() => document.body.innerText);
const waitText = (p, t, ms = 120000) => p.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms, polling: 300 }, t);
const go = async (p, url) => { await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 180000 }).catch(() => {});
  await p.waitForFunction(() => { const b = document.querySelector("main button"); return !b || Object.keys(b).some((k) => k.startsWith("__reactProps")); }, { timeout: 120000, polling: 300 }).catch(() => {}); };


const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const mk = async (tag) => { const email = `${PFX}-${tag}@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw }), tag).user; logins.push(u.id);
  must(await a.from("customers").update({ first_name: "Jordan", last_name: "Verify", phone: "555-0142" }).eq("id", u.id), "name"); return { id: u.id, email }; };
const settle = async (p) => { let last = "", same = 0;
  for (let i = 0; i < 240 && same < 3; i++) { await sleep(1000); const u = new URL(p.url()); const cur = u.pathname + u.search;
    if (cur.startsWith("/login") || cur.startsWith("/account/continue")) { same = 0; continue; } same = cur === last ? same + 1 : 0; last = cur; } return last; };
const signIn = async (p, email) => { await go(p, "/login"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw); await p.click('button[type="submit"]'); return settle(p); };
const scrollTo = (p, text) => p.evaluate((t) => [...document.querySelectorAll("*")].find((e) => e.childElementCount === 0 && e.textContent.includes(t))?.scrollIntoView({ block: "center" }), text);
async function shotAt(p, name, text) {
  for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) { await p.setViewport({ width: w, height: h }); await sleep(900); if (text) { await scrollTo(p, text); await sleep(500); }
    await p.screenshot({ path: `${SHOTS}/${name}-${tag}.png` }); }
  await p.setViewport({ width: 1440, height: 900 }); await sleep(300);
}
const NO_T = "Our money-back guarantee does not apply to Tesla.";
const W7 = "Your new search is covered by our money-back guarantee.";
const setSelect = (p, idx, value) => p.evaluate((i, v) => { const s = document.querySelectorAll("form select")[i]; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(s, v); s.dispatchEvent(new Event("change", { bubbles: true })); }, idx, value);
// Exact text first, so "Continue" never hits "Continue your search"; a prefix only as a fallback.
const clickText = (p, t) => p.evaluate((x) => { const all = [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent !== null);
  const b = all.find((e) => e.textContent.trim() === x) ?? all.find((e) => e.textContent.trim().startsWith(x)); b.scrollIntoView({ block: "center" }); b.click(); }, t);
const row = async (id) => (await a.from("customer_searches").select("make, model, search_status, guarantee_status, guarantee_exception_make, paid_at").eq("id", id).single()).data;
const newRowOf = async (oldId) => { const { data } = await a.from("customer_searches").select("superseded_by_id").eq("id", oldId).single(); if (data?.superseded_by_id) searches.push(data.superseded_by_id); return data?.superseded_by_id ?? null; };
try {
  for (const [make, model, year, tag] of [["Tesla", "Model 3", 2027, "A"], ["Toyota", "Camry", 2026, "B"]])
    listings.push(must(await a.from("listings").insert({ vin: `G2${tag}${ts}`.slice(0, 17), make, model, year, trim: "Scratch", synced_at: new Date().toISOString() }).select("id").single(), "listing").id);
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "gx2-")) });
  const page = async () => { const p = await (await browser.createBrowserContext()).newPage(); p.setDefaultTimeout(300000); await p.setViewport({ width: 1440, height: 900 }); return p; };
  const now = new Date().toISOString(), old = new Date(Date.now() - 12 * 864e5).toISOString();
  const live = async (customerId, make, model, year, extra = {}) => { const id = must(await a.from("customer_searches").insert({ customer_id: customerId, zip: "66213", make, model, model_year: year,
    search_status: "searching", paid_at: now, finalized_at: now, solidified_at: now, ...extra }).select("id").single(), "search").id; searches.push(id); return id; };
  const toPick = async (p, make, model, year) => {
    await go(p, "/account"); await clickText(p, "Switch it myself"); await sleep(600);
    await setSelect(p, 0, make); await sleep(300); await setSelect(p, 1, model); await sleep(300); await setSelect(p, 2, String(year)); await sleep(300);
    await clickText(p, "Continue"); };

  if (process.env.ONLY !== "mm") {
  // 1a. Free switch Toyota -> Tesla: W6, then the new search is not_applicable / Tesla.
  const F1 = await mk("free-to-tesla"); const f1 = await live(F1.id, "Toyota", "Camry", 2026);
  const p1 = await page(); await signIn(p1, F1.email); await toPick(p1, "Tesla", "Model 3", 2027);
  await waitText(p1, "You're within your free switch window"); const t1 = await bodyText(p1);
  ok("free switch Toyota → Tesla: W6 on the confirmation", t1.includes(NO_T) && !t1.includes(W7));
  await shotAt(p1, "01-free-switch-to-tesla-w6", "You're within your free switch window");
  await clickText(p1, "Confirm switch to"); await p1.waitForFunction(() => location.pathname.startsWith("/finalize/"), { timeout: 240000, polling: 300 });
  const n1 = await newRowOf(f1); const r1 = await row(n1);
  ok("…the new search is not_applicable / Tesla", r1.make === "Tesla" && r1.guarantee_status === "not_applicable" && r1.guarantee_exception_make === "Tesla", JSON.stringify(r1));

  // 1b. Free switch Tesla -> Toyota: W7, back to pending.
  const F2 = await mk("free-to-toyota"); const f2 = await live(F2.id, "Tesla", "Model 3", 2027, { guarantee_status: "not_applicable", guarantee_exception_make: "Tesla" });
  const p2 = await page(); await signIn(p2, F2.email); await toPick(p2, "Toyota", "Camry", 2026);
  await waitText(p2, "You're within your free switch window"); const t2 = await bodyText(p2);
  ok("free switch Tesla → Toyota: W7 on the confirmation", t2.includes(W7) && !t2.includes(NO_T));
  await shotAt(p2, "02-free-switch-to-toyota-w7", "You're within your free switch window");
  await clickText(p2, "Confirm switch to"); await p2.waitForFunction(() => location.pathname.startsWith("/finalize/"), { timeout: 240000, polling: 300 });
  const n2 = await newRowOf(f2); const r2 = await row(n2);
  ok("…the new search is pending with no exception make", r2.make === "Toyota" && r2.guarantee_status === "pending" && r2.guarantee_exception_make === null, JSON.stringify(r2));

  // 1c. Paid switch Toyota -> Tesla: W6, the terms box (refused, then ticked), Stripe with W5, then the webhook.
  const P1 = await mk("paid-to-tesla"); must(await a.from("customers").update({ created_at: old }).eq("id", P1.id), "backdate");
  const pp1 = await live(P1.id, "Toyota", "Camry", 2026);
  const p3 = await page(); await signIn(p3, P1.email); await toPick(p3, "Tesla", "Model 3", 2027);
  await waitText(p3, "Charge a $100 switch fee"); const t3 = await bodyText(p3);
  ok("paid switch Toyota → Tesla: W6 and the terms box (W3/W3a)", t3.includes(NO_T) && t3.includes("I agree to the Terms of Service.") && t3.includes("Money-back guarantee does not apply to Tesla, Rivian, Lucid or Polestar."));
  await clickText(p3, "Continue to payment"); await waitText(p3, "Please agree to the Terms of Service to continue.");
  ok("…not ticked: W4, no checkout, nothing stored", !p3.url().includes("stripe.com") && (await a.from("customers").select("terms_version").eq("id", P1.id).single()).data.terms_version === null);
  await shotAt(p3, "03-paid-switch-to-tesla-w6-terms-refused", "Charge a $100 switch fee");
  await p3.evaluate(() => document.querySelector('input[type="checkbox"]').click()); await clickText(p3, "Continue to payment");
  await p3.waitForFunction(() => location.hostname.includes("stripe.com"), { timeout: 120000, polling: 500 }); await sleep(4000);
  await p3.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 60000, polling: 500 }, NO_T).catch(() => {});
  ok("…ticked: terms stored, Stripe shows W5 for the switch", (await a.from("customers").select("terms_version").eq("id", P1.id).single()).data.terms_version === "interim-2026-10" && (await bodyText(p3)).includes(NO_T));
  await shotAt(p3, "04-paid-switch-stripe-w5", NO_T);
  const sw = async (customerId, oldId, make, model, year, tag) => {
    const pi = await stripe.paymentIntents.create({ amount: 10000, currency: "usd", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" }, metadata: { claude_verify: PFX } });
    const payload = JSON.stringify({ id: `evt_${PFX}_${tag}`, object: "event", type: "checkout.session.completed", api_version: "2024-06-20", created: Math.floor(Date.now() / 1000),
      data: { object: { id: `cs_test_${PFX}_${tag}`, object: "checkout.session", payment_status: "paid", status: "complete", amount_total: 10000, payment_intent: pi.id,
        metadata: { type: "switch_fee", customer_id: customerId, old_search_id: oldId, new_make: make, new_model: model, new_model_year: String(year) } } } });
    const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
    const r = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": sig, "content-type": "application/json" }, body: payload });
    return { status: r.status, payload, sig };
  };
  const w1 = await sw(P1.id, pp1, "Tesla", "Model 3", 2027, "a"); const n3 = await newRowOf(pp1); const r3 = await row(n3);
  ok("…webhook: the paid new search is not_applicable / Tesla", w1.status === 200 && r3.make === "Tesla" && !!r3.paid_at && r3.guarantee_status === "not_applicable" && r3.guarantee_exception_make === "Tesla", `${w1.status} ${JSON.stringify(r3)}`);
  const rep = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload: w1.payload, secret: env.STRIPE_WEBHOOK_SECRET }), "content-type": "application/json" }, body: w1.payload });
  const r3b = await row(n3);
  ok("…a replayed event (already switched) keeps the state", rep.status === 200 && r3b.guarantee_status === "not_applicable", String(rep.status));

  // 1d. Paid switch Tesla -> Toyota: W7, no terms box (already accepted), no W5; the webhook sets pending.
  const P2 = await mk("paid-to-toyota"); must(await a.from("customers").update({ created_at: old, terms_accepted_at: now, terms_version: "interim-2026-10" }).eq("id", P2.id), "backdate");
  const pp2 = await live(P2.id, "Tesla", "Model 3", 2027, { guarantee_status: "not_applicable", guarantee_exception_make: "Tesla" });
  const p4 = await page(); await signIn(p4, P2.email); await toPick(p4, "Toyota", "Camry", 2026);
  await waitText(p4, "Charge a $100 switch fee"); const t4 = await bodyText(p4);
  ok("paid switch Tesla → Toyota: W7, no terms box once accepted", t4.includes(W7) && !t4.includes("I agree to the Terms of Service."));
  await shotAt(p4, "05-paid-switch-to-toyota-w7", "Charge a $100 switch fee");
  await clickText(p4, "Continue to payment"); await p4.waitForFunction(() => location.hostname.includes("stripe.com"), { timeout: 120000, polling: 500 }); await sleep(4000);
  ok("…Stripe shows no guarantee line for Toyota", !(await bodyText(p4)).includes("money-back guarantee"));
  const w2 = await sw(P2.id, pp2, "Toyota", "Camry", 2026, "b"); const n4 = await newRowOf(pp2); const r4 = await row(n4);
  ok("…webhook: the new search is pending with no exception make", w2.status === 200 && r4.make === "Toyota" && r4.guarantee_status === "pending" && r4.guarantee_exception_make === null, `${w2.status} ${JSON.stringify(r4)}`);

  }
  // 2. Matchmaker: W12 on a Tesla card and its detail view.
  const pm = await page(); globalThis.__pm = pm; await go(pm, "/matchmaker"); await waitText(pm, "What type of vehicle are you looking for?");
  await clickText(pm, "Sedan"); await sleep(300); await clickText(pm, "Continue"); await sleep(500);
  await clickText(pm, "Daily commuting"); await sleep(500); await clickText(pm, "1-2"); await sleep(500); await clickText(pm, "Electric"); await sleep(500);
  await clickText(pm, "Both years"); await sleep(500); await clickText(pm, "Continue"); await sleep(500); await clickText(pm, "Continue"); await sleep(1500);
  await waitText(pm, "Here's what we'd search for");
  if (!(await bodyText(pm)).includes("Tesla Model 3")) { await clickText(pm, "Show 5 more"); await sleep(800); }
  const hasTesla = (await bodyText(pm)).includes("Tesla Model 3");
  const brand = hasTesla ? "Tesla Model 3" : "Lucid Air";
  const w12 = hasTesla ? NO_T : "Our money-back guarantee does not apply to Lucid.";
  ok(`Matchmaker: W12 on the ${brand} card${hasTesla ? "" : " (Tesla not in the top 10 for these answers)"}`, (await bodyText(pm)).includes(w12));
  await shotAt(pm, "06-matchmaker-card-w12", w12);
  await pm.evaluate((name) => { const els = [...document.querySelectorAll("li, article, div")].filter((e) => e.innerText.includes(name) && [...e.querySelectorAll("button")].some((b) => /^(Details|More info)$/.test(b.textContent.trim())));
    const el = els.sort((x, y) => x.innerText.length - y.innerText.length)[0]; [...el.querySelectorAll("button")].find((b) => /^(Details|More info)$/.test(b.textContent.trim())).click(); }, brand);
  // The detail view is a portal on <body> (it has no dialog role): the last body child holding its heading.
  const detail = () => pm.evaluateHandle(() => [...document.body.children].reverse().find((e) => /why this fits you/i.test(e.innerText ?? "")) ?? null);
  await pm.waitForFunction(() => [...document.body.children].some((e) => /why this fits you/i.test(e.innerText ?? "")), { timeout: 120000, polling: 300 }); await sleep(800);
  ok("Matchmaker detail: W12", (await pm.evaluate((el) => el.innerText, await detail())).includes(w12));
  for (const [w, h, tag] of [[1440, 1400, "desktop"], [390, 844, "phone"]]) { await pm.setViewport({ width: w, height: h }); await sleep(800); await scrollTo(pm, w12); await sleep(400); await pm.screenshot({ path: `${SHOTS}/07-matchmaker-detail-w12-${tag}.png` }); }

  // 3. While inventory lasts: intake (Rivian R1T/R1S offer 2027 only; Polestar 4 offered) and Matchmaker.
  const rivian = (await a.from("listings").select("id", { count: "exact", head: true }).eq("make", "Rivian")).count;
  const polestar = (await a.from("listings").select("id", { count: "exact", head: true }).eq("make", "Polestar")).count;
  ok("setup: Rivian has no synced listings, Polestar has some", rivian === 0 && polestar > 0, `${rivian} / ${polestar}`);
  const pi = await page(); await go(pi, "/"); await sleep(1000);
  const opts = async (i) => pi.evaluate((k) => { const s = [...document.querySelectorAll("select")].filter((x) => x.closest("section"))[k]; return [...s.options].map((o) => o.value).filter(Boolean); }, i);
  const pick = async (i, v) => { await pi.evaluate((k, val) => { const s = [...document.querySelectorAll("select")].filter((x) => x.closest("section"))[k]; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(s, val); s.dispatchEvent(new Event("change", { bubbles: true })); }, i, v); await sleep(400); };
  await pick(0, "Rivian"); const rModels = await opts(1);
  await pick(1, "R1T"); const r1tYears = await opts(2); await pick(1, "R1S"); const r1sYears = await opts(2);
  ok("intake: Rivian R1T and R1S offer 2027 only", rModels.includes("R1T") && JSON.stringify(r1tYears) === '["2027"]' && JSON.stringify(r1sYears) === '["2027"]', `${rModels} | ${r1tYears} | ${r1sYears}`);
  await shotAt(pi, "08-intake-rivian-r1s-2027-only", "Model year");
  await pick(0, "Polestar"); const pModels = await opts(1); await pick(1, pModels[0] ?? ""); const pYears = await opts(2);
  ok("intake: Polestar 4 offered (it has listings)", pModels.includes("4") && pYears.includes("2026"), `${pModels} | ${pYears}`);
  await shotAt(pi, "09-intake-polestar-4", "Model year");
  const pk = await page(); await go(pk, "/matchmaker"); await clickText(pk, "Skip the quiz"); await sleep(800);
  await clickText(pk, "Truck"); await sleep(600); await clickText(pk, "Rivian"); await sleep(800);
  const r1tButtons = await pk.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.textContent.trim().startsWith("R1T")).length);
  ok("Matchmaker picker: Rivian R1T offered for one year only (2027)", r1tButtons === 1, String(r1tButtons));
  await shotAt(pk, "10-matchmaker-rivian-trucks", "R1T");
  await go(pk, "/matchmaker"); await clickText(pk, "Skip the quiz"); await sleep(800); await clickText(pk, "SUV"); await sleep(600);
  ok("Matchmaker picker: Polestar offered among SUV makes", (await bodyText(pk)).includes("Polestar"));
} catch (e) {
  fail++; console.log("FAIL  run stopped:", e.message);
  if (globalThis.__pm) { await globalThis.__pm.screenshot({ path: `${SHOTS}/zz-failure.png`, fullPage: true }).catch(() => {}); console.log("STEP TEXT:", (await bodyText(globalThis.__pm).catch(() => "")).slice(0, 600).replace(/\s+/g, " ")); }
} finally {
  await a.from("listings").delete().in("id", listings.length ? listings : ["00000000-0000-0000-0000-000000000000"]);
  await a.from("payments").delete().in("search_id", searches.length ? searches : ["00000000-0000-0000-0000-000000000000"]);
  await browser?.close().catch(() => {});
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  await del("agent_activity_log", "agent_id", agentIds); await del("agent_activity_log", "search_id", searches);
  await del("notification_events", "customer_search_id", searches); await del("agent_alerts", "search_id", searches); await del("search_assignments", "search_id", searches);
  await del("deal_progress", "qualifying_offer_id", (await a.from("qualifying_offers").select("id").in("customer_search_id", searches.length ? searches : ["00000000-0000-0000-0000-000000000000"])).data?.map((o) => o.id) ?? []);
  await del("customer_searches", "id", searches);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = {
    searches: await c("customer_searches", (q) => q.in("id", searches.length ? searches : ["00000000-0000-0000-0000-000000000000"])),
    offers: await c("qualifying_offers", (q) => q.in("customer_search_id", searches.length ? searches : ["00000000-0000-0000-0000-000000000000"])),
    listings: await c("listings", (q) => q.in("id", listings.length ? listings : ["00000000-0000-0000-0000-000000000000"])),
    payments: await c("payments", (q) => q.in("search_id", searches.length ? searches : ["00000000-0000-0000-0000-000000000000"])),
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)),
    customers: await c("customers", (q) => q.in("id", logins.length ? logins : ["00000000-0000-0000-0000-000000000000"])),
    logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
  };
  const b1 = await cnt(brett.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed; screenshots in ${SHOTS}`);
}
