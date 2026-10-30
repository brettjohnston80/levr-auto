// Chunk 1d: agent checks on every agent page/action, customer pages refuse agent logins, no marketing header on /internal.
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const a = createAdminClient(); const BASE = "http://localhost:3100"; const OUT = path.join(LOGS, "shots");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), pw = `OneD!${ts}aA`;
const emailA = `claude-verify-${ts}-a@levrauto-test.invalid`, emailB = `claude-verify-${ts}-b@levrauto-test.invalid`, emailC = `claude-verify-${ts}-c@verify.invalid`;
const PAGES = ["/internal/outreach", "/internal/admin", "/internal/articles", "/internal/dealerships", "/internal/refunds-due", "/internal/social"];
// Current action id for searchCustomers, from the dev server's manifest (ids change when files move).
const SEARCH_CUSTOMERS = (() => { const m = JSON.parse(fs.readFileSync((ROOT + "/.next/dev/server/server-reference-manifest.json"), "utf8"));
  for (const [id, v] of Object.entries(m.node)) for (const w of Object.values(v.workers)) { const q = decodeURIComponent((w.moduleId.split("actions=")[1] ?? "").split("&")[0]);
    try { for (const [file, list] of JSON.parse(q)) if (file.endsWith("agent-bypass-lookup.ts") && list.some((x) => (x.exportedName ?? x.name) === "searchCustomers" && x.id === id)) return id; } catch {} }
  throw new Error("searchCustomers id not found; load an /internal page first"); })();
