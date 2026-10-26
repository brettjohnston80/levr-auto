// Chunk 6: call-request resolution and the assigned-agent call email. Disposable test customers and a
// disposable agent (never LEVRID 1). PHASE=A normal server; PHASE=B with AGENT_ASSIGN_SIMULATE_NO_ROTATION=1
// (a real-style customer's request, assignment simulated: nobody is ever assigned).
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
const PHASE = process.env.PHASE ?? "A";
const a = createAdminClient(); const BASE = "http://localhost:3100";
const DEVLOG = (LOGS + "/dev3100.log");
const SHOTS = `${LOGS}/shots/agent-phase1-chunk6`;
const MANIFEST = (ROOT + "/.next/dev/server/server-reference-manifest.json");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}`, pw = `Cal!${ts}aA`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id, email, last_assigned_at, in_rotation").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const { count: alerts0 } = await a.from("agent_alerts").select("id", { count: "exact", head: true });
const logins = [], customers = [], searches = [], agentIds = [], listings = [];
const logText = () => fs.readFileSync(DEVLOG, "utf8");
const callLines = (sid) => logText().split("\n").filter((l) => l.startsWith("[call-request-email]") && l.includes(sid)).map((l) => JSON.parse(l.slice("[call-request-email] ".length)));
async function waitFor(fn, ms = 30000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(400); } return false; }
let browser;
async function mkCustomer(first, last, domain = "levrauto-test.invalid") {
  const email = `${PFX}-${first.toLowerCase()}@${domain}`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw }), "customer").user; logins.push(u.id); customers.push(u.id);
  must(await a.from("customers").update({ first_name: first, last_name: last, phone: "555-0142" }).eq("id", u.id), "name"); return { id: u.id, email };
}
const now = () => new Date().toISOString();
async function mkSearch(c, f = {}) { const s = must(await a.from("customer_searches").insert({ customer_id: c, zip: "66101", model_year: 2026, search_status: "searching", paid_at: now(), finalized_at: now(), solidified_at: now(), ...f }).select("id").single(), "search"); searches.push(s.id); return s.id; }
const row = async (id) => (await a.from("customer_searches").select("switch_call_resolved_at, switch_call_resolved_by_agent_id, switch_call_outcome, cancellation_call_resolved_at, cancellation_call_resolved_by_agent_id, cancellation_call_outcome, assigned_agent_id, superseded_by_id").eq("id", id).single()).data;
const activity = async (agentId, sid) => (await a.from("agent_activity_log").select("action, details").eq("agent_id", agentId).eq("search_id", sid)).data;
function actionIds() { const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); const out = {};
  for (const v of Object.values(m.node)) for (const w of Object.values(v.workers)) { const q = decodeURIComponent((w.moduleId.split("actions=")[1] ?? "").split("&")[0]);
    try { for (const [file, list] of JSON.parse(q)) for (const x of list) out[`${path.basename(file, ".ts")}.${x.exportedName ?? x.name}`] = x.id; } catch {} }
  return out; }
async function call(p, name, args) { const id = actionIds()[name]; if (!id) throw new Error(`no action id for ${name}`);
  return p.evaluate(async (id, args) => {
    const outer = new FormData(); let n = 0; let multipart = false;
    const json = args.map((arg) => { if (arg && typeof arg === "object" && arg.__form) { multipart = true; n++; const ref = n; for (const [k, v] of Object.entries(arg.__form)) outer.append(`_${ref}_${k}`, String(v)); return `$K${ref.toString(16)}`; } return arg; });
    let r; if (multipart) { outer.append("0", JSON.stringify(json)); r = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body: outer }); }
    else r = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify(args) });
    return `${r.status} ${await r.text()}`; }, id, args); }
async function go(p, u) { await p.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 180000 }).catch(() => {});
  // A redirect can replace the frame while this waits (Puppeteer then throws at once, not via the
  // promise), so retry on the new frame instead of ending the run.
  for (let i = 0; i < 5; i++) { try { await p.waitForFunction(() => { const b = document.querySelector("main button, section button"); return !b || Object.keys(b).some((k) => k.startsWith("__reactProps")); }, { timeout: 120000, polling: 300 }); break; } catch (e) { if (!String(e).includes("detached")) break; await new Promise((r) => setTimeout(r, 1000)); await p.waitForNetworkIdle({ idleTime: 800, timeout: 60000 }).catch(() => {}); } } }
async function customerPage(email) { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); p.setDefaultTimeout(300000); await p.setViewport({ width: 1280, height: 900 });
  await go(p, "/login"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await p.click('form:has(input[name="password"]) button[type="submit"]'); await p.waitForFunction(() => location.pathname !== "/login", { timeout: 240000, polling: 300 }); await go(p, "/account"); return p; }
const cardHandle = (p, section, email) => p.evaluateHandle((sec, e) => [...document.querySelectorAll(`#${sec} div.rounded-2xl`)].find((d) => d.textContent.includes(e)), section, email);
const cardExists = (p, section, email) => p.evaluate((sec, e) => [...document.querySelectorAll(`#${sec} div.rounded-2xl`)].some((d) => d.textContent.includes(e)), section, email);
async function inCard(p, section, email, fn, ...args) { return p.evaluate((sec, e, fnSrc, args) => { const d = [...document.querySelectorAll(`#${sec} div.rounded-2xl`)].find((x) => x.textContent.includes(e)); return new Function("d", "args", fnSrc)(d, args); }, section, email, fn, args); }
const clickText = (t) => `const b=[...d.querySelectorAll("button")].find((x)=>x.textContent.trim()===${JSON.stringify(t)}); if(!b) return false; b.click(); return true;`;
// el: a function run in the page that returns the element to capture (or null for the full page).
async function shot(p, name, el) {
  for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
    console.log(`step: shot ${name} ${tag}`);
    await p.setViewport({ width: w, height: h }); await sleep(800);
    const box = el ? await p.evaluate(el) : null;
    if (box) await p.screenshot({ path: `${SHOTS}/${name}-${tag}.png`, clip: box, captureBeyondViewport: true });
    else await p.screenshot({ path: `${SHOTS}/${name}-${tag}.png`, fullPage: true });
  }
  await p.setViewport({ width: 1440, height: 900 });
}
// In-page finder: the card in a section for this customer and vehicle, as a page-coordinate box.
const cardBox = (section, email, vehicle) => new Function(`const d=[...document.querySelectorAll("#${section} div.rounded-2xl")].find((x)=>x.textContent.includes(${JSON.stringify(email)})&&x.querySelector("h3")?.textContent.trim().endsWith(${JSON.stringify(vehicle)})); if(!d) return null; d.scrollIntoView({block:"center"}); const r=d.getBoundingClientRect(); return {x:r.left+window.scrollX,y:r.top+window.scrollY,width:r.width,height:r.height};`);
const sectionBox = (section) => new Function(`const d=document.getElementById(${JSON.stringify(section)}); d.scrollIntoView({block:"start"}); const r=d.getBoundingClientRect(); return {x:r.left+window.scrollX,y:r.top+window.scrollY,width:r.width,height:Math.min(r.height,1600)};`);

