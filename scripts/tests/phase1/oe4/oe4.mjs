// Offer entry, Chunk 4: the Log Offer page, end to end in a real browser, with screenshots
// (desktop 1440 and phone 390). Disposable agent (role agent, two-factor) signed in through
// /agent; one disposable customer with a Toyota Camry search (ranked trim, colours, options)
// and a Tesla Model 3 search (order-fee prefill). Never Brett; everything deleted afterwards.
// Server: the offer-entry worktree's own dev server on :3400 (never Brett's :3000).
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/admin.mjs";
import { ROOT } from "../lib/paths.mjs";

const env = {}; for (const l of fs.readFileSync(ROOT + "/.env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const a = createAdminClient(); const BASE = "http://localhost:3400";
const SHOTS = path.join(os.homedir(), "Downloads/levr-offer-entry-chunk4-2026-10-27"); fs.mkdirSync(SHOTS, { recursive: true });
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}-${crypto.randomUUID().slice(0, 6)}`, pw = `Oe4!${ts}aA`;
const DEALER = "CLAUDE VERIFY OE4 TOYOTA";
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }

const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id);
const logins = [], searches = [], agentIds = [];
let browser, customerId = null;

async function shot(p, name) {
  for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
    await p.setViewport({ width: w, height: h }); await sleep(700);
    await p.screenshot({ path: `${SHOTS}/${name}-${tag}.png`, fullPage: true });
  }
  await p.setViewport({ width: 1440, height: 900 }); await sleep(300);
}
const typeInto = async (p, selector, text) => { const el = await p.$(selector); await el.click({ clickCount: 3 }); await el.type(text); };
const byLabel = (p, labelText) => p.evaluateHandle((t) => {
  const lab = [...document.querySelectorAll("label")].find((x) => x.textContent.trim().startsWith(t));
  const next = lab?.nextElementSibling;
  if (next && ["INPUT", "TEXTAREA", "SELECT"].includes(next.tagName)) return next;
  return lab?.parentElement?.querySelector("input, textarea, select") ?? null;
}, labelText);
async function fill(p, labelText, text) { const h = await byLabel(p, labelText); const el = h.asElement(); if (!el) throw new Error(`no field for ${labelText}`); await el.click({ clickCount: 3 }); await el.type(text); }
async function clickText(p, text, nth = 0) {
  const done = await p.evaluate((t, n) => { const bs = [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === t); if (!bs[n] || bs[n].disabled) return false; bs[n].click(); return true; }, text, nth);
  if (!done) throw new Error(`no enabled "${text}" button`);
}
const bodyText = (p) => p.evaluate(() => document.body.innerText);
const waitText = (p, t, ms = 90000) => p.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms, polling: 300 }, t);

try {
  // Customer and searches.
  const cu = must(await a.auth.admin.createUser({ email: `${PFX}-customer@levrauto-test.invalid`, email_confirm: true }), "customer").user;
  logins.push(cu.id); customerId = cu.id;
  must(await a.from("customers").update({ first_name: "Jordan", last_name: "Verify" }).eq("id", cu.id), "name");
  const camry = must(await a.from("customer_searches").insert({ customer_id: cu.id, zip: "66213", make: "Toyota", model: "Camry", model_year: 2026, trim: "SE", search_status: "searching", paid_at: new Date().toISOString() }).select("id").single(), "camry").id;
  const tesla = must(await a.from("customer_searches").insert({ customer_id: cu.id, zip: "66213", make: "Tesla", model: "Model 3", model_year: 2026, search_status: "searching", paid_at: new Date().toISOString() }).select("id").single(), "tesla").id;
  searches.push(camry, tesla);
  must(await a.from("search_trim_preferences").insert([{ search_id: camry, trim: "SE", model_year: 2026, rank_position: 1, excluded: false }, { search_id: camry, trim: "XSE", model_year: 2026, rank_position: 2, excluded: false }]), "trims");
  const sel = (category, selection, rank, extra = {}) => ({ search_id: camry, category, question_kind: "ranked", selection, rank_position: rank, excluded: false, price_unknown: false, ...extra });
  must(await a.from("search_option_selections").insert([
    sel("exterior_color", "Ice Cap", 1), sel("exterior_color", "Underground", 2),
    sel("interior", "Black SofTex", 1),
    sel("feature", "Cold Weather Package", 1, { package_name: "Cold Weather Package", package_price_cents: 61000, package_contents: ["Heated front seats", "Heated steering wheel"] }),
    sel("feature", "Moonroof", 2),
  ]), "selections");

  // Agent with two-factor.
  const email = `${PFX}-agent@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
  const L = must(await a.from("agents").insert({ email, name: "Claude Verify Agent", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(L.id);
  must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: L.id, p_auth_user_id: u.id }), "link");
  let secret; { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
    must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut(); secret = en.totp.secret; }
  await sleep(31000);
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "oe4-")) });
  const p = await (await browser.createBrowserContext()).newPage(); p.setDefaultTimeout(300000); await p.setViewport({ width: 1440, height: 900 });
  const go = async (url) => { await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 180000 }).catch(() => {});
    await p.waitForFunction(() => { const b = document.querySelector("main button"); return !b || Object.keys(b).some((k) => k.startsWith("__reactProps")); }, { timeout: 120000, polling: 300 }).catch(() => {}); };
  await go("/agent"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await p.click('form:has(input[name="password"]) button[type="submit"]'); await p.waitForSelector('input[name="code"]'); await p.type('input[name="code"]', totp(secret));
  await p.click('form:has(input[name="code"]) button[type="submit"]'); await p.waitForFunction(() => location.pathname !== "/agent", { timeout: 240000, polling: 300 });

  // The search card's button.
  await go("/internal/outreach");
  const hasButton = await p.evaluate((id) => !!document.querySelector(`a[href="/internal/outreach/${id}/offer"]`), camry);
  ok("the search card links to the Log Offer page", hasButton);

  // Empty page.
  await go(`/internal/outreach/${camry}/offer`);
  const t0 = await bodyText(p);
  ok("title names the customer and the car", t0.includes("Log an offer for Jordan — 2026 Toyota Camry"));
  ok("the customer's options are listed to tick", t0.includes("1. Cold Weather Package") && t0.includes("2. Moonroof"));
  ok("the trim tick names the ranked trims", t0.includes("Trim matches what the customer chose (SE / XSE)"));
  await shot(p, "01-log-offer-empty");

  // Fill it in.
  await fill(p, "Dealership", DEALER); await fill(p, "City", "Overland Park"); await fill(p, "ST", "KS"); await fill(p, "ZIP", "66210");
  await fill(p, "VIN", "1HGCM82633A004352"); await fill(p, "Stock #", "T12345"); await fill(p, "Trim on the car", "SE");
  await fill(p, "Exterior", "Ice Cap"); await fill(p, "Interior", "Black Fabric");
  await clickText(p, "On the car", 0); await clickText(p, "Not on the car", 1);
  await clickText(p, "+ Add a sticker option");
  await p.evaluate(() => { const i = [...document.querySelectorAll('input[placeholder="Option name"]')][0]; i.focus(); });
  await p.keyboard.type("Mudguards");
  await p.evaluate(() => { const i = [...document.querySelectorAll('input[placeholder="$"]')][0]; i.focus(); }); await p.keyboard.type("149");
  await p.evaluate(() => { const s = [...document.querySelectorAll("select")].find((x) => [...x.options].some((o) => o.value === "port"));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, "port"); s.dispatchEvent(new Event("change", { bubbles: true })); });
  await p.click('input[aria-label="Sticker"]', { clickCount: 3 }); await p.type('input[aria-label="Sticker"]', "30895");
  await p.click('input[aria-label="Negotiated"]', { clickCount: 3 }); await p.type('input[aria-label="Negotiated"]', "28100");
  await fill(p, "Doc fee", "399"); await fill(p, "Sales tax", "1850"); await fill(p, "Title & registration", "244");
  await clickText(p, "+ Add an add-on");
  await p.evaluate(() => { document.querySelector('input[placeholder="Add-on"]').focus(); }); await p.keyboard.type("Nitrogen fill");
  await p.evaluate(() => { const i = [...document.querySelectorAll('input[placeholder="$"]')].at(-1); i.focus(); }); await p.keyboard.type("149");
  await p.evaluate(() => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.includes("Dealer says it can be removed")); l.querySelector("input").click(); });
  await p.evaluate(() => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === "No other fees"); l.querySelector("input").click(); });
  await p.evaluate(() => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.startsWith("Trim matches")); l.querySelector("input").click(); });
  await p.evaluate(() => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === "Requested from dealer"); l.querySelector("input").click(); });
  await p.click('input[aria-label="Out-the-door"]', { clickCount: 3 }); await p.type('input[aria-label="Out-the-door"]', "30742");
  await p.evaluate(() => { const d = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10); const i = document.querySelector('input[type="date"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, d); i.dispatchEvent(new Event("input", { bubbles: true })); });
  await fill(p, "Note to the customer", "They can have it ready Saturday.");
  await sleep(500);
  const t1 = await bodyText(p);
  ok("the guarantee line counts it ($2,795 below)", t1.includes("Counts toward the guarantee: the trim matches and the negotiated price is $2,795 below this car's sticker."));
  ok("the lines add up to the out-the-door total", t1.includes("Your lines add up to $30,742") && !t1.includes("Check for a missing or extra line"));
  ok("the preview shows the breakdown and the removable add-on note",
     t1.includes("How the price adds up") && t1.includes("Out-the-door") && t1.includes("Don't want the Nitrogen fill? The dealer will remove it. Just tell your agent."));
  ok("interior marked as not their pick, exterior as their pick", t1.includes("✓ (their pick)") && t1.includes("not their pick"));
  await shot(p, "02-log-offer-filled");

  // Save draft.
  await clickText(p, "Save draft"); await waitText(p, "Draft saved. The customer can't see it.");
  const offersAfterDraft = (await a.from("qualifying_offers").select("id", { count: "exact", head: true }).eq("customer_search_id", camry)).count;
  ok("Save draft: the message, and no offer for the customer", offersAfterDraft === 0);
  await p.waitForFunction(() => location.search.includes("submission="), { timeout: 30000, polling: 300 }).catch(() => {});
  ok("the URL now carries the draft", p.url().includes("submission="));
  await shot(p, "03-draft-saved");

  // Send.
  await clickText(p, "Send to customer"); await waitText(p, "Sent to Jordan.");
  const offer = (await a.from("qualifying_offers").select("id, vehicle_interior_color, otd_source, otd_total_cents, good_until, note_to_customer").eq("customer_search_id", camry).single()).data;
  const n = async (t) => (await a.from(t).select("id", { count: "exact", head: true }).eq("qualifying_offer_id", offer.id)).count;
  ok("sent: interior, dealer's out-the-door quote, good until and note on the offer",
     offer.vehicle_interior_color === "Black Fabric" && offer.otd_source === "dealer_quote" && offer.otd_total_cents === 3074200 && !!offer.good_until && offer.note_to_customer === "They can have it ready Saturday.");
  const opts = (await a.from("offer_vehicle_options").select("vehicle_option_name, customer_asked_for, on_the_car, install_kind").eq("qualifying_offer_id", offer.id)).data;
  ok("options: wanted ✓ and ✗, plus the extra as port-installed",
     opts.length === 3 && opts.some((o) => o.vehicle_option_name === "Cold Weather Package" && o.on_the_car) && opts.some((o) => o.vehicle_option_name === "Moonroof" && !o.on_the_car)
     && opts.some((o) => o.vehicle_option_name === "Mudguards" && !o.customer_asked_for && o.install_kind === "port"), JSON.stringify(opts));
  ok("fees and add-on written", (await n("offer_fees")) === 3 && (await n("offer_addons")) === 1);
  await shot(p, "04-sent");

  // A second offer for the same car and dealer: both duplicate warnings.
  await go(`/internal/outreach/${camry}/offer`);
  await fill(p, "Dealership", DEALER); await fill(p, "VIN", "1HGCM82633A004352");
  await clickText(p, "On the car", 0); await clickText(p, "On the car", 1);
  await p.click('input[aria-label="Sticker"]', { clickCount: 3 }); await p.type('input[aria-label="Sticker"]', "30895");
  await p.click('input[aria-label="Negotiated"]', { clickCount: 3 }); await p.type('input[aria-label="Negotiated"]', "30995");
  for (const l of ["No add-ons", "No other fees", "Requested from dealer"]) await p.evaluate((t) => { const x = [...document.querySelectorAll("label")].find((y) => y.textContent.trim() === t); x.querySelector("input").click(); }, l);
  await p.evaluate(() => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.startsWith("Trim matches")); l.querySelector("input").click(); });
  await clickText(p, "Send to customer"); await waitText(p, "Tick each warning to send this offer.");
  const t2 = await bodyText(p);
  ok("warnings shown with the approved wording: above sticker, duplicate VIN, duplicate dealer",
     t2.includes("isn't below the sticker ($30,895). It won't count toward the guarantee. Send it anyway?") &&
     t2.includes("This VIN is already on an offer for this search") && t2.includes(`${DEALER} already has an open offer on this search. Send another one?`));
  ok("the guarantee line says it doesn't count", t2.includes("Doesn't count toward the guarantee: the negotiated price isn't below this car's sticker."));
  await shot(p, "05-warnings");
  ok("nothing sent while the warnings are unticked", (await a.from("qualifying_offers").select("id", { count: "exact", head: true }).eq("customer_search_id", camry)).count === 1);

  // Tesla: the order fee is prefilled.
  await go(`/internal/outreach/${tesla}/offer`);
  const t3 = await bodyText(p);
  const feeVal = await p.evaluate(() => [...document.querySelectorAll('input[placeholder="Fee name"]')].map((i) => i.value));
  ok("Tesla: the order fee is prefilled as an other fee, with the note", feeVal.includes("Order fee") && t3.includes("Prefilled: Tesla's $250 order fee (non-refundable)."));
  await shot(p, "06-tesla-order-fee");
} catch (e) {
  fail++; console.log("FAIL  run stopped:", e.message);
} finally {
  await browser?.close().catch(() => {});
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  await del("agent_activity_log", "agent_id", agentIds); await del("agent_activity_log", "search_id", searches);
  await del("notification_events", "customer_search_id", searches); await del("agent_alerts", "search_id", searches); await del("search_assignments", "search_id", searches);
  await del("customer_searches", "id", searches);
  await a.from("dealer_aliases").delete().eq("dealer_name", DEALER);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = {
    searches: await c("customer_searches", (q) => q.in("id", searches.length ? searches : ["00000000-0000-0000-0000-000000000000"])),
    offers: await c("qualifying_offers", (q) => q.eq("dealer_name", DEALER)),
    aliases: await c("dealer_aliases", (q) => q.eq("dealer_name", DEALER)),
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)),
    customers: await c("customers", (q) => q.eq("id", customerId ?? "00000000-0000-0000-0000-000000000000")),
    logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
  };
  const b1 = await cnt(brett.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed; screenshots in ${SHOTS}`);
}