const LEAD_ONLY = ["/internal/admin", "/internal/articles", "/internal/social"]; // C16
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const shots = []; const logins = []; const agentIds = [];
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const { data: admin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(admin.id);
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 300000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c1d-")) });
const DESK = { width: 1280, height: 900, deviceScaleFactor: 2 }, PHONE = { width: 390, height: 844, deviceScaleFactor: 3 };
async function ctxPage() { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport(DESK); p.setDefaultTimeout(240000); return p; }
const path_ = (p) => new URL(p.url()).pathname;
async function go(p, u) { await p.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
async function submitAndWait(p, pred) { await p.click('form button[type="submit"]'); await p.waitForFunction(pred, { timeout: 240000, polling: 300 }).catch(() => {}); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
async function agentPassword(p, email) { await go(p, "/agent"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await submitAndWait(p, () => !!document.querySelector('input[name="code"]') || location.pathname !== "/agent" || !!document.querySelector('[role="alert"]')); }
async function agentFull(p, email, secret) { await agentPassword(p, email); await p.type('input[name="code"]', totp(secret)); await submitAndWait(p, () => location.pathname !== "/agent"); }
async function callSearchCustomers(p, q) { return p.evaluate(async (id, q) => { const r = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify([q]) }); return `${r.status} ${await r.text()}`; }, SEARCH_CUSTOMERS, q); }
const refused = (r) => r.includes('{"error":"Not authorized."}');
try {
  // setup: agent A (password + authenticator), agent B (password, no authenticator), customer C
  const mk = async (email, agent) => { const { data, error } = await a.auth.admin.createUser({ email, email_confirm: true, password: pw, ...(agent ? { app_metadata: { account_type: "agent" } } : {}) }); if (error) throw error; logins.push(data.user.id); return data.user.id; };
  const uA = await mk(emailA, true), uB = await mk(emailB, true), uC = await mk(emailC, false);
  for (const [email, uid, name] of [[emailA, uA, "CLAUDE VERIFY AGENT A"], [emailB, uB, "CLAUDE VERIFY AGENT B"]]) {
    const { data: ag } = await a.from("agents").insert({ email, name, role: "agent", in_rotation: false }).select("id").single(); agentIds.push(ag.id);
    const { error } = await a.rpc("link_agent_login", { p_actor_agent_id: admin.id, p_agent_id: ag.id, p_auth_user_id: uid }); if (error) throw error;
  }
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: emailA, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
  const { error: ve } = await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }); if (ve) throw ve; await c.auth.signOut();
  const secret = en.totp.secret;

  // 1. signed out → every /internal page goes to /agent
  { const p = await ctxPage(); const res = [];
    for (const u of PAGES) { await go(p, u); res.push(`${u}→${path_(p)}`); }
    ok("signed out: all 6 /internal pages → /agent", res.every((r) => r.endsWith("→/agent")), res.join(" ")); await p.browserContext().close(); }
  // 2. customer login: normal customer sign-in still works; /internal refused
  { const p = await ctxPage(); await go(p, "/login"); await p.type('input[name="email"]', emailC); await p.type('input[name="password"]', pw);
    await submitAndWait(p, () => location.pathname !== "/login");
    ok("customer: /login still signs a customer in (→ where the search stands)", ["/", "/account"].includes(path_(p)) || path_(p).startsWith("/account/"), path_(p));
    await go(p, "/internal/outreach"); ok("customer: /internal/outreach → /agent", path_(p) === "/agent", path_(p));
    ok("customer: lookup action refused", refused(await callSearchCustomers(p, emailC)));
    await p.browserContext().close(); }
  // 3. agent at the customer sign-in → refused with the usual wrong-details message, no session
  { const p = await ctxPage(); await go(p, "/login"); await p.type('input[name="email"]', emailA); await p.type('input[name="password"]', pw);
    await submitAndWait(p, () => location.search.includes("error") || location.pathname !== "/login");
    const txt = await p.evaluate(() => document.body.innerText);
    ok("agent at /login → 'Invalid login credentials', stays signed out", path_(p) === "/login" && txt.includes("Invalid login credentials") && (await p.cookies()).filter((x) => x.name.includes("auth-token")).length === 0, path_(p));
    await p.browserContext().close(); }
  // 4. agent, password only (no code yet): pages → code step; actions refused
  { const p = await ctxPage(); await agentPassword(p, emailA);
    ok("agent A password step → code step", !!(await p.$('input[name="code"]')));
    const res = []; for (const u of PAGES) { await go(p, u); res.push(`${u}→${path_(p)}`); }
    ok("password only: all 6 /internal pages → /agent (code step)", res.every((r) => r.endsWith("→/agent")) && !!(await p.$('input[name="code"]')), res.join(" "));
    await go(p, "/agent"); ok("password only: lookup action refused", refused(await callSearchCustomers(p, emailC)));
    await go(p, "/account"); ok("agent login on a customer page (/account) → sent away", path_(p) !== "/account", path_(p));
    await p.browserContext().close(); }
  // 5. agent with no authenticator → enrollment
  { const p = await ctxPage(); await agentPassword(p, emailB);
    ok("agent B (no authenticator) → /agent/enroll", path_(p) === "/agent/enroll", path_(p));
    await go(p, "/internal/outreach"); ok("agent B: /internal/outreach → /agent/enroll", path_(p) === "/agent/enroll", path_(p));
    await p.browserContext().close(); }
  // 6. agent A fully signed in: every page, no marketing header, agent header; screenshots
  const p = await ctxPage(); await agentFull(p, emailA, secret);
  ok("agent A with code → dashboard", path_(p) === "/internal/outreach", path_(p));
  for (const u of PAGES) {
    await go(p, u);
    const info = await p.evaluate(() => ({ siteNav: [...document.querySelectorAll("a")].some((x) => ["How It Works", "Matchmaker", "FAQ"].includes(x.textContent?.trim())), footer: !!document.querySelector("footer"), agentHeader: document.querySelector("header")?.innerText ?? "" }));
    const want = LEAD_ONLY.includes(u) ? "/internal/outreach" : u; // agent A is a plain agent (C16)
    ok(`${u}: ${want === u ? "loads" : "plain agent sent to outreach (C16)"}, no marketing header/footer, agent header`, path_(p) === want && !info.siteNav && !info.footer && info.agentHeader.includes("LEVR Auto · Agent") && info.agentHeader.includes("CLAUDE VERIFY AGENT A") && info.agentHeader.includes("Sign out"), JSON.stringify({ at: path_(p), ...info, agentHeader: info.agentHeader.replace(/\n/g, " / ") }));
    const name = u.replace("/internal/", "");
    for (const [vp, tag] of [[DESK, "desktop"], [PHONE, "phone"]]) { await p.setViewport(vp); await sleep(600); await p.mouse.move(0, 0); const f = path.join(OUT, `agent-1d-${name}-${tag}.png`); await p.screenshot({ path: f }); shots.push(path.basename(f)); }
    await p.setViewport(DESK);
  }
  { const r = await callSearchCustomers(p, emailC); ok("fully signed in: lookup action works (finds the test customer)", r.includes(emailC) && !refused(r)); }
  await go(p, "/account"); ok("fully signed-in agent on /account → /internal/outreach", path_(p) === "/internal/outreach", path_(p));
  await go(p, "/finalize/00000000-0000-0000-0000-000000000000"); ok("…and on /finalize/… → /internal/outreach", path_(p) === "/internal/outreach", path_(p));
  const seen = (await p.cookies()).find((x) => x.name === "levr_agent_seen");
  ok("activity cookie set (httpOnly)", !!seen && seen.httpOnly, seen ? `httpOnly ${seen.httpOnly}` : "missing");
  // 7. deactivated mid-session → refused on the next request
  { const p2 = await ctxPage(); await agentFull(p2, emailA, secret);
    const { error: de } = await a.rpc("set_agent_active", { p_actor_agent_id: admin.id, p_subject_agent_id: agentIds[0], p_active: false }); if (de) throw de;
    await go(p2, "/internal/outreach"); ok("deactivated agent: next request → /agent", path_(p2) === "/agent", path_(p2));
    ok("deactivated agent: action refused", refused(await callSearchCustomers(p2, emailC)));
    const { error: re } = await a.rpc("set_agent_active", { p_actor_agent_id: admin.id, p_subject_agent_id: agentIds[0], p_active: true }); if (re) throw re;
    await p2.browserContext().close(); }
  // 8. Sign out
  { await go(p, "/internal/outreach"); await p.click("header form button[type='submit']");
    await p.waitForFunction(() => location.pathname === "/agent", { timeout: 240000, polling: 300 }).catch(() => {});
    const ck = await p.cookies();
    ok("Sign out → /agent, session and activity cookie gone", path_(p) === "/agent" && !ck.some((x) => x.name.includes("auth-token")) && !ck.some((x) => x.name === "levr_agent_seen"), path_(p));
    await go(p, "/internal/outreach"); ok("after sign-out, /internal → /agent", path_(p) === "/agent"); }
  // 9. idle sign-out (test server limit 2 minutes; 8 hours in production)
  { const p3 = await ctxPage(); await agentFull(p3, emailA, secret); await go(p3, "/internal/outreach");
    ok("idle test: signed in", path_(p3) === "/internal/outreach");
    await sleep(70000); await go(p3, "/internal/outreach"); ok("idle test: active again after 70s (under the limit) → still in", path_(p3) === "/internal/outreach", path_(p3));
    await sleep(135000); await go(p3, "/internal/outreach");
    ok("idle test: after 135s idle (over the 2-minute test limit) → signed out to /agent", path_(p3) === "/agent" && !!(await p3.$('input[name="password"]')), path_(p3));
    await p3.browserContext().close(); }
  await p.browserContext().close();
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser.close();
  for (const id of agentIds) { await a.from("agent_activity_log").delete().eq("agent_id", id); await a.from("agents").delete().eq("id", id); }
  await a.from("agent_activity_log").delete().eq("agent_id", admin.id).gte("created_at", runStart);
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  let ul = 0; for (const id of logins) if ((await a.auth.admin.getUserById(id)).data?.user) ul++;
  const { count: agl } = await a.from("agents").select("id", { count: "exact", head: true }).ilike("email", `claude-verify-${ts}%`);
  const { count: cul } = await a.from("customers").select("id", { count: "exact", head: true }).in("id", logins);
  const b1 = await cnt(brett.id), ad1 = await cnt(admin.id);
  console.log(`CLEANUP: logins ${ul} | test agents ${agl} | customer rows ${cul} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (ul || agl || cul || ad1 !== ad0 || b1 !== b0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`); console.log(shots.join("  "));
}