try {
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c6-")) });
  if (PHASE === "A") {
    const email = `${PFX}-agent@levrauto-test.invalid`;
    const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
    const A = must(await a.from("agents").insert({ email, name: "Casey Agent", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(A.id);
    must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: A.id, p_auth_user_id: u.id }), "link");
    let secret; { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
      must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut(); secret = en.totp.secret; }
    listings.push(must(await a.from("listings").insert({ vin: `CVC${ts}`.slice(0, 17), make: "Alfa Romeo", model: "Tonale", year: 2026, trim: "Scratch", synced_at: now() }).select("id").single(), "listing").id);

    const C = await mkCustomer("Jordan", "Sample");
    const S1 = await mkSearch(C.id, { make: "Toyota", model: "Camry" });       // assigned: switch call -> email to the agent only
    const S2 = await mkSearch(C.id, { make: "Honda", model: "CR-V" });         // unassigned test account: cancellation call -> leads/admins
    const S3 = await mkSearch(C.id, { make: "Kia", model: "Telluride", switch_call_requested_at: now() });       // switched from the card
    const S4 = await mkSearch(C.id, { make: "Mazda", model: "CX-5", cancellation_call_requested_at: now() });    // cancelled from the card
    for (const s of [S1, S3]) must(await a.rpc("reassign_search", { p_search_id: s, p_new_agent_id: A.id, p_actor_agent_id: padmin.id, p_reason: "Claude verify: call email" }), "reassign");

    // ---------- emails, through the customer's own requests
    const pc = await customerPage(C.email);
    const r1 = await call(pc, "switch-self-service-actions.requestSwitchCall", [S1]);
    await waitFor(() => callLines(S1).length === 1);
    const e1 = callLines(S1)[0];
    ok("assigned search: switch-call email to the assigned agent only (1 recipient), first line 'This search is assigned to you.'", /"ok":true/.test(r1) && e1?.route === "assigned" && JSON.stringify(e1.recipients) === JSON.stringify([email]) && e1.html.startsWith("<p>This search is assigned to you.</p>"), JSON.stringify(e1 ?? r1.slice(-200)));
    ok("…subject and body unchanged otherwise", e1?.subject === "Jordan Sample requested a switch call — 2026 Toyota Camry" && e1.html.includes("<p>Jordan Sample asked for a call to switch away from their current 2026 Toyota Camry search.</p>") && e1.html.includes("<li>Phone: 555-0142</li>") && e1.html.includes("/internal/outreach#switch-calls"));
    const r2 = await call(pc, "cancellation-actions.requestCancellationCall", [S2]);
    await waitFor(() => callLines(S2).length === 1);
    const e2 = callLines(S2)[0]; const { data: leads } = await a.rpc("agent_alert_recipients", { p_audience: "leads" });
    ok("unassigned test account: cancellation-call email to leads (admins when there's no lead), without the assigned line", /"ok":true/.test(r2) && e2?.route === "fallback" && JSON.stringify(e2.recipients) === JSON.stringify(leads.map((l) => l.email)) && !e2.html.includes("assigned to you"), JSON.stringify(e2 ?? r2.slice(-200)));
    ok("…not assigned, no alert raised", (await row(S2)).assigned_agent_id === null && (await a.from("agent_alerts").select("id").eq("search_id", S2)).data.length === 0);
    fs.mkdirSync(path.join(LOGS, "c6"), { recursive: true }); fs.writeFileSync(path.join(LOGS, "c6", "emails.json"), JSON.stringify([e1, e2], null, 2));
    await pc.browserContext().close();

    // ---------- agent: resolve on the cards
    await sleep(31000);
    const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); p.setDefaultTimeout(300000); await p.setViewport({ width: 1440, height: 900 });
    p.on("dialog", async (d) => { console.log("step: DIALOG", d.type(), d.message()); await d.dismiss(); });
    await go(p, "/agent"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
    await p.click('form:has(input[name="password"]) button[type="submit"]'); await p.waitForSelector('input[name="code"]'); await p.type('input[name="code"]', totp(secret));
    await p.click('form:has(input[name="code"]) button[type="submit"]'); await p.waitForFunction(() => location.pathname !== "/agent", { timeout: 240000, polling: 300 });
    await go(p, "/internal/outreach");
    const p2 = await ctx.newPage(); p2.setDefaultTimeout(300000); await p2.setViewport({ width: 1440, height: 900 }); await go(p2, "/internal/outreach"); // stale tab
    console.log("step: outreach loaded");
    ok("switch card shows 'Mark call resolved'", await p.evaluate((e) => { const d = [...document.querySelectorAll("#switch-calls div.rounded-2xl")].find((x) => x.textContent.includes(e) && x.querySelector("h3")?.textContent.trim() === "Toyota Camry"); return !!d && [...d.querySelectorAll("button")].some((b) => b.textContent.trim() === "Mark call resolved"); }, C.email));
    console.log("step: screenshot 01");
    await shot(p, "01-switch-card", cardBox("switch-calls", C.email, "Camry"));
    const camry = (pg) => pg.evaluateHandle((e) => [...document.querySelectorAll("#switch-calls div.rounded-2xl")].find((d) => d.textContent.includes(e) && d.querySelector("h3")?.textContent.trim() === "Toyota Camry"), C.email);
    await (await camry(p)).evaluate((d) => [...d.querySelectorAll("button")].find((b) => b.textContent.trim() === "Mark call resolved").click());
    await p.waitForSelector(`#outcome-${S1}`);
    const opts = await p.$eval(`#outcome-${S1}`, (s) => [...s.options].map((o) => o.textContent));
    ok("switch outcomes: Didn't switch / Couldn't complete the call / Other", JSON.stringify(opts) === JSON.stringify(["Didn't switch", "Couldn't complete the call", "Other"]), JSON.stringify(opts));
    await p.type(`#note-${S1}`, "Customer is keeping the Camry.");
    await shot(p, "02-switch-resolve-form", cardBox("switch-calls", C.email, "Camry"));
    // Diagnosis of the earlier timeout: does the OTHER switch card (the Telluride) contain the word "Camry"?
    const tellurideHasCamry = await p.evaluate((e) => { const d = [...document.querySelectorAll("#switch-calls div.rounded-2xl")].find((x) => x.textContent.includes(e) && x.querySelector("h3")?.textContent.trim() === "Kia Telluride"); return d ? d.textContent.includes("Camry") : null; }, C.email);
    console.log(`diagnosis: the Telluride card's text contains "Camry": ${tellurideHasCamry}`);
    const a0 = await cnt(A.id);
    await (await camry(p)).evaluate((d) => [...d.querySelectorAll("button")].find((b) => b.textContent.trim() === "Resolve").click());
    // The card must leave WITHOUT a reload (the page re-renders from the action's response).
    const goneAt = Date.now();
    await p.waitForFunction((e) => ![...document.querySelectorAll("#switch-calls div.rounded-2xl")].some((d) => d.textContent.includes(e) && d.querySelector("h3")?.textContent.trim() === "Toyota Camry"), { timeout: 30000, polling: 300 }, C.email)
      .catch(async (err) => {
        const dump = await p.evaluate(() => [...document.querySelectorAll("#switch-calls div.rounded-2xl")].map((d) => ({ h3: d.querySelector("h3")?.textContent.trim(), cls: d.className.slice(0, 60), text: d.innerText.replace(/\s+/g, " ").slice(0, 400) })));
        console.log("diagnosis: switch section at timeout:", JSON.stringify(dump, null, 1));
        const { data: r } = await a.from("customer_searches").select("switch_call_resolved_at, switch_call_outcome").eq("id", S1).single();
        console.log("diagnosis: S1 row:", JSON.stringify(r));
        throw err;
      });
    console.log(`diagnosis: the Camry card left the page ${Date.now() - goneAt} ms after Resolve, without a reload`);
    const s1 = await row(S1); const act1 = await activity(A.id, S1);
    ok("resolved 'Didn't switch': all three columns set (no_switch, by the agent), card gone", !!s1.switch_call_resolved_at && s1.switch_call_resolved_by_agent_id === A.id && s1.switch_call_outcome === "no_switch", JSON.stringify(s1));
    ok("…one call_request_resolved activity row with the note", (await cnt(A.id)) - a0 === 1 && act1.length === 1 && act1[0].action === "call_request_resolved" && act1[0].details.note === "Customer is keeping the Camry." && act1[0].details.outcome === "no_switch", JSON.stringify(act1));
    await shot(p, "03-switch-section-after", sectionBox("switch-calls"));
    // Stale tab: the card is still there; resolving again is refused.
    await (await camry(p2)).evaluate((d) => [...d.querySelectorAll("button")].find((b) => b.textContent.trim() === "Mark call resolved").click());
    await p2.waitForSelector(`#outcome-${S1}`);
    await (await camry(p2)).evaluate((d) => [...d.querySelectorAll("button")].find((b) => b.textContent.trim() === "Resolve").click());
    await p2.waitForFunction(() => document.body.innerText.includes("Couldn't resolve this request: it's already been resolved."), { timeout: 60000, polling: 300 });
    ok("stale tab: 'Couldn't resolve this request: it's already been resolved.'; still one activity row", (await activity(A.id, S1)).length === 1);
    await shot(p2, "04-error-already-resolved", cardBox("switch-calls", C.email, "Camry")); await p2.close();

    // cancellation call: Didn't cancel
    const crv = (pg) => pg.evaluateHandle((e) => [...document.querySelectorAll("#cancellation-calls div.rounded-2xl")].find((d) => d.textContent.includes(e) && d.querySelector("h3")?.textContent.trim() === "Honda CR-V"), C.email);
    await shot(p, "05-cancellation-card", cardBox("cancellation-calls", C.email, "CR-V"));
    await (await crv(p)).evaluate((d) => [...d.querySelectorAll("button")].find((b) => b.textContent.trim() === "Mark call resolved").click());
    await p.waitForSelector(`#outcome-${S2}`);
    const opts2 = await p.$eval(`#outcome-${S2}`, (s) => [...s.options].map((o) => o.textContent));
    ok("cancellation outcomes: Didn't cancel / Couldn't complete the call / Other", JSON.stringify(opts2) === JSON.stringify(["Didn't cancel", "Couldn't complete the call", "Other"]), JSON.stringify(opts2));
    await shot(p, "06-cancellation-resolve-form", cardBox("cancellation-calls", C.email, "CR-V"));
    await (await crv(p)).evaluate((d) => [...d.querySelectorAll("button")].find((b) => b.textContent.trim() === "Resolve").click());
    await p.waitForFunction((e) => ![...document.querySelectorAll("#cancellation-calls div.rounded-2xl")].some((d) => d.textContent.includes(e) && d.querySelector("h3")?.textContent.trim() === "Honda CR-V"), { timeout: 120000, polling: 300 }, C.email);
    const s2 = await row(S2); const act2 = await activity(A.id, S2);
    ok("resolved 'Didn't cancel': not_cancelled by the agent, card gone, one activity row", s2.cancellation_call_outcome === "not_cancelled" && s2.cancellation_call_resolved_by_agent_id === A.id && !!s2.cancellation_call_resolved_at && act2.length === 1 && act2[0].action === "call_request_resolved", JSON.stringify([s2, act2]));

    // automatic: switch from the card, cancel from the card
    const sw = await call(p, "switch-actions.switchCustomerSearch", [{ __form: { old_search_id: S3, new_make: "Alfa Romeo", new_model: "Tonale", new_model_year: "2026", reason_category: "Goodwill gesture", notes: "Claude verify" } }]);
    const s3 = await row(S3); if (s3.superseded_by_id) searches.push(s3.superseded_by_id);
    ok("agent switch from the card: request resolved automatically as 'switched', by the agent", /"ok":true/.test(sw) && s3.switch_call_outcome === "switched" && s3.switch_call_resolved_by_agent_id === A.id, JSON.stringify(s3));
    const cn = await call(p, "agent-cancellation-actions.resolveCancellation", [S4, "Other", "Claude verify", []]);
    const s4 = await row(S4);
    ok("agent cancellation from the card: request resolved automatically as 'cancelled'", /"ok":true/.test(cn) && s4.cancellation_call_outcome === "cancelled" && s4.cancellation_call_resolved_by_agent_id === A.id, JSON.stringify(s4));
    // ---------- asking again after a resolution (Brett 2026-10-15): a fresh request, emailed the same way
    { const pc2 = await customerPage(C.email);
      const before = callLines(S1).length;
      const [ra, rb] = await Promise.all([call(pc2, "switch-self-service-actions.requestSwitchCall", [S1]), call(pc2, "switch-self-service-actions.requestSwitchCall", [S1])]);
      await waitFor(() => callLines(S1).length === before + 1); await sleep(2000);
      const again = await row(S1);
      const eAgain = callLines(S1).slice(-1)[0];
      ok("ask again after 'Didn't switch': a fresh open request (resolution cleared), one email (double click sends one)", /"ok":true/.test(ra) && /"ok":true/.test(rb) && again.switch_call_resolved_at === null && again.switch_call_outcome === null && again.switch_call_resolved_by_agent_id === null && callLines(S1).length === before + 1, JSON.stringify(again));
      ok("…emailed to the assigned agent only, with 'This search is assigned to you.'", eAgain?.route === "assigned" && JSON.stringify(eAgain.recipients) === JSON.stringify([email]) && eAgain.html.startsWith("<p>This search is assigned to you.</p>"), JSON.stringify(eAgain));
      ok("…the earlier resolution stays in the activity log", (await activity(A.id, S1)).filter((x) => x.action === "call_request_resolved" && x.details.outcome === "no_switch").length === 1);
      await go(p, "/internal/outreach");
      ok("…and the card is back in the switch section", await p.evaluate((e) => [...document.querySelectorAll("#switch-calls div.rounded-2xl")].some((d) => d.textContent.includes(e) && d.querySelector("h3")?.textContent.trim() === "Toyota Camry"), C.email));
      await pc2.browserContext().close(); }

    // ---------- the customer switches or cancels on their own while a request is open
    { const C2 = await mkCustomer("Riley", "Ownmove");
      const S5 = await mkSearch(C2.id, { make: "Subaru", model: "Outback", switch_call_requested_at: now() });
      const S6 = await mkSearch(C2.id, { make: "Ford", model: "Escape", cancellation_call_requested_at: now() });
      const S7 = await mkSearch(C2.id, { make: "Hyundai", model: "Tucson", switch_call_requested_at: now() });
      const pc3 = await customerPage(C2.email);
      const custActivity = async (sid) => (await a.from("agent_activity_log").select("agent_id, action, details").eq("search_id", sid).eq("action", "call_request_resolved_by_customer")).data;
      const fs1 = await call(pc3, "switch-self-service-actions.executeFreeSwitch", [S5, "Alfa Romeo", "Tonale", 2026]);
      const r5 = await row(S5); if (r5.superseded_by_id) searches.push(r5.superseded_by_id); const a5 = await custActivity(S5);
      ok("customer's own free switch: open switch request resolved 'switched', no agent named", /"ok":true/.test(fs1) && r5.switch_call_outcome === "switched" && !!r5.switch_call_resolved_at && r5.switch_call_resolved_by_agent_id === null, JSON.stringify(r5));
      ok("…one activity row noting the customer did it (no agent)", a5.length === 1 && a5[0].agent_id === null && a5[0].details.by === "customer" && a5[0].details.outcome === "switched", JSON.stringify(a5));
      const cs = await call(pc3, "cancellation-actions.cancelSearch", [S6]);
      const r6 = await row(S6); const a6 = await custActivity(S6);
      ok("customer's own cancellation: open cancellation request resolved 'cancelled', no agent named, one customer activity row", /"ok":true/.test(cs) && r6.cancellation_call_outcome === "cancelled" && r6.cancellation_call_resolved_by_agent_id === null && a6.length === 1 && a6[0].agent_id === null, JSON.stringify([r6, a6]));
      // The customer's own paid switch ($100 webhook)
      const pi = await stripe.paymentIntents.create({ amount: 10000, currency: "usd", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" }, metadata: { claude_verify: PFX } });
      const payload = JSON.stringify({ id: `evt_${PFX}_s7`, object: "event", type: "checkout.session.completed", api_version: "2024-06-20", created: Math.floor(Date.now() / 1000), data: { object: { id: `cs_test_${PFX}_s7`, object: "checkout.session", payment_status: "paid", status: "complete", amount_total: 10000, payment_intent: pi.id, metadata: { type: "switch_fee", customer_id: C2.id, old_search_id: S7, new_make: "Alfa Romeo", new_model: "Tonale", new_model_year: "2026" } } } });
      const wr = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET }), "content-type": "application/json" }, body: payload });
      const r7 = await row(S7); if (r7.superseded_by_id) searches.push(r7.superseded_by_id); const a7 = await custActivity(S7);
      ok("customer's own paid switch: open switch request resolved 'switched', no agent named, one customer activity row", wr.status === 200 && r7.switch_call_outcome === "switched" && r7.switch_call_resolved_by_agent_id === null && a7.length === 1 && a7[0].agent_id === null, JSON.stringify([r7, a7]));
      const { count: noAgentOther } = await a.from("agent_activity_log").select("id", { count: "exact", head: true }).is("agent_id", null).neq("action", "call_request_resolved_by_customer");
      ok("no other activity row is ever written without an agent", noAgentOther === 0);
      await pc3.browserContext().close(); }

    await go(p, "/internal/outreach");
    ok("after reload: only the re-requested Camry card remains for this customer; nothing for the customer who switched/cancelled on their own",
      (await p.evaluate((e) => [...document.querySelectorAll("#switch-calls div.rounded-2xl, #cancellation-calls div.rounded-2xl")].filter((d) => d.textContent.includes(e)).map((d) => d.querySelector("h3")?.textContent.trim()), C.email)).join(",") === "Toyota Camry"
      && !(await cardExists(p, "switch-calls", `${PFX}-riley`)) && !(await cardExists(p, "cancellation-calls", `${PFX}-riley`)));
  } else {
    // PHASE B: simulated empty rotation. Guard first: a test customer's payment must show a simulated assignment.
    listings.push(must(await a.from("listings").insert({ vin: `CVB${ts}`.slice(0, 17), make: `ClaudeVerify${ts}`, model: "NoLead", year: 2026, trim: "Scratch", synced_at: now() }).select("id").single(), "listing").id);
    const T = await mkCustomer("Taylor", "Guard");
    const ST = await mkSearch(T.id, { make: `ClaudeVerify${ts}`, model: "NoLead", paid_at: null, search_status: "awaiting_finalization", finalized_at: null, solidified_at: null });
    const pi = await stripe.paymentIntents.create({ amount: 69900, currency: "usd", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" }, metadata: { claude_verify: PFX } });
    const payload = JSON.stringify({ id: `evt_${PFX}`, object: "event", type: "checkout.session.completed", api_version: "2024-06-20", created: Math.floor(Date.now() / 1000), data: { object: { id: `cs_test_${PFX}`, object: "checkout.session", payment_status: "paid", status: "complete", amount_total: 69900, payment_intent: pi.id, metadata: { type: "search_payment", customer_id: T.id, customer_search_id: ST } } } });
    await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET }), "content-type": "application/json" }, body: payload });
    const simulated = await waitFor(() => logText().split("\n").some((l) => l.startsWith("[assignment]") && l.includes(ST) && l.includes("simulated_")));
    ok("guard: the server is simulating an empty rotation", simulated);
    if (!simulated) throw new Error("not simulating; refusing to use a real-style customer");
    const R = await mkCustomer("Riley", "Realstyle", "claude-verify.test");
    const SR = await mkSearch(R.id, { make: `ClaudeVerify${ts}`, model: "NoLead" });
    const pc = await customerPage(R.email);
    const rr = await call(pc, "cancellation-actions.requestCancellationCall", [SR]);
    await waitFor(() => callLines(SR).length === 1);
    const e3 = callLines(SR)[0]; const { data: leads } = await a.rpc("agent_alert_recipients", { p_audience: "leads" });
    const { data: al } = await a.from("agent_alerts").select("id, kind, notified_at").eq("search_id", SR);
    ok("real customer, nobody in rotation and no lead: assignment tried first (no-lead alert raised), then the email goes to admins without the assigned line", /"ok":true/.test(rr) && al.length === 1 && al[0].kind === "assignment_no_lead" && e3?.route === "fallback" && JSON.stringify(e3.recipients) === JSON.stringify(leads.map((l) => l.email)) && !e3.html.includes("assigned to you"), JSON.stringify([e3, al]));
    ok("…search still unassigned", (await row(SR)).assigned_agent_id === null);
  }
  const { data: b } = await a.from("agents").select("last_assigned_at, in_rotation").eq("id", brett.id).single();
  ok("LEVRID 1 untouched (never assigned, rotation unchanged)", b.last_assigned_at === brett.last_assigned_at && b.in_rotation === brett.in_rotation);
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser?.close().catch(() => {});
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  const { data: more } = await a.from("customer_searches").select("id").in("customer_id", customers.length ? customers : ["00000000-0000-0000-0000-000000000000"]);
  for (const r of more ?? []) if (!searches.includes(r.id)) searches.push(r.id);
  await del("agent_activity_log", "agent_id", agentIds); await del("agent_activity_log", "search_id", searches);
  await a.from("agent_activity_log").delete().eq("agent_id", padmin.id).gte("created_at", runStart);
  await del("agent_alerts", "search_id", searches); await del("agent_bypass_log", "search_id", searches); await del("search_assignments", "search_id", searches);
  await del("cancellation_log", "search_id", searches); await del("payments", "search_id", searches); await del("notification_events", "customer_search_id", searches);
  if (searches.length) await a.from("customer_searches").update({ superseded_by_id: null }).in("id", searches);
  await del("customer_searches", "id", searches); await del("listings", "id", listings);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await del("customers", "id", customers); await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = { logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)), searches: searches.length ? await c("customer_searches", (q) => q.in("id", searches)) : 0,
    listings: listings.length ? await c("listings", (q) => q.in("id", listings)) : 0, alertsTotal: await c("agent_alerts", (q) => q) };
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} (alerts before ${alerts0}) | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (left.logins || left.agents || left.searches || left.listings || left.alertsTotal !== alerts0 || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
