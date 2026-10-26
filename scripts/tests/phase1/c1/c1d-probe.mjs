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
// Current id, from lib/action-ids.mjs (ids change when files move).
const SEARCH_CUSTOMERS = JSON.parse(fs.readFileSync(new URL("./gated-ids.json", import.meta.url))).searchCustomers[0];
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
async function callSearchCustomers(p, q) { return p.evaluate(async (id, q) => { const r = await fetch("/internal/outreach", { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify([q]) }); return `${r.status} ${(await r.text()).slice(-300)}`; }, SEARCH_CUSTOMERS, q); }
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

  const show = async (label, p) => { const r = await p.evaluate(async (id, q) => { const res = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify([q]) }); return `${res.status} [${location.pathname}] ${(await res.text()).replace(/\n/g, " ").slice(0, 400)}`; }, SEARCH_CUSTOMERS, emailC); console.log(label, "=>", r); };
  { const p = await ctxPage(); await agentPassword(p, emailA); await show("password-only, posted from /agent", p); await p.browserContext().close(); }
  { const p = await ctxPage(); await agentFull(p, emailA, secret); await go(p, "/internal/outreach"); await show("full, posted from /internal/outreach", p); await p.browserContext().close(); }
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
