// Offer entry, Chunk 11: tester sample offers written the way a sent offer is (interior, options,
// fee lines, the dealer's out-the-door), through the real startTesterSearchNow, with screenshots.
// Disposable customer (password login) and disposable agent (two-factor); the offers are sent
// by the branch's real sendOfferFor as that agent. Never Brett; everything deleted afterwards.
// Server: the offer-entry worktree's own dev server on :3400 (never Brett's :3000).
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/admin.mjs";
import { ROOT } from "../lib/paths.mjs";
const T = await import("../gen/real/tester-sample-offers.mjs");

const env = {}; for (const l of fs.readFileSync(ROOT + "/.env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const a = createAdminClient(); const BASE = "http://localhost:3400";
const SHOTS = path.join(os.homedir(), "Downloads/levr-offer-entry-chunk11-2026-10-29"); fs.mkdirSync(SHOTS, { recursive: true });
const MANIFEST = ROOT + "/.next/dev/server/server-reference-manifest.json";
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}-${crypto.randomUUID().slice(0, 6)}`, pw = `Oe11!${ts}aA`;
const NAMES = [];
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
  const custEmail = `${PFX}-customer@levrauto-test.invalid`;
  const cu = must(await a.auth.admin.createUser({ email: custEmail, email_confirm: true, password: pw }), "customer").user;
  logins.push(cu.id); customerId = cu.id;
  must(await a.from("customers").update({ first_name: "Jordan", last_name: "Verify", phone: "555-0142" }).eq("id", cu.id), "name");
  const now = new Date().toISOString();
  const sid = must(await a.from("customer_searches").insert({ customer_id: cu.id, zip: "66213", make: "Toyota", model: "Camry", model_year: 2026, trim: "SE",
    colors: ["Ice Cap", "Wind Chill Pearl"], search_status: "pending_refinement", paid_at: now, finalized_at: now, pickup_travel_choice: "distance", pickup_travel_miles: 50 }).select("id").single(), "search").id;
  searches.push(sid);
  must(await a.from("search_option_selections").insert([
    { search_id: sid, category: "exterior_color", question_kind: "ranked", selection: "Ice Cap", rank_position: 1, excluded: false, price_unknown: false },
    { search_id: sid, category: "interior", question_kind: "ranked", selection: "Black SofTex", rank_position: 1, excluded: false, price_unknown: false },
    { search_id: sid, category: "interior", question_kind: "ranked", selection: "Cockpit Red SofTex", rank_position: 2, excluded: false, price_unknown: false },
    { search_id: sid, category: "feature", question_kind: "ranked", selection: "Cold Weather Package", rank_position: 1, excluded: false, price_unknown: false },
    { search_id: sid, category: "feature", question_kind: "ranked", selection: "Moonroof", rank_position: 2, excluded: false, price_unknown: false },
  ]), "selections");

  const started = await T.startTesterSearchNow(sid, custEmail);
  ok("startTesterSearchNow started the search and logged the sample offers", started === true);
  const offers = must(await a.from("qualifying_offers").select("id, dealer_name, offer_price_cents, sent_to_customer_at, vehicle_interior_color, vehicle_model_year, good_until, otd_source, otd_total_cents, trim_match_confirmed, notes").eq("customer_search_id", sid).order("offer_price_cents"), "offers");
  ok("three offers, each marked a sample", offers.length === 3 && offers.every((o) => o.notes === T.SAMPLE_OFFER_NOTE));
  ok("each is a sent offer: interior, model year 2026, good until, trim confirmed, the dealer's out-the-door",
     offers.every((o) => o.sent_to_customer_at && o.vehicle_interior_color && o.vehicle_model_year === 2026 && o.good_until && o.trim_match_confirmed && o.otd_source === "dealer_quote"));
  const ids = offers.map((o) => o.id);
  const fees = must(await a.from("offer_fees").select("qualifying_offer_id, fee_kind, fee_amount_cents").in("qualifying_offer_id", ids), "fees");
  const addons = must(await a.from("offer_addons").select("qualifying_offer_id, amount_cents, addon_dealer_says_removable").in("qualifying_offer_id", ids), "addons");
  const sums = offers.map((o) => o.offer_price_cents + fees.filter((f) => f.qualifying_offer_id === o.id).reduce((t, f) => t + f.fee_amount_cents, 0) + addons.filter((x) => x.qualifying_offer_id === o.id).reduce((t, x) => t + x.amount_cents, 0));
  ok("doc fee, sales tax and title on each, and the out-the-door adds up exactly", fees.length === 9 && offers.every((o, i) => o.otd_total_cents === sums[i]), JSON.stringify(sums));
  ok("one removable add-on (on the higher-priced offer)", addons.length === 1 && addons[0].addon_dealer_says_removable === true);
  const opts = must(await a.from("offer_vehicle_options").select("qualifying_offer_id, vehicle_option_name, customer_asked_for, on_the_car").in("qualifying_offer_id", ids), "options");
  const perOffer = ids.map((id) => opts.filter((x) => x.qualifying_offer_id === id && x.customer_asked_for).filter((x) => x.on_the_car).length).sort();
  ok("the customer's ranked options are ticked: 2 of 2, 2 of 2, 1 of 2; one extra on the car", JSON.stringify(perOffer) === "[1,2,2]" && opts.filter((x) => !x.customer_asked_for).length === 1, JSON.stringify(perOffer));
  ok("the new-offer events say out-the-door from the dealer's quote", (await a.from("notification_events").select("event_data").eq("customer_search_id", sid).eq("event_type", "offer_logged")).data.every((e) => e.event_data.sentFlow && e.event_data.otdSource === "dealer_quote"));
  ok("running it again adds nothing", (await T.startTesterSearchNow(sid, custEmail)) === false && (await a.from("qualifying_offers").select("id", { count: "exact", head: true }).eq("customer_search_id", sid)).count === 3);

  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "oe11-")) });
  const cp = await (await browser.createBrowserContext()).newPage(); cp.setDefaultTimeout(300000); await cp.setViewport({ width: 1280, height: 900 });
  await go(cp, "/login"); await cp.type('input[name="email"]', custEmail); await cp.type('input[name="password"]', pw);
  await cp.click('button[type="submit"]'); await cp.waitForFunction(() => location.pathname !== "/login", { timeout: 240000, polling: 300 });
  await go(cp, `/account/deal?searchId=${sid}`); await waitText(cp, "Dealer's quote");
  const t1 = await bodyText(cp);
  ok("Your Deal: out-the-door lines, interior, options summary, Lowest out-the-door", t1.includes("Out-the-door: $") && t1.includes("Interior: Black SofTex") && t1.includes("Options you wanted: 2 of 2") && t1.includes("Lowest out-the-door"));
  await shot(cp, "01-your-deal-sample-offers");
  await cp.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Compare offers").click());
  await waitText(cp, "Compare your offers");
  await cp.setViewport({ width: 1280, height: 1600 }); await sleep(800); await (await cp.$('[role="dialog"]')).screenshot({ path: `${SHOTS}/02-compare-desktop.png` });
  await go(cp, `/account/deal?searchId=${sid}&offer=${offers[0].id}`); await cp.setViewport({ width: 1280, height: 900 }); await waitText(cp, "How the price adds up");
  const t2 = await cp.evaluate(() => document.querySelector('[role="dialog"]').innerText);
  ok("detail: breakdown, options, and Accept is offered (testers can accept)", t2.includes("Doc fee") && t2.includes("Sales tax") && t2.toLowerCase().includes("options on this car") && (await cp.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Accept this offer"))));
  await shotDialog(cp, "03-sample-offer-detail");
} catch (e) {
  fail++; console.log("FAIL  run stopped:", e.message);
} finally {
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
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)),
    customers: await c("customers", (q) => q.eq("id", customerId ?? "00000000-0000-0000-0000-000000000000")),
    logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
  };
  const b1 = await cnt(brett.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed; screenshots in ${SHOTS}`);
}
