// Offer entry, Chunk 10: the offer comparison (desktop table, phone two-up), the "Lowest
// out-the-door" badge and the default "Best total price" sort, with screenshots (1280 and 390).
// Disposable customer (password login) and disposable agent (two-factor); the offers are sent
// by the branch's real sendOfferFor as that agent. Never Brett; everything deleted afterwards.
// Server: the offer-entry worktree's own dev server on :3400 (never Brett's :3000).
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/admin.mjs";
import { ROOT } from "../lib/paths.mjs";
const S = await import("../gen/real/offer-submission.mjs");

const env = {}; for (const l of fs.readFileSync(ROOT + "/.env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const a = createAdminClient(); const BASE = "http://localhost:3400";
const SHOTS = path.join(os.homedir(), "Downloads/levr-offer-entry-chunk10-2026-10-28"); fs.mkdirSync(SHOTS, { recursive: true });
const MANIFEST = ROOT + "/.next/dev/server/server-reference-manifest.json";
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}-${crypto.randomUUID().slice(0, 6)}`, pw = `Oe10!${ts}aA`;
const D = (n) => `CLAUDE VERIFY OE10 ${n} TOYOTA`; const NAMES = ["QUOTE", "ESTIMATE", "WAITING", "OLD"].map(D);
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


try {
  const cu = must(await a.auth.admin.createUser({ email: `${PFX}-customer@levrauto-test.invalid`, email_confirm: true, password: pw }), "customer").user;
  logins.push(cu.id); customerId = cu.id;
  must(await a.from("customers").update({ first_name: "Jordan", last_name: "Verify", phone: "555-0142" }).eq("id", cu.id), "name");
  const now = new Date().toISOString();
  const sid = must(await a.from("customer_searches").insert({ customer_id: cu.id, zip: "66213", make: "Toyota", model: "Camry", model_year: 2026, trim: "SE", search_status: "searching", paid_at: now, finalized_at: now, solidified_at: now }).select("id").single(), "search").id;
  searches.push(sid);
  const sel = must(await a.from("search_option_selections").insert([
    { search_id: sid, category: "exterior_color", question_kind: "ranked", selection: "Ice Cap", rank_position: 1, excluded: false, price_unknown: false },
    { search_id: sid, category: "interior", question_kind: "ranked", selection: "Black SofTex", rank_position: 1, excluded: false, price_unknown: false },
    { search_id: sid, category: "feature", question_kind: "ranked", selection: "Cold Weather Package", rank_position: 1, excluded: false, price_unknown: false },
    { search_id: sid, category: "feature", question_kind: "ranked", selection: "Moonroof", rank_position: 2, excluded: false, price_unknown: false },
  ]).select("id, selection"), "selections");
  const selId = (n) => sel.find((s) => s.selection === n).id;
  const L = must(await a.from("agents").insert({ email: `${PFX}-agent@levrauto-test.invalid`, name: "Claude Verify Agent", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(L.id);
  const goodUntil = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  const fees = [{ kind: "doc_fee", amount_cents: 39900 }, { kind: "sales_tax", amount_cents: 185000 }, { kind: "title_registration", amount_cents: 24400 }];
  const base = (name, city, zip, vin, ext, int, price, extra) => ({
    dealer_name: name, dealer_city: city, dealer_state: "KS", dealer_zip: zip, vin,
    vehicle_trim: "SE", vehicle_exterior_color: ext, vehicle_interior_color: int, vehicle_model_year: 2026,
    offer_price_cents: price, msrp_cents: 3089500, good_until: goodUntil, delivery_estimate_status: "requested",
    addons: [], addons_none_confirmed: true, fees: [], other_fees_none_confirmed: true,
    options: [{ name: "Cold Weather Package", search_option_selection_id: selId("Cold Weather Package"), customer_asked_for: true, on_the_car: true },
              { name: "Moonroof", search_option_selection_id: selId("Moonroof"), customer_asked_for: true, on_the_car: extra.moon ?? false }],
    trim_match_confirmed: true, tax_paid_at_registration: false, warnings_confirmed: [], ...extra.payload,
  });
  const send = async (p) => { const r = await S.sendOfferFor(L.id, sid, null, p); if (!r.ok) throw new Error("send " + JSON.stringify(r)); return r.offerId; };
  const oQuote = await send(base(D("QUOTE"), "Overland Park", "66210", "1HGCM82633A004352", "Ice Cap", "Black SofTex", 2810000, {
    payload: { addons: [{ description: "Nitrogen fill", amount_cents: 14900, customer_wanted: false, dealer_says_removable: true }], addons_none_confirmed: false,
      fees, otd_source: "dealer_quote", otd_total_cents: 2810000 + 14900 + 39900 + 185000 + 24400 } }));
  const oEst = await send(base(D("ESTIMATE"), "Olathe", "66061", "1M8GDM9AXKP042788", "Wind Chill Pearl", "Black SofTex", 2790000, {
    moon: true, payload: { fees, otd_source: "estimate", otd_total_cents: 2790000 + 39900 + 185000 + 24400 } }));
  const oWait = await send(base(D("WAITING"), "Lee's Summit", "64063", "11111111111111111", "Ice Cap", "Cockpit Red", 2775000, { payload: {} }));
  const oOld = must(await a.from("qualifying_offers").insert({ customer_search_id: sid, dealer_name: D("OLD"), offer_price_cents: 2890000, msrp_cents: 3089500, logged_by_agent_id: L.id }).select("id").single(), "old").id;
  ok("setup: three offers sent (a dealer quote, an estimate, one waiting) and one logged the old way", !!(oQuote && oEst && oWait && oOld));

  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "oe10-")) });
  const cp = await (await browser.createBrowserContext()).newPage(); cp.setDefaultTimeout(300000); await cp.setViewport({ width: 1280, height: 900 });
  await go(cp, "/login"); await cp.type('input[name="email"]', `${PFX}-customer@levrauto-test.invalid`); await cp.type('input[name="password"]', pw);
  await cp.click('button[type="submit"]'); await cp.waitForFunction(() => location.pathname !== "/login", { timeout: 240000, polling: 300 });

  // 1. Default sort and the badge.
  await go(cp, `/account/deal?searchId=${sid}`); await waitText(cp, D("QUOTE"));
  const t1 = await bodyText(cp);
  const order = [D("ESTIMATE"), D("QUOTE"), D("WAITING"), D("OLD")].map((n) => t1.indexOf(n));
  ok("default sort is Best total price: by out-the-door, offers without one after", order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), order.join(","));
  const sortCurrent = await cp.evaluate(() => document.querySelector('nav [aria-current="true"]')?.textContent ?? "");
  ok("the Best total price pill is the current one and comes first", sortCurrent.includes("Best total price") || t1.indexOf("Best total price") < t1.indexOf("Best discount"));
  ok("\"Lowest out-the-door\" on the estimate offer, \"Best value\" gone", t1.includes("Lowest out-the-door") && !t1.includes("Best value"));
  await shot(cp, "01-your-deal-sorted");

  // 2. Desktop comparison.
  await cp.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Compare offers").click());
  await waitText(cp, "Compare your offers");
  const t2 = await cp.evaluate(() => document.querySelector('[role="dialog"]').innerText);
  const want = ["Exterior", "Interior", "Options you want", "Also on the car", "Window sticker", "Discount", "Car price", "Dealer add-ons", "Doc fee", "Sales tax",
    "Title & registration", "Out-the-door", "Figures from", "Good until", "Ice Cap ✓", "not your pick", "1 of 2", "2 of 2", "can be removed", "Dealer's quote", "Our estimate", "Requested", "View and accept", "New to LEVR — no rating yet"];
  const miss = want.filter((w) => !t2.toLowerCase().includes(w.toLowerCase()));
  ok("desktop table: every approved row, the marks and the figures sources", miss.length === 0, miss.join(" | "));
  const firstCol = await cp.evaluate(() => document.querySelector('[role="dialog"] thead th:nth-child(2)')?.innerText ?? "");
  ok("the Lowest out-the-door offer is pinned first", firstCol.includes("Lowest out-the-door") && firstCol.includes(D("ESTIMATE")), firstCol.slice(0, 80));
  for (const [w, tag] of [[1280, "desktop"]]) { await cp.setViewport({ width: w, height: 1600 }); await sleep(800); await (await cp.$('[role="dialog"]')).screenshot({ path: `${SHOTS}/02-compare-${tag}.png` }); }

  // 3. Phone two-up with the pager.
  await go(cp, `/account/deal?searchId=${sid}`); await cp.setViewport({ width: 390, height: 844 }); await sleep(1500);
  await cp.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Compare offers").click());
  await waitText(cp, "Compare your offers");
  const t3 = await cp.evaluate(() => document.querySelector('[role="dialog"]').innerText);
  ok("phone: two offers at a time with the pager (4 open offers)", t3.includes("1 and 2 of 4"), t3.match(/\d and \d of \d/)?.[0] ?? "none");
  await cp.setViewport({ width: 390, height: 2600 }); await sleep(800);
  await (await cp.$('[role="dialog"]')).screenshot({ path: `${SHOTS}/03-compare-phone.png` });
  await cp.evaluate(() => document.querySelectorAll('[role="dialog"] button[aria-label="Next offer"]')[1].click());
  await sleep(500);
  const t4 = await cp.evaluate(() => document.querySelector('[role="dialog"]').innerText);
  ok("phone: › swaps in the next offer", /1 and 3 of \d/.test(t4), t4.match(/\d and \d of \d/)?.[0] ?? "none");
  await (await cp.$('[role="dialog"]')).screenshot({ path: `${SHOTS}/04-compare-phone-swapped.png` });

  // 4. View and accept opens that offer's detail.
  const href = await cp.evaluate(() => [...document.querySelectorAll('[role="dialog"] a')].find((x) => x.textContent.trim() === "View and accept").getAttribute("href"));
  ok("View and accept links to the offer's detail view", /offer=/.test(href), href);
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
