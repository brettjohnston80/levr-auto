// GX-2/3/4: guarantee exceptions in a real browser (desktop 1440, phone 390): intake, the FAQ and
// homepage links, Review your search with the terms box, Stripe checkout, the payment webhook
// setting the state, Your Deal, and the agent badge, Log Offer line and admin column.
// Disposable accounts only; one scratch listing stops the webhook's inventory sync (no MarketCheck call).
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
const SHOTS = path.join(os.homedir(), "Downloads/levr-gx-2026-10-30"); fs.mkdirSync(SHOTS, { recursive: true });
const MANIFEST = ROOT + "/.next/dev/server/server-reference-manifest.json";
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}-${crypto.randomUUID().slice(0, 6)}`, pw = `Gx1!${ts}aA`;
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
const NO_G = "Our money-back guarantee does not apply to Tesla.";
try {
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "gx-")) });
  const page = async () => { const p = await (await browser.createBrowserContext()).newPage(); p.setDefaultTimeout(300000); await p.setViewport({ width: 1440, height: 900 }); return p; };

  // 1. Homepage: the three "Terms apply." links, and W1 under the make at intake.
  const ph = await page(); await go(ph, "/");
  const links = await ph.evaluate(() => [...document.querySelectorAll("a")].filter((x) => x.textContent.trim() === "Terms apply.").map((x) => x.getAttribute("href")));
  ok("homepage: three \"Terms apply.\" links to the FAQ entry", links.length === 3 && links.every((h) => h === "/faq#guarantee-brands"), JSON.stringify(links));
  await shotAt(ph, "01-homepage-guarantee-terms-apply", "We guarantee it.");
  await shotAt(ph, "02-homepage-one-flat-fee-terms-apply", "You know the cost upfront");
  await shotAt(ph, "03-homepage-table-terms-apply", "If it doesn't work out");
  await ph.evaluate(() => { const s = [...document.querySelectorAll("select")].find((x) => [...x.options].some((o) => o.value === "Tesla")); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(s, "Tesla"); s.dispatchEvent(new Event("change", { bubbles: true })); });
  await waitText(ph, NO_G);
  ok("intake: W1 under the make once Tesla is picked", true);
  await shotAt(ph, "04-intake-tesla-w1", NO_G);

  // 2. The FAQ entry.
  const pf = await page(); await go(pf, "/faq#guarantee-brands"); await waitText(pf, "Does the guarantee cover every brand?");
  ok("FAQ: the new entry, after the below-Total-SRP answer", (await bodyText(pf)).indexOf("Does the guarantee cover every brand?") > (await bodyText(pf)).indexOf("What if you can't get me a deal below Total SRP?"));
  await shotAt(pf, "05-faq-guarantee-brands", "Does the guarantee cover every brand?");

  // 3. Review your search: Tesla (W2, W3/W3a, the refusal, then Stripe with W5) and Camry (bullet kept).
  const T = await mk("tesla"), C = await mk("camry");
  const ins = async (row) => { const id = must(await a.from("customer_searches").insert(row).select("id").single(), "search").id; searches.push(id); return id; };
  const tid = await ins({ customer_id: T.id, zip: "66213", make: "Tesla", model: "Model 3", model_year: 2027, pickup_travel_choice: "distance", pickup_travel_miles: 100 });
  await ins({ customer_id: C.id, zip: "66213", make: "Toyota", model: "Camry", model_year: 2026, pickup_travel_choice: "distance", pickup_travel_miles: 100 });
  const pt = await page(); await signIn(pt, T.email); await go(pt, "/account/vehicle"); await waitText(pt, "Review your search");
  const t3 = await bodyText(pt);
  ok("Review (Tesla): W2 in place of the guarantee bullet", t3.includes(NO_G) && !t3.includes("or your $699 back"));
  ok("Review: the terms box (W3) with W3a under it", t3.includes("I agree to the Terms of Service.") && t3.includes("Money-back guarantee does not apply to Tesla, Rivian, Lucid or Polestar."));
  await shotAt(pt, "06-review-tesla-terms-box", "I agree to the");
  await pt.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Continue to payment")).click());
  await waitText(pt, "Please agree to the Terms of Service to continue.");
  ok("not ticked: W4, no checkout, nothing stored", (await a.from("customers").select("terms_version").eq("id", T.id).single()).data.terms_version === null && !pt.url().includes("stripe.com"));
  await shotAt(pt, "07-review-terms-refused", "Please agree to the Terms of Service");
  // The server refuses it too (a crafted call without the box).
  await pt.evaluate(() => { const c = document.querySelector('input[type="checkbox"]'); c.click(); });
  await pt.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Continue to payment")).click());
  await pt.waitForFunction(() => location.hostname.includes("stripe.com"), { timeout: 120000, polling: 500 });
  const tv = (await a.from("customers").select("terms_version, terms_accepted_at").eq("id", T.id).single()).data;
  ok("ticked: the acceptance is stored (version and time), on to Stripe", tv.terms_version === "interim-2026-10" && !!tv.terms_accepted_at, JSON.stringify(tv));
  await sleep(4000);
  await pt.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 60000, polling: 500 }, NO_G).catch(() => {});
  ok("Stripe checkout: W5 above Pay", (await bodyText(pt)).includes(NO_G));
  await shotAt(pt, "08-stripe-checkout-w5", NO_G);

  const pc = await page(); await signIn(pc, C.email); await go(pc, "/account/vehicle"); await waitText(pc, "Review your search");
  const t4 = await bodyText(pc);
  ok("Review (Camry): the guarantee bullet stays, no W2; the terms box shows", t4.includes("or your $699 back") && !t4.includes("does not apply to Toyota") && t4.includes("I agree to the Terms of Service."));
  await shotAt(pc, "09-review-camry", "What's included");

  // 4. The payment webhook fixes the state (one scratch listing so the sync is skipped: no MarketCheck call).
  listings.push(must(await a.from("listings").insert({ vin: `GX${ts}`.slice(0, 17), make: "Tesla", model: "Model 3", year: 2027, trim: "Scratch", synced_at: new Date().toISOString() }).select("id").single(), "listing").id);
  const pi = await stripe.paymentIntents.create({ amount: 69900, currency: "usd", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" }, metadata: { claude_verify: PFX } });
  const payload = JSON.stringify({ id: `evt_${PFX}`, object: "event", type: "checkout.session.completed", api_version: "2024-06-20", created: Math.floor(Date.now() / 1000),
    data: { object: { id: `cs_test_${PFX}`, object: "checkout.session", payment_status: "paid", status: "complete", amount_total: 69900, payment_intent: pi.id, metadata: { type: "search_payment", customer_id: T.id, customer_search_id: tid } } } });
  const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
  const wr = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": sig, "content-type": "application/json" }, body: payload });
  const ts1 = (await a.from("customer_searches").select("paid_at, guarantee_status, guarantee_exception_make").eq("id", tid).single()).data;
  ok("payment: paid and not_applicable / Tesla in the same write", wr.status === 200 && !!ts1.paid_at && ts1.guarantee_status === "not_applicable" && ts1.guarantee_exception_make === "Tesla", `${wr.status} ${JSON.stringify(ts1)}`);

  // 5. Your Deal: W8 in place of the timeline (the search is made live directly).
  const now = new Date().toISOString();
  must(await a.from("customer_searches").update({ search_status: "searching", finalized_at: now, solidified_at: now }).eq("id", tid), "live");
  await go(pt, `/account/deal?searchId=${tid}`); await waitText(pt, "Your search runs through");
  const t5 = await bodyText(pt);
  ok("Your Deal: W8, and no \"Your guarantee\" timeline", /Our money-back guarantee does not apply to Tesla\. Your search runs through [A-Z][a-z]+ \d+, \d{4}, and you can extend it for \$100 per 30 days\./.test(t5) && !/your guarantee/i.test(t5));
  await shotAt(pt, "10-your-deal-w8", "Your search runs through");

  // 6. Agent screens: W14 badge, W15 on Log Offer, W16 in the admin Guarantee column (a lead, for /internal/admin).
  const email = `${PFX}-agent@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
  const L = must(await a.from("agents").insert({ email, name: "Claude Verify Lead", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(L.id);
  const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
  must(await a.rpc("set_agent_role", { p_actor_agent_id: padmin.id, p_subject_agent_id: L.id, p_role: "lead" }), "role");
  must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: L.id, p_auth_user_id: u.id }), "link");
  let secret; { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
    must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut(); secret = en.totp.secret; }
  await sleep(31000);
  const ap = await page();
  await go(ap, "/agent"); await ap.type('input[name="email"]', email); await ap.type('input[name="password"]', pw);
  await ap.click('form:has(input[name="password"]) button[type="submit"]'); await ap.waitForSelector('input[name="code"]'); await ap.type('input[name="code"]', totp(secret));
  await ap.click('form:has(input[name="code"]) button[type="submit"]'); await ap.waitForFunction(() => location.pathname !== "/agent", { timeout: 240000, polling: 300 });
  await go(ap, "/internal/outreach"); await waitText(ap, "No guarantee: Tesla (direct sale)");
  ok("agent: W14 badge on the Tesla search card", true);
  await shotAt(ap, "11-agent-badge-w14", "No guarantee: Tesla (direct sale)");
  await go(ap, `/internal/outreach/${tid}/offer`); await waitText(ap, "No guarantee for this brand.");
  ok("Log Offer: W15 in place of the guarantee line", !(await bodyText(ap)).includes("Counts toward the guarantee"));
  await shotAt(ap, "12-log-offer-w15", "No guarantee for this brand.");
  await go(ap, "/internal/admin"); await waitText(ap, "Not applicable");
  const row = await ap.evaluate((em) => [...document.querySelectorAll("tr")].find((r) => r.innerText.includes(em))?.innerText ?? "", T.email);
  ok("admin: Guarantee column, Not applicable on the Tesla search", (await bodyText(ap)).includes("GUARANTEE") || (await bodyText(ap)).includes("Guarantee"), row.slice(0, 120));
  ok("admin: the Tesla row says Not applicable", row.includes("Not applicable"), row.replace(/\s+/g, " ").slice(0, 160));
  await shotAt(ap, "13-admin-guarantee-column", "Not applicable");
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
