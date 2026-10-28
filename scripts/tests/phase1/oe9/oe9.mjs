// Offer entry, Chunk 9: the customer's card and detail view, accept gating, and the agent's
// Record out-the-door panel, in a real browser with screenshots (desktop 1440, phone 390).
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
const SHOTS = path.join(os.homedir(), "Downloads/levr-offer-entry-chunk9-2026-10-27"); fs.mkdirSync(SHOTS, { recursive: true });
const MANIFEST = ROOT + "/.next/dev/server/server-reference-manifest.json";
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}-${crypto.randomUUID().slice(0, 6)}`, pw = `Oe9!${ts}aA`;
const NEW = "CLAUDE VERIFY OE9 SUNRISE TOYOTA", OLD = "CLAUDE VERIFY OE9 LAKESIDE TOYOTA";
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
  // Customer, search, ranked options.
  const cu = must(await a.auth.admin.createUser({ email: `${PFX}-customer@levrauto-test.invalid`, email_confirm: true, password: pw }), "customer").user;
  logins.push(cu.id); customerId = cu.id;
  must(await a.from("customers").update({ first_name: "Jordan", last_name: "Verify", phone: "555-0142" }).eq("id", cu.id), "name");
  const camry = must(await a.from("customer_searches").insert({ customer_id: cu.id, zip: "66213", make: "Toyota", model: "Camry", model_year: 2026, trim: "SE", search_status: "searching", paid_at: new Date().toISOString(), finalized_at: new Date().toISOString(), solidified_at: new Date().toISOString() }).select("id").single(), "camry").id;
  searches.push(camry);
  const optIds = must(await a.from("search_option_selections").insert([
    { search_id: camry, category: "feature", question_kind: "ranked", selection: "Cold Weather Package", rank_position: 1, excluded: false, price_unknown: false },
    { search_id: camry, category: "feature", question_kind: "ranked", selection: "Moonroof", rank_position: 2, excluded: false, price_unknown: false },
  ]).select("id, selection"), "selections");

  // Agent with two-factor.
  const email = `${PFX}-agent@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
  const L = must(await a.from("agents").insert({ email, name: "Claude Verify Agent", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(L.id);
  const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
  must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: L.id, p_auth_user_id: u.id }), "link");
  let secret; { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
    must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut(); secret = en.totp.secret; }

  // Offer A: sent through the new flow with no out-the-door figure (accept waits).
  const cold = optIds.find((o) => o.selection === "Cold Weather Package").id, moon = optIds.find((o) => o.selection === "Moonroof").id;
  const sent = await S.sendOfferFor(L.id, camry, null, {
    dealer_name: NEW, dealer_city: "Overland Park", dealer_state: "KS", dealer_zip: "66210", vin: "1HGCM82633A004352",
    vehicle_trim: "SE", vehicle_exterior_color: "Ice Cap", vehicle_interior_color: "Black SofTex", vehicle_model_year: 2026,
    offer_price_cents: 2810000, msrp_cents: 3089500, good_until: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
    note_to_customer: "They can have it detailed and ready Saturday.", delivery_estimate_status: "requested",
    addons: [{ description: "Nitrogen fill", amount_cents: 14900, customer_wanted: false, dealer_says_removable: true }], addons_none_confirmed: false,
    fees: [], other_fees_none_confirmed: true,
    options: [{ name: "Cold Weather Package", search_option_selection_id: cold, customer_asked_for: true, on_the_car: true },
              { name: "Moonroof", search_option_selection_id: moon, customer_asked_for: true, on_the_car: false },
              { name: "Mudguards", customer_asked_for: false, on_the_car: true, sticker_price_cents: 14900, install_kind: "port" }],
    trim_match_confirmed: true, tax_paid_at_registration: false, warnings_confirmed: [],
  });
  ok("setup: offer A sent through the new flow", sent.ok, JSON.stringify(sent));
  const offerA = sent.offerId;
  // Offer B: logged the old way (no sent_to_customer_at), so it must look and behave as today.
  const offerB = must(await a.from("qualifying_offers").insert({ customer_search_id: camry, dealer_name: OLD, offer_price_cents: 2890000, msrp_cents: 3089500, logged_by_agent_id: L.id }).select("id").single(), "offer B").id;

  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "oe9-")) });
  const cp = await (await browser.createBrowserContext()).newPage(); cp.setDefaultTimeout(300000); await cp.setViewport({ width: 1440, height: 900 });
  const ap = await (await browser.createBrowserContext()).newPage(); ap.setDefaultTimeout(300000); await ap.setViewport({ width: 1440, height: 900 });

  // Customer signs in.
  await go(cp, "/login"); await cp.type('input[name="email"]', `${PFX}-customer@levrauto-test.invalid`); await cp.type('input[name="password"]', pw);
  await cp.click('button[type="submit"]'); await cp.waitForFunction(() => location.pathname !== "/login", { timeout: 240000, polling: 300 });

  // 1. Cards.
  await go(cp, `/account/deal?searchId=${camry}`);
  await waitText(cp, NEW);
  const t1 = await bodyText(cp);
  ok("card A: interior, out-the-door requested, good until, options summary, LEVRating chip",
     t1.includes("Interior: Black SofTex") && t1.includes("Out-the-door quote requested") && /Good until [A-Z][a-z]{2} \d+/.test(t1)
     && t1.includes("Options you wanted: 1 of 2") && t1.includes("New to LEVR — no rating yet") && t1.includes("Negotiated price for the car."));
  ok("card B (old offer): the original price line, no out-the-door line",
     t1.includes("Excludes tax, title, registration, doc fee and add-ons.") );
  await shot(cp, "01-your-deal-cards");

  // 2. Detail A: breakdown, options, note, accept blocked.
  await go(cp, `/account/deal?searchId=${camry}&offer=${offerA}`);
  await waitText(cp, "How the price adds up");
  const t2 = await bodyText(cp);
  const want2 = ["Window sticker", "Car price", "Dealer add-ons", "Options on this car", "✓ On the car", "✗ Not on this car",
    "Also on this car", "Mudguards", "A note from your agent", "They can have it detailed and ready Saturday."];
  // Section headings are capitalised by CSS, so innerText reads them in upper case.
  const missing2 = want2.filter((w) => !t2.toLowerCase().includes(w.toLowerCase()));
  ok("detail A: breakdown, options with ✓/✗ and extras, the agent's note", missing2.length === 0, missing2.join(" | "));
  ok("detail A: accept blocked with the approved line, no Accept button",
     t2.includes("Out-the-door quote requested — you can accept once it arrives.") && !(await cp.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Accept this offer"))));
  await shotDialog(cp, "02-detail-accept-blocked");

  // 3. The server refuses an accept too (a stale tab or crafted request).
  const ids = actionIds(); const respondId = ids["offer-response-actions.respondToOffer"];
  const raw = await cp.evaluate(async (id, offer) => (await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify([offer, "accepted", "pickup"]) })).text(), respondId, offerA);
  const statusA1 = (await a.from("qualifying_offers").select("status").eq("id", offerA).single()).data.status;
  ok("respondToOffer refuses the accept on the server", raw.includes("you can accept once it arrives") && statusA1 === "pending", `${statusA1}`);

  // 4. Agent records the dealer's out-the-door quote.
  await sleep(31000);
  await go(ap, "/agent"); await ap.type('input[name="email"]', email); await ap.type('input[name="password"]', pw);
  await ap.click('form:has(input[name="password"]) button[type="submit"]'); await ap.waitForSelector('input[name="code"]'); await ap.type('input[name="code"]', totp(secret));
  await ap.click('form:has(input[name="code"]) button[type="submit"]'); await ap.waitForFunction(() => location.pathname !== "/agent", { timeout: 240000, polling: 300 });
  await go(ap, "/internal/outreach");
  await waitText(ap, "Waiting for the dealer's out-the-door quote.");
  await ap.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Record out-the-door"); b.scrollIntoView(); b.click(); });
  await sleep(500);
  const fillIn = async (labelText, v) => { await ap.evaluate((t) => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.trim().startsWith(t) && x.querySelector("input")); l.querySelector("input").focus(); }, labelText); await ap.keyboard.type(v); };
  await fillIn("Doc fee", "399"); await fillIn("Sales tax", "1850"); await fillIn("Title & registration", "244");
  await ap.evaluate(() => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === "No other fees" && x.closest(".border-amber-500\\/30")); (l ?? [...document.querySelectorAll("label")].filter((x) => x.textContent.trim() === "No other fees").at(-1)).querySelector("input").click(); });
  // First a wrong total, to see the mismatch line.
  await ap.focus('input[aria-label="Out-the-door total (dealer\'s quote)"]'); await ap.keyboard.type("30000");
  await waitText(ap, "Check for a missing or extra line.");
  const panel = async () => ap.evaluateHandle(() => document.querySelector(".border-amber-500\\/30"));
  const shotPanel = async (name) => { for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) { await ap.setViewport({ width: w, height: h }); await sleep(800); const el = (await panel()).asElement(); await (el ? el.screenshot({ path: `${SHOTS}/${name}-${tag}.png` }) : ap.screenshot({ path: `${SHOTS}/${name}-${tag}.png` })); } await ap.setViewport({ width: 1440, height: 900 }); await sleep(300); };
  await shotPanel("03-agent-record-otd-mismatch");
  await ap.click('input[aria-label="Out-the-door total (dealer\'s quote)"]', { clickCount: 3 }); await ap.keyboard.type("30642");
  await sleep(400);
  ok("the panel adds the lines up: $28,100 + $149 + $399 + $1,850 + $244 = $30,742", (await bodyText(ap)).includes("Your lines add up to $30,742"));
  await ap.click('input[aria-label="Out-the-door total (dealer\'s quote)"]', { clickCount: 3 }); await ap.keyboard.type("30742");
  await ap.evaluate(() => { const b = [...document.querySelectorAll(".border-amber-500\\/30 button")].find((x) => x.textContent.trim() === "Record out-the-door"); b.click(); });
  await waitText(ap, "Out-the-door recorded. Jordan can now accept this offer.");
  await shotPanel("04-agent-otd-recorded");
  const qa = (await a.from("qualifying_offers").select("otd_source, otd_total_cents, otd_recorded_by_agent_id").eq("id", offerA).single()).data;
  ok("recorded: the dealer's quote, by the agent", qa.otd_source === "dealer_quote" && qa.otd_total_cents === 3074200 && qa.otd_recorded_by_agent_id === L.id);
  const ev = (await a.from("notification_events").select("id", { count: "exact", head: true }).eq("customer_search_id", camry).eq("event_type", "otd_recorded")).count;
  ok("the out-the-door email was logged for the customer", ev === 1, String(ev));
  const act = (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("qualifying_offer_id", offerA).eq("action", "offer_otd_recorded")).count;
  ok("activity: offer_otd_recorded", act === 1);

  // 5. Customer: accept is unblocked, with the out-the-door price above the explanation.
  await go(cp, `/account/deal?searchId=${camry}`);
  await waitText(cp, "Out-the-door: $30,742 · Dealer's quote");
  ok("card A now shows the dealer's out-the-door quote", true);
  await shot(cp, "05-your-deal-otd-recorded");
  await go(cp, `/account/deal?searchId=${camry}&offer=${offerA}`);
  await waitText(cp, "Your out-the-door price");
  const t5 = await bodyText(cp);
  ok("detail A: breakdown ends at Out-the-door $30,742, accept shown under \"Your out-the-door price\"",
     t5.includes("Out-the-door") && t5.includes("$30,742") && (await cp.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Accept this offer"))));
  await shotDialog(cp, "06-detail-accept-ready");
  await cp.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.textContent.trim() === "I'd pick it up"); b?.click(); });
  await sleep(500);
  await cp.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Accept this offer"); b.click(); });
  await cp.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 120000, polling: 300 }).catch(() => {});
  await sleep(1500);
  const statusA2 = (await a.from("qualifying_offers").select("status").eq("id", offerA).single()).data.status;
  ok("the customer can accept once the quote is in", statusA2 === "customer_accepted", statusA2);

  // 6. Old offer B still opens with the old price block and no gating line.
  await go(cp, `/account/deal?searchId=${camry}&offer=${offerB}`);
  await waitText(cp, OLD);
  const t6 = await cp.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? "");
  ok("old offer: no breakdown, no options section, no out-the-door gating", !t6.includes("How the price adds up") && !t6.includes("Options on this car") && !t6.includes("you can accept once it arrives"));
  await shotDialog(cp, "07-old-offer-detail");
} catch (e) {
  fail++; console.log("FAIL  run stopped:", e.message);
} finally {
  await browser?.close().catch(() => {});
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  await del("agent_activity_log", "agent_id", agentIds); await del("agent_activity_log", "search_id", searches);
  await del("notification_events", "customer_search_id", searches); await del("agent_alerts", "search_id", searches); await del("search_assignments", "search_id", searches);
  await del("deal_progress", "qualifying_offer_id", (await a.from("qualifying_offers").select("id").in("customer_search_id", searches.length ? searches : ["00000000-0000-0000-0000-000000000000"])).data?.map((o) => o.id) ?? []);
  await del("customer_searches", "id", searches);
  await a.from("dealer_aliases").delete().in("dealer_name", [NEW, OLD]);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = {
    searches: await c("customer_searches", (q) => q.in("id", searches.length ? searches : ["00000000-0000-0000-0000-000000000000"])),
    offers: await c("qualifying_offers", (q) => q.in("dealer_name", [NEW, OLD])),
    aliases: await c("dealer_aliases", (q) => q.in("dealer_name", [NEW, OLD])),
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)),
    customers: await c("customers", (q) => q.eq("id", customerId ?? "00000000-0000-0000-0000-000000000000")),
    logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
  };
  const b1 = await cnt(brett.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed; screenshots in ${SHOTS}`);
}
