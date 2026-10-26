import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createAdminClient } from "../lib/admin.mjs";
const a = createAdminClient(); const BASE = "http://localhost:3100"; const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString();
const email = `claude-verify-${ts}-key@levrauto-test.invalid`, pw = `Key!${ts}aA`; let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const { data: admin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count; const b0 = await cnt(brett.id);
const { data: u } = await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } });
const { data: ag } = await a.from("agents").insert({ email, name: "CLAUDE VERIFY KEY AGENT", role: "agent", in_rotation: false }).select("id").single();
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c1c-key-")) });
try {
  await a.rpc("link_agent_login", { p_actor_agent_id: admin.id, p_agent_id: ag.id, p_auth_user_id: u.user.id });
  const ctx = await browser.createBrowserContext(); await ctx.overridePermissions(BASE, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"]);
  const p = await ctx.newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto(BASE + "/agent", { waitUntil: "networkidle0", timeout: 180000 });
  await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await Promise.all([p.waitForNavigation({ timeout: 60000 }).catch(() => {}), p.click('button[type="submit"]')]); await new Promise((r) => setTimeout(r, 1500));
  await p.waitForSelector("details summary", { timeout: 60000 }).catch(() => {});
  { const { data: fl } = await a.auth.admin.mfa.listFactors({ userId: u.user.id }); ok("exactly one authenticator started for the visit", fl.factors.length === 1, JSON.stringify(fl.factors.map((x) => x.status))); }
  ok("agent with no authenticator → turn-on page", new URL(p.url()).pathname === "/agent/enroll", new URL(p.url()).pathname);
  await p.waitForSelector("details summary", { timeout: 60000 }); await p.click("details summary"); await new Promise((r) => setTimeout(r, 300));
  const shown = await p.evaluate(() => document.querySelector('[aria-label="Authenticator key"]').textContent);
  ok("key shown in groups of four", /^([A-Z2-7]{4} )+[A-Z2-7]{1,4}$/.test(shown), shown);
  await p.tap("details button"); await new Promise((r) => setTimeout(r, 300));
  const label = await p.evaluate(() => document.querySelector("details button").textContent);
  const copied = await p.evaluate(() => navigator.clipboard.readText());
  ok("Copy key copies the key without spaces, button says Copied", copied === shown.replace(/ /g, "") && label === "Copied", `${copied} / ${label}`);
  await p.mouse.move(0, 0);
  await p.screenshot({ path: path.join(LOGS, "shots", "agent-1c-07-enroll-key-shown-phone.png"), fullPage: true });
  await p.type('input[name="code"]', totp(copied));
  await Promise.all([p.waitForNavigation({ timeout: 60000 }).catch(() => {}), p.click('form button[type="submit"]')]);
  ok("code from the copied key turns two-factor on", new URL(p.url()).pathname === "/internal/outreach", new URL(p.url()).pathname);
} catch (e) { fail++; console.log("ERROR", e.message); }
finally {
  await browser.close();
  await a.from("agent_activity_log").delete().eq("agent_id", ag.id); await a.from("agent_activity_log").delete().eq("agent_id", admin.id).gte("created_at", runStart);
  await a.from("agents").delete().eq("id", ag.id); await a.auth.admin.deleteUser(u.user.id); await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const left = (await a.auth.admin.getUserById(u.user.id)).data?.user ? 1 : 0; const { count: al } = await a.from("agents").select("id", { count: "exact", head: true }).eq("id", ag.id);
  console.log(`CLEANUP: login ${left} | agent ${al} | Brett activity ${b0} -> ${await cnt(brett.id)}`); console.log(`${pass} passed, ${fail} failed`);
}
