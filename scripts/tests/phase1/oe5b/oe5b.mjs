// OE-5b: withdrawing a pending offer with a reason, releasing an accepted one with the same
// reason choice, the customer's card line, and the Day-30 guarantee for withdrawn offers.
// Disposable customer (password login) and disposable agent (two-factor); the offers are sent
// by the branch's real sendOfferFor as that agent. Never Brett; everything deleted afterwards.
// Server: the offer-entry worktree's own dev server on :3400 (never Brett's :3000).
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/admin.mjs";
import { ROOT } from "../lib/paths.mjs";
const S = await import("../gen/real/offer-submission.mjs");
const GA = await import("../gen/real/guarantee-assessment.mjs");

const env = {}; for (const l of fs.readFileSync(ROOT + "/.env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const a = createAdminClient(); const BASE = "http://localhost:3400";
const SHOTS = path.join(os.homedir(), "Downloads/levr-offer-entry-oe5b-withdraw-2026-10-28"); fs.mkdirSync(SHOTS, { recursive: true });
const MANIFEST = ROOT + "/.next/dev/server/server-reference-manifest.json";
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}-${crypto.randomUUID().slice(0, 6)}`, pw = `Oe5b!${ts}aA`;
const D = (n) => `CLAUDE VERIFY OE5B ${n} TOYOTA`; const NAMES = ["PENDING", "ACCEPTED", "OTHERS", "CORRECT", "SOLD", "SOLDLATE", "REFUSE"].map(D);
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

const day = 864e5, iso = (ms) => new Date(ms).toISOString();
async function newSearch(extra = {}) {
  const id = must(await a.from("customer_searches").insert({ customer_id: customerId, zip: "66213", make: "Toyota", model: "Camry", model_year: 2026, trim: "SE",
    search_status: "searching", paid_at: iso(Date.now() - 32 * day), finalized_at: iso(Date.now() - 32 * day), solidified_at: iso(Date.now() - 31 * day), ...extra }).select("id").single(), "search").id;
  searches.push(id); return id;
}
async function newOffer(searchId, dealer, extra = {}) {
  return must(await a.from("qualifying_offers").insert({ customer_search_id: searchId, dealer_name: dealer, offer_price_cents: 2810000, msrp_cents: 3089500,
    delivered_at: iso(Date.now() - 2 * day), logged_by_agent_id: agentIds[0], ...extra }).select("id").single(), "offer").id;
}
const row = async (id) => (await a.from("qualifying_offers").select("status, withdrawal_reason_code, withdrawal_reason, vehicle_sold_at, withdrawn_by_agent_id").eq("id", id).single()).data;
const gstatus = async (id) => (await a.from("customer_searches").select("guarantee_status").eq("id", id).single()).data.guarantee_status;

try {
  const cu = must(await a.auth.admin.createUser({ email: `${PFX}-customer@levrauto-test.invalid`, email_confirm: true, password: pw }), "customer").user;
  logins.push(cu.id); customerId = cu.id;
  must(await a.from("customers").update({ first_name: "Jordan", last_name: "Verify", phone: "555-0142" }).eq("id", cu.id), "name");
  const email = `${PFX}-agent@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
  const L = must(await a.from("agents").insert({ email, name: "Claude Verify Agent", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(L.id);
  const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
  must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: L.id, p_auth_user_id: u.id }), "link");
  let secret; { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
    must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut(); secret = en.totp.secret; }

  // 1. Server refusals (withdrawPendingOfferFor, the branch's real code).
  const sR = await newSearch(); const oR = await newOffer(sR, D("REFUSE"));
  const oAcc = await newOffer(sR, D("OTHERS"), { status: "customer_accepted", customer_responded_at: iso(Date.now() - day) });
  const r1 = await S.withdrawPendingOfferFor(L.id, oR, "", null);
  const r2 = await S.withdrawPendingOfferFor(L.id, oR, "other", "  ");
  const r3 = await S.withdrawPendingOfferFor(L.id, oR, "made_up", null);
  const r4 = await S.withdrawPendingOfferFor(L.id, oAcc, "correcting", null);
  ok("refusals: no reason, Other without a note, an unknown reason, an accepted offer",
     r1.code === "reason_missing" && r2.code === "note_required" && r3.code === "reason_code_invalid" && r4.code === "offer_not_pending",
     [r1.code, r2.code, r3.code, r4.code].join(","));
  ok("after the refusals the offer is still pending", (await row(oR)).status === "pending");

  // 2. Day-30 on real data (plan 3.3c step 4).
  const sC = await newSearch(); const oC = await newOffer(sC, D("CORRECT"));
  const w1 = await S.withdrawPendingOfferFor(L.id, oC, "correcting", null);
  const rc = await row(oC);
  ok("\"Correcting the offer\": withdrawn, code and label stored, not marked sold", w1.ok && rc.status === "withdrawn" && rc.withdrawal_reason_code === "correcting" && rc.withdrawal_reason === "Correcting the offer" && !rc.vehicle_sold_at, JSON.stringify(rc));
  ok("the customer is told: offer_withdrawn with wasPending", (await a.from("notification_events").select("event_data").eq("customer_search_id", sC).eq("event_type", "offer_withdrawn")).data?.[0]?.event_data?.wasPending === true);
  ok("activity: offer_withdrawn_pending", (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("qualifying_offer_id", oC).eq("action", "offer_withdrawn_pending")).count === 1);
  await GA.assessSearch(sC);
  ok("Day-30: a search whose only offer was withdrawn to correct it is refunded", (await gstatus(sC)) === "refunded");

  const sS = await newSearch(); const oS = await newOffer(sS, D("SOLD"), { delivered_at: iso(Date.now() - 3 * day) });
  await S.withdrawPendingOfferFor(L.id, oS, "car_sold", "Sold to a walk-in");
  const rs = await row(oS);
  ok("\"Car sold\": note kept, vehicle_sold_at set", rs.withdrawal_reason_code === "car_sold" && rs.withdrawal_reason === "Sold to a walk-in" && !!rs.vehicle_sold_at);
  await GA.assessSearch(sS);
  ok("Day-30: car sold, the customer never responded: met", (await gstatus(sS)) === "met");

  // 3. Browser: the agent withdraws a pending offer and releases an accepted one, by the reason choice.
  const sP = await newSearch({ solidified_at: iso(Date.now() - day), paid_at: iso(Date.now() - 2 * day), finalized_at: iso(Date.now() - 2 * day) });
  const oP = await newOffer(sP, D("PENDING"));
  const oA = await newOffer(sP, D("ACCEPTED"), { delivered_at: iso(Date.now() - 3 * day), status: "customer_accepted", customer_responded_at: iso(Date.now() - 3 * day + 2 * 3600e3) });
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "oe5b-")) });
  const cp = await (await browser.createBrowserContext()).newPage(); cp.setDefaultTimeout(300000); await cp.setViewport({ width: 1440, height: 900 });
  const ap = await (await browser.createBrowserContext()).newPage(); ap.setDefaultTimeout(300000); await ap.setViewport({ width: 1440, height: 900 });
  await go(ap, "/agent"); await ap.type('input[name="email"]', email); await ap.type('input[name="password"]', pw);
  await ap.click('form:has(input[name="password"]) button[type="submit"]'); await ap.waitForSelector('input[name="code"]'); await ap.type('input[name="code"]', totp(secret));
  await ap.click('form:has(input[name="code"]) button[type="submit"]'); await ap.waitForFunction(() => location.pathname !== "/agent", { timeout: 240000, polling: 300 });
  await go(ap, "/internal/outreach"); await waitText(ap, D("PENDING"));
  // The offer's own block: the smallest element holding the dealer name and the given button.
  const block = (dealer, btn) => ap.evaluateHandle((d, b) => {
    const els = [...document.querySelectorAll("li, div")].filter((e) => e.innerText.includes(d) && [...e.querySelectorAll("button")].some((x) => x.textContent.trim() === b));
    return els.sort((x, y) => x.innerText.length - y.innerText.length)[0] ?? null; }, dealer, btn);
  const click = (dealer, btn, label) => ap.evaluate((d, b, l) => {
    const els = [...document.querySelectorAll("li, div")].filter((e) => e.innerText.includes(d) && [...e.querySelectorAll("button")].some((x) => x.textContent.trim() === b));
    const el = els.sort((x, y) => x.innerText.length - y.innerText.length)[0]; const x = [...el.querySelectorAll("button")].find((q) => q.textContent.trim() === (l ?? b)); x.scrollIntoView(); x.click(); }, dealer, btn, label);
  const shotBlock = async (dealer, btn, name) => { for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) { await ap.setViewport({ width: w, height: h }); await sleep(800);
    const el = (await block(dealer, btn)).asElement(); await (el ? el.screenshot({ path: `${SHOTS}/${name}-${tag}.png` }) : ap.screenshot({ path: `${SHOTS}/${name}-${tag}.png` })); } await ap.setViewport({ width: 1440, height: 900 }); await sleep(300); };
  const setReason = (prefix, code) => ap.evaluate((p, c) => { const s = document.getElementById(`${p}-reason`); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(s, c); s.dispatchEvent(new Event("change", { bubbles: true })); }, prefix, code);

  await click(D("PENDING"), "Withdraw this offer"); await waitText(ap, "Why are you withdrawing this offer? The customer won't see your reason.");
  await shotBlock(D("PENDING"), "Withdraw it", "01-agent-withdraw-form");
  await click(D("PENDING"), "Withdraw it"); await waitText(ap, "Choose a reason.");
  await setReason(`withdraw-${oP}`, "other"); await click(D("PENDING"), "Withdraw it"); await waitText(ap, 'Add a note for "Other".');
  ok("the form refuses no reason, then Other without a note", true);
  await shotBlock(D("PENDING"), "Withdraw it", "02-agent-withdraw-other-needs-note");
  await setReason(`withdraw-${oP}`, "dealer_pulled"); await click(D("PENDING"), "Withdraw it");
  await waitText(ap, "Offer withdrawn. Jordan has been told.");
  const rp = await row(oP);
  ok("withdrawn through the form: Dealer pulled the quote, by the agent", rp.status === "withdrawn" && rp.withdrawal_reason_code === "dealer_pulled" && rp.withdrawn_by_agent_id === L.id, JSON.stringify(rp));
  await shot(ap, "03-agent-withdrawn");

  await go(ap, "/internal/outreach"); await waitText(ap, "Release this accepted offer");
  await click(D("ACCEPTED"), "Release this accepted offer"); await waitText(ap, "Confirm release");
  await setReason(`release-${oA}`, "car_sold");
  await shotBlock(D("ACCEPTED"), "Confirm release", "04-agent-release-reason");
  await click(D("ACCEPTED"), "Confirm release"); await waitText(ap, "Offer released");
  const ra = await row(oA);
  ok("released with \"Car sold\": code stored, vehicle_sold_at set", ra.status === "withdrawn" && ra.withdrawal_reason_code === "car_sold" && ra.withdrawal_reason === "Car sold" && !!ra.vehicle_sold_at, JSON.stringify(ra));
  ok("release activity carries the reason code", (await a.from("agent_activity_log").select("details").eq("qualifying_offer_id", oA).eq("action", "offer_released")).data?.[0]?.details?.reason_code === "car_sold");
  await GA.assessSearch(sP);
  ok("Day-30: car sold after the customer accepted within 24h: refunded (the sold rule)", (await gstatus(sP)) === "refunded");

  // 4. The customer's cards.
  await go(cp, "/login"); await cp.type('input[name="email"]', `${PFX}-customer@levrauto-test.invalid`); await cp.type('input[name="password"]', pw);
  await cp.click('button[type="submit"]'); await cp.waitForFunction(() => location.pathname !== "/login", { timeout: 240000, polling: 300 });
  await go(cp, `/account/deal?searchId=${sP}`); await waitText(cp, D("PENDING"));
  const n = (await bodyText(cp)).split("No longer available · withdrawn").length - 1;
  ok("customer: both withdrawn offers read \"No longer available · withdrawn {date}\"", n === 2, String(n));
  await shot(cp, "05-customer-withdrawn-cards");
} catch (e) {
  fail++; console.log("FAIL  run stopped:", e.message);
} finally {
  await browser?.close().catch(() => {});
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  await del("agent_activity_log", "agent_id", agentIds); await del("agent_activity_log", "search_id", searches);
  await del("notification_events", "customer_search_id", searches); await del("agent_alerts", "search_id", searches); await del("search_assignments", "search_id", searches);
  await del("deal_progress", "qualifying_offer_id", (await a.from("qualifying_offers").select("id").in("customer_search_id", searches.length ? searches : ["00000000-0000-0000-0000-000000000000"])).data?.map((o) => o.id) ?? []);
  await del("customer_searches", "id", searches);
  await a.from("dealer_aliases").delete().in("dealer_name", NAMES);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = {
    searches: await c("customer_searches", (q) => q.in("id", searches.length ? searches : ["00000000-0000-0000-0000-000000000000"])),
    offers: await c("qualifying_offers", (q) => q.in("dealer_name", NAMES)),
    aliases: await c("dealer_aliases", (q) => q.in("dealer_name", NAMES)),
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)),
    customers: await c("customers", (q) => q.eq("id", customerId ?? "00000000-0000-0000-0000-000000000000")),
    logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
  };
  const b1 = await cnt(brett.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed; screenshots in ${SHOTS}`);
}
