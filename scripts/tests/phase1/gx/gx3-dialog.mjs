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
const SHOTS = path.join(os.homedir(), "Downloads/levr-gx-2026-10-30/dialog"); fs.mkdirSync(SHOTS, { recursive: true });
const MANIFEST = ROOT + "/.next/dev/server/server-reference-manifest.json";
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}-${crypto.randomUUID().slice(0, 6)}`, pw = `Gx3!${ts}aA`;
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
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "gx3-")) });
  const pm = await (await browser.createBrowserContext()).newPage(); pm.setDefaultTimeout(300000); await pm.setViewport({ width: 1440, height: 900 });
  await go(pm, "/matchmaker"); await waitText(pm, "What type of vehicle are you looking for?");
  await clickText(pm, "Sedan"); await sleep(300); await clickText(pm, "Continue"); await sleep(500);
  await clickText(pm, "Daily commuting"); await sleep(500); await clickText(pm, "1-2"); await sleep(500); await clickText(pm, "Electric"); await sleep(500);
  await clickText(pm, "Both years"); await sleep(500); await clickText(pm, "Continue"); await sleep(500); await clickText(pm, "Continue"); await sleep(1500);
  await waitText(pm, "Here's what we'd search for");
  // Open the first card's detail from its "More info" button, as a keyboard user would (focus, Enter).
  await pm.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "More info"); b.setAttribute("data-opener", "1"); b.focus(); });
  await pm.keyboard.press("Enter");
  await pm.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 60000 }); await sleep(500);
  const d = await pm.evaluate(() => { const el = document.querySelector('[role="dialog"]'); const h = document.getElementById(el.getAttribute("aria-labelledby"));
    return { modal: el.getAttribute("aria-modal"), label: h?.textContent?.trim() ?? null, labelTag: h?.tagName ?? null, focusInside: el === document.activeElement || el.contains(document.activeElement) }; });
  ok("detail view: role=dialog, aria-modal=true", d.modal === "true");
  ok("…labelled by its heading (the vehicle name)", d.labelTag === "H2" && /\S/.test(d.label ?? ""), JSON.stringify(d));
  ok("…focus moves into it on open", d.focusInside);
  await pm.screenshot({ path: `${SHOTS}/01-detail-dialog-open.png` });
  await pm.evaluate(() => document.querySelector('[role="dialog"] button[aria-label="Close"]').click()); await sleep(600);
  const back = await pm.evaluate(() => ({ gone: !document.querySelector('[role="dialog"]'), opener: document.activeElement?.getAttribute("data-opener") === "1" }));
  ok("…closed, and focus is back on the More info button that opened it", back.gone && back.opener, JSON.stringify(back));
} catch (e) {
  fail++; console.log("FAIL  run stopped:", e.message);
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
