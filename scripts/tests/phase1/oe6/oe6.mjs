// Offer entry, Chunk 6: the Log Offer listing picker on real synced Camry listings (committed year,
// the customer's trims or All trims, nearest first, interior prefill), with screenshots.
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
const SHOTS = path.join(os.homedir(), "Downloads/levr-offer-entry-chunk6-2026-10-30"); fs.mkdirSync(SHOTS, { recursive: true });
const MANIFEST = ROOT + "/.next/dev/server/server-reference-manifest.json";
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}-${crypto.randomUUID().slice(0, 6)}`, pw = `Oe6!${ts}aA`;
const NEW = "x", OLD = "y";
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
  must(await a.from("customers").update({ first_name: "Jordan", last_name: "Verify" }).eq("id", cu.id), "name");
  const now = new Date().toISOString();
  const sid = must(await a.from("customer_searches").insert({ customer_id: cu.id, zip: "28546", make: "Toyota", model: "Camry", model_year: 2026, trim: "SE", search_status: "searching", paid_at: now, finalized_at: now, solidified_at: now }).select("id").single(), "search").id;
  searches.push(sid);
  must(await a.from("search_trim_preferences").insert({ search_id: sid, trim: "SE", model_year: 2026, rank_position: 1, excluded: false }), "trim pref");
  must(await a.from("search_option_selections").insert([
    { search_id: sid, category: "exterior_color", question_kind: "ranked", selection: "Ice Cap", rank_position: 1, excluded: false, price_unknown: false },
    { search_id: sid, category: "interior", question_kind: "ranked", selection: "Black SofTex", rank_position: 1, excluded: false, price_unknown: false },
  ]), "selections");
  const all = must(await a.from("listings").select("id, trim, year, interior:raw_data->>interior_color").eq("make", "Toyota").eq("model", "Camry"), "listings");
  const se26 = all.filter((l) => l.year === 2026 && (l.trim ?? "").toLowerCase() === "se").length;
  const any26 = all.filter((l) => l.year === 2026).length;
  ok("real synced data: 2026 Camry listings, some SE", se26 > 0 && any26 > se26, `${se26} SE of ${any26}`);

  const email = `${PFX}-agent@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
  const L = must(await a.from("agents").insert({ email, name: "Claude Verify Agent", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(L.id);
  const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
  must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: L.id, p_auth_user_id: u.id }), "link");
  let secret; { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
    must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut(); secret = en.totp.secret; }

  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "oe6-")) });
  const ap = await (await browser.createBrowserContext()).newPage(); ap.setDefaultTimeout(300000); await ap.setViewport({ width: 1440, height: 900 });
  await sleep(31000);
  await go(ap, "/agent"); await ap.type('input[name="email"]', email); await ap.type('input[name="password"]', pw);
  await ap.click('form:has(input[name="password"]) button[type="submit"]'); await ap.waitForSelector('input[name="code"]'); await ap.type('input[name="code"]', totp(secret));
  await ap.click('form:has(input[name="code"]) button[type="submit"]'); await ap.waitForFunction(() => location.pathname !== "/agent", { timeout: 240000, polling: 300 });
  await go(ap, `/internal/outreach/${sid}/offer`); await waitText(ap, "Your customer's trims");
  const rowsOf = () => ap.evaluate(() => [...document.querySelectorAll("tbody tr")].filter((r) => r.querySelector('input[name="listing"]')).map((r) => [...r.querySelectorAll("td")].map((td) => td.innerText.trim())));
  const r1 = await rowsOf();
  ok("customer's trims: one row per 2026 SE listing", r1.length === se26, `${r1.length} vs ${se26}`);
  const miles = r1.map((r) => Number(r[2])).filter((n) => !Number.isNaN(n));
  ok("nearest first", miles.every((m, i) => i === 0 || m >= miles[i - 1]), miles.slice(0, 6).join(","));
  ok("columns: dealer, miles, exterior, interior, stock #, VIN last 8, listed price", (await bodyText(ap)).includes("VIN (last 8)") && r1.every((r) => /^….{8}$/.test(r[6])));
  await shot(ap, "01-picker-customer-trims");
  await ap.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "All trims").click()); await sleep(500);
  const r2 = await rowsOf();
  ok("All trims: every 2026 listing", r2.length === any26, `${r2.length} vs ${any26}`);
  await shot(ap, "02-picker-all-trims");
  const withInterior = all.find((l) => l.year === 2026 && l.interior);
  await ap.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Your customer's trims").click()); await sleep(300);
  await ap.evaluate(() => document.querySelector('tbody tr input[name="listing"]').click()); await sleep(500);
  const filled = await ap.evaluate(() => { const ls = [...document.querySelectorAll("label")]; const f = (t) => ls.find((l) => l.textContent.startsWith(t))?.parentElement.querySelector("input")?.value ?? ""; return { dealer: f("Dealership"), vin: f("VIN"), interior: f("Interior") }; });
  ok("picking a row fills the dealer, VIN and interior", !!filled.dealer && filled.vin.length === 17 && (filled.interior !== "" || !withInterior), JSON.stringify(filled));
  await shot(ap, "03-picker-picked");
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
