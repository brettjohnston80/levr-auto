import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const a = createAdminClient(); const BASE = "http://localhost:3100"; const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString();
const email = `claude-verify-${ts}-hang@levrauto-test.invalid`, pw = `Hang!${ts}aA`;
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const T0 = Date.now(); const L = (m) => console.log(`[${Date.now() - T0} ms] ${m}`);
const { data: admin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
L("admin row"); const { data: u } = await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } });
const { data: ag } = await a.from("agents").insert({ email, name: "CLAUDE VERIFY HANG AGENT", role: "agent", in_rotation: false }).select("id").single();
L("login + agent row"); let answered = 0;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "hang-")) });
try {
  L("chrome up"); await a.rpc("link_agent_login", { p_actor_agent_id: admin.id, p_agent_id: ag.id, p_auth_user_id: u.user.id });
  L("linked"); const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
  await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }); await c.auth.signOut();
  L("authenticator on"); for (let i = 1; i <= 4; i++) {
    const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); p.setDefaultTimeout(90000);
    await p.goto(BASE + "/agent", { waitUntil: "networkidle0" });
    await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
    const t = Date.now(); await p.click('button[type="submit"]');
    const got = await p.waitForSelector('input[name="code"], [role="alert"]', { timeout: 90000 }).then(() => "answer").catch(() => "TIMEOUT 90s");
    const ms = Date.now() - t; if (got === "answer" && ms < 30000) answered++;
    console.log(`${got === "answer" && ms < 30000 ? "PASS" : "FAIL"}  try ${i}: ${got} after ${ms} ms`);
    await ctx.close();
  }
} catch (e) { console.log("ERROR", e.message); }
finally {
  await browser.close(); await a.from("agents").delete().eq("id", ag.id); await a.from("agent_activity_log").delete().eq("agent_id", admin.id).gte("created_at", runStart);
  await a.auth.admin.deleteUser(u.user.id); await a.from("agent_signin_attempts").delete().gte("created_at", runStart); console.log("cleanup done"); console.log(`${answered} passed, ${4 - answered} failed`);
}
