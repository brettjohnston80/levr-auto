// Chunk 7b, part 1: the five listing reads, measured on the real pages and the real intake action.
// LABEL=before|after. 1,100 scratch listings under a fake make that is never synced; the LAST 100 carry
// a dealer and a trim found nowhere else, so a read cut off at 1,000 rows loses them visibly.
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const LABEL = process.env.LABEL ?? "after";
const a = createAdminClient(); const BASE = "http://localhost:3100";
const SHOTS = `${LOGS}/shots/agent-phase1-chunk7b`;
const MANIFEST = (ROOT + "/.next/dev/server/server-reference-manifest.json");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}`, pw = `Lst!${ts}aA`;
const MAKE = `ClaudeVerify${ts}`, MODEL = "Scratch";
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, w) => { if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data; };
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
function actionIds() { const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); const out = {};
  for (const v of Object.values(m.node)) for (const w of Object.values(v.workers)) { const q = decodeURIComponent((w.moduleId.split("actions=")[1] ?? "").split("&")[0]);
    try { for (const [file, list] of JSON.parse(q)) for (const x of list) out[`${path.basename(file, ".ts")}.${x.exportedName ?? x.name}`] = x.id; } catch {} }
  return out; }
const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const logins = [], customers = [], agentIds = [], listingIds = [], aliasIds = [], searchIds = [];
const metrics = {}; let browser;
const insertMany = async (table, rows) => { const ids = []; for (let i = 0; i < rows.length; i += 500) ids.push(...must(await a.from(table).insert(rows.slice(i, i + 500)).select("id"), table).map((r) => r.id)); return ids; };
const DEALERS = [0, 1, 2, 3, 4].map((k) => ({ name: `CLAUDE VERIFY DEALER ${ts} ${k}`, zip: `6610${k + 1}` }));
const LATE = { name: `CLAUDE VERIFY LATE DEALER ${ts}`, zip: "66106" };
try {
  const vin = (i) => `CV${String(ts).slice(-9)}${String(i).padStart(6, "0")}`;
  const rows = [];
  for (let i = 0; i < 1100; i++) {
    const late = i >= 1000; const d = late ? LATE : DEALERS[i % 5];
    rows.push({ vin: vin(i), make: MAKE, model: MODEL, year: 2026, trim: late ? "Late Edition" : i % 2 ? "Plus" : "Base",
      price_cents: late ? 9900000 : 3000000 + i * 100, msrp_cents: late ? 9900000 : 3200000 + i * 100,
      dealer_name: d.name, dealer_city: "Kansas City", dealer_state: "KS", dealer_zip: d.zip, synced_at: new Date().toISOString() });
  }
  listingIds.push(...await insertMany("listings", rows));
  // Dealer aliases: one per scratch dealer, plus 700 more so the unconfirmed queue passes 1,000.
  aliasIds.push(...await insertMany("dealer_aliases", [...DEALERS, LATE].map((d) => ({ dealer_name: d.name, dealer_city: "Kansas City", dealer_state: "KS" }))));
  aliasIds.push(...await insertMany("dealer_aliases", Array.from({ length: 700 }, (_, n) => ({ dealer_name: `CLAUDE VERIFY ALIAS ${ts} ${String(n).padStart(3, "0")}`, dealer_city: "Kansas City", dealer_state: "KS" }))));
  const { count: unconfirmedTotal } = await a.from("dealer_aliases").select("id", { count: "exact", head: true }).is("dealership_id", null);
  // A customer with an active search (outreach card) and a finalization call request (agent finalize form).
  const cu = must(await a.auth.admin.createUser({ email: `${PFX}-cust@levrauto-test.invalid`, email_confirm: true, password: pw }), "customer").user; logins.push(cu.id); customers.push(cu.id);
  const now = new Date().toISOString();
  searchIds.push(must(await a.from("customer_searches").insert({ customer_id: cu.id, zip: "66101", make: MAKE, model: MODEL, model_year: 2026, search_status: "searching", paid_at: now, finalized_at: now, solidified_at: now }).select("id").single(), "s1").id);
  searchIds.push(must(await a.from("customer_searches").insert({ customer_id: cu.id, zip: "66101", make: MAKE, model: MODEL, model_year: 2026, search_status: "awaiting_finalization", paid_at: now, call_requested_at: now }).select("id").single(), "s2").id);
  console.log(`scratch data: 1,100 listings (last 100 = the late dealer, trim "Late Edition"), ${aliasIds.length} aliases (unconfirmed total ${unconfirmedTotal}); listings in the database: ${(await a.from("listings").select("id", { count: "exact", head: true })).count}`);

  // Agent (a lead) for the agent pages.
  const email = `${PFX}-lead@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
  const L = must(await a.from("agents").insert({ email, name: "Casey Lead", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(L.id);
  must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: L.id, p_auth_user_id: u.id }), "link");
  must(await a.rpc("set_agent_role", { p_actor_agent_id: padmin.id, p_subject_agent_id: L.id, p_role: "lead", p_in_rotation: false }), "role");
  let secret; { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
    must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut(); secret = en.totp.secret; }
  await sleep(31000);
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c7b-")) });
  const p = await browser.newPage(); p.setDefaultTimeout(300000); await p.setViewport({ width: 1440, height: 900 });

  // #5: the intake count (a public action; called from the homepage).
  await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 1500, timeout: 240000 }).catch(() => {});
  const inv = await p.evaluate(async (id, make, model) => { const r = await fetch("/", { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify([make, model, "66101"]) }); return await r.text(); }, actionIds()["inventory-count.countNearbyInventory"], MAKE, MODEL);
  metrics.intakeCount = Number((inv.match(/"count":(\d+)/) ?? [])[1] ?? NaN);

  await p.goto(`${BASE}/agent`, { waitUntil: "networkidle2" }); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await p.click('form:has(input[name="password"]) button[type="submit"]'); await p.waitForSelector('input[name="code"]'); await p.type('input[name="code"]', totp(secret));
  await p.click('form:has(input[name="code"]) button[type="submit"]'); await p.waitForFunction(() => location.pathname !== "/agent", { timeout: 240000, polling: 300 });

  // #3 and #4 on /internal/outreach
  await p.goto(`${BASE}/internal/outreach`, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 2000, timeout: 240000 }).catch(() => {});
  const card = await p.evaluate((ts) => { const d = [...document.querySelectorAll("div.rounded-2xl")].find((x) => x.innerText.includes(`CLAUDE VERIFY DEALER ${ts}`) || x.innerText.includes(`CLAUDE VERIFY LATE DEALER ${ts}`)); if (!d) return null;
    const lines = [...d.querySelectorAll("li")].map((li) => li.innerText).filter((t) => t.includes(`DEALER ${ts}`));
    return { dealers: lines.length, listings: lines.reduce((s, t) => s + Number((t.match(/\((\d+) listing/) ?? [])[1] ?? 0), 0), hasLate: lines.some((t) => t.includes("LATE DEALER")) }; }, ts);
  metrics.outreachDealers = card?.dealers; metrics.outreachListingsCounted = card?.listings; metrics.outreachLateDealerShown = card?.hasLate;
  metrics.finalizeTrims = await p.evaluate(() => { const sel = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.textContent.includes("No preference — any trim")) && [...s.options].some((o) => /^(Base|Plus|Late Edition)\b/.test(o.textContent))); return sel ? [...sel.options].map((o) => o.textContent.trim()).filter((t) => !t.startsWith("No preference")) : null; });
  for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
    await p.setViewport({ width: w, height: h }); await sleep(800);
    const b = await p.evaluate((ts) => { const d = [...document.querySelectorAll("div.rounded-2xl")].find((x) => x.innerText.includes(`Matching dealers`) && x.innerText.includes(`DEALER ${ts}`)); if (!d) return null; const hd = [...d.querySelectorAll("h3")].find((x) => x.textContent.startsWith("Matching dealers")); hd.scrollIntoView({ block: "start" }); const r = hd.parentElement.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: Math.min(r.height, 900) }; }, ts);
    if (b) await p.screenshot({ path: `${SHOTS}/${LABEL}-outreach-dealers-${tag}.png`, clip: b, captureBeyondViewport: true });
  }
  await p.setViewport({ width: 1440, height: 900 });

  // #1 and #2 on /internal/dealerships
  await p.goto(`${BASE}/internal/dealerships`, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 2000, timeout: 240000 }).catch(() => {});
  const dl = await p.evaluate((ts) => { const body = document.body.innerText; const rows = body.split("\n");
    // Each dealer's own row: the smallest element holding its name and a "N listing(s)" count.
    const dealerCounts = {};
    for (const name of [0, 1, 2, 3, 4].map((k) => `CLAUDE VERIFY DEALER ${ts} ${k}`).concat([`CLAUDE VERIFY LATE DEALER ${ts}`])) {
      const el = [...document.querySelectorAll("li, tr, div")].filter((x) => x.innerText?.includes(name) && /\d+ listings?/.test(x.innerText) && x.innerText.split(/\d+ listings?/).length === 2).sort((x, y) => x.innerText.length - y.innerText.length)[0];
      dealerCounts[name.includes("LATE") ? "late" : name.slice(-1)] = el ? Number(el.innerText.match(/(\d+) listings?/)[1]) : null;
    }
    return { aliasRowsShown: rows.filter((t) => t.includes(`CLAUDE VERIFY ALIAS ${ts}`)).length, dealerCounts }; }, ts);
  metrics.unconfirmedScratchAliasesShown = dl.aliasRowsShown; metrics.unconfirmedTotal = unconfirmedTotal;
  metrics.dealershipCounts = dl.dealerCounts; // expected: 0-4 → 200 each, late → 100
  for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
    await p.setViewport({ width: w, height: h }); await sleep(800);
    const b = await p.evaluate((ts) => { const el = [...document.querySelectorAll("li, tr, div")].filter((x) => x.children.length < 12 && x.innerText?.includes(`CLAUDE VERIFY DEALER ${ts} 0`)).sort((x, y) => x.innerText.length - y.innerText.length)[0]; if (!el) return null; const box = el.closest("ul, table, section") ?? el; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY - 150), width: innerWidth, height: 500 }; }, ts);
    if (b) await p.screenshot({ path: `${SHOTS}/${LABEL}-dealerships-counts-${tag}.png`, clip: b, captureBeyondViewport: true });
  }
  console.log(`METRICS ${LABEL}: ${JSON.stringify(metrics)}`);
  if (LABEL !== "before") {
    ok("#5 intake count: all 1,100 nearby listings counted", metrics.intakeCount === 1100, `${metrics.intakeCount}`);
    ok("#3 outreach card: all 6 scratch dealers listed, including the late one, listing counts add up to 1,100", metrics.outreachDealers === 6 && metrics.outreachLateDealerShown === true && metrics.outreachListingsCounted === 1100, JSON.stringify(card));
    ok("#4 agent finalize form: the trims include 'Late Edition' (only in the last 100 listings)", (metrics.finalizeTrims ?? []).some((t) => t.startsWith("Late Edition")), JSON.stringify(metrics.finalizeTrims));
    ok("#2 dealerships: every unconfirmed scratch alias is listed (queue past 1,000)", metrics.unconfirmedScratchAliasesShown === 700 && metrics.unconfirmedTotal > 1000, `${metrics.unconfirmedScratchAliasesShown} of 700 (queue ${metrics.unconfirmedTotal})`);
    ok("#1 dealerships: every scratch dealer shows its real listing count (200 each, the late dealer 100)", ["0", "1", "2", "3", "4"].every((k) => dl.dealerCounts[k] === 200) && dl.dealerCounts.late === 100, JSON.stringify(dl.dealerCounts));
  }
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser?.close().catch(() => {});
  const del = async (t, col, ids) => { for (let i = 0; i < ids.length; i += 300) { const { error } = await a.from(t).delete().in(col, ids.slice(i, i + 300)); if (error) console.log("cleanup", t, error.message); } };
  await del("agent_activity_log", "search_id", searchIds); await del("customer_searches", "id", searchIds);
  await del("dealer_aliases", "id", aliasIds); await del("listings", "id", listingIds);
  await del("agent_activity_log", "agent_id", agentIds); await a.from("agent_activity_log").delete().eq("agent_id", padmin.id).gte("created_at", runStart);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await del("customers", "id", customers); await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = { logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)), listings: await c("listings", (q) => q.eq("make", MAKE)),
    aliases: await c("dealer_aliases", (q) => q.ilike("dealer_name", `CLAUDE VERIFY % ${ts}%`)), searches: await c("customer_searches", (q) => q.eq("make", MAKE)) };
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
