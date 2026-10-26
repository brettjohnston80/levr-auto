// Chunk 1e: two-factor reset (the function the 1g "Reset two-factor" action calls).
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g,""); }
const { resetAgentTwoFactor, twoFactorResetEmail } = await import("../gen/real/agent-two-factor-reset.mjs");
const env = process.env; const a = createAdminClient(); const BASE = "http://localhost:3100"; const OUT = path.join(LOGS, "shots");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), pw = `Reset!${ts}aA`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const logins = []; const agentIds = []; const secrets = {}; const emailsLogged = [];
const origLog = console.log; console.log = (...x) => { const line = x.map((v) => typeof v === "string" ? v : JSON.stringify(v)).join(" "); if (line.includes("email suppressed")) emailsLogged.push(line); else origLog(...x); };
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const { data: admin } = await a.from("agents").select("id, email").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(admin.id);
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 300000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c1e-")) });
const path_ = (p) => new URL(p.url()).pathname;
async function ctxPage() { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 }); p.setDefaultTimeout(240000); return p; }
async function go(p, u) { await p.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
async function submitAndWait(p, pred) { await p.click('form button[type="submit"]'); await p.waitForFunction(pred, { timeout: 240000, polling: 300 }).catch(() => {}); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
async function signIn(p, email) { await go(p, "/agent"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await submitAndWait(p, () => !!document.querySelector('input[name="code"]') || location.pathname !== "/agent");
  if (secrets[email] && await p.$('input[name="code"]')) { await p.type('input[name="code"]', totp(secrets[email])); await submitAndWait(p, () => location.pathname !== "/agent"); } }
async function mkAgent(tag, role) {
  const email = `claude-verify-${ts}-${tag}@levrauto-test.invalid`;
  const { data: u, error } = await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }); if (error) throw error; logins.push(u.user.id);
  const { data: ag, error: ie } = await a.from("agents").insert({ email, name: `CLAUDE VERIFY ${tag.toUpperCase()}`, role: "agent", in_rotation: false }).select("id").single(); if (ie) throw ie; agentIds.push(ag.id);
  const { error: le } = await a.rpc("link_agent_login", { p_actor_agent_id: admin.id, p_agent_id: ag.id, p_auth_user_id: u.user.id }); if (le) throw le;
  if (role !== "agent") { const { error: re } = await a.rpc("set_agent_role", { p_actor_agent_id: admin.id, p_subject_agent_id: ag.id, p_role: role, p_in_rotation: false }); if (re) throw re; }
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
  const { error: ve } = await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }); if (ve) throw ve; await c.auth.signOut(); secrets[email] = en.totp.secret;
  return { id: ag.id, email, userId: u.user.id };
}
try {
  const P = await mkAgent("plain", "agent"), L = await mkAgent("lead", "lead"), L2 = await mkAgent("lead2", "lead"), T = await mkAgent("target", "agent");
  // refusals
  for (const [label, actor, subject, msg] of [
    ["plain agent resets an agent", P, T, "Only leads and admins can reset an agent's two-factor sign-in."],
    ["lead resets own", L, L, "You can't reset your own two-factor sign-in."],
    ["lead resets another lead", L, L2, "Only admins can reset a lead's or an admin's two-factor sign-in."],
    ["admin resets own", { id: admin.id }, { id: admin.id }, "You can't reset your own two-factor sign-in."],
  ]) { const r = await resetAgentTwoFactor({ actorAgentId: actor.id, subjectAgentId: subject.id }); ok(`${label} → refused`, !r.ok && r.error === msg, r.error); }
  { const { data: f } = await a.auth.admin.mfa.listFactors({ userId: T.userId }); ok("refusals changed nothing (target still has its authenticator)", f.factors.length === 1); }
  // the target signed in on TWO devices, both fully (password + code)
  const d1 = await ctxPage(); await signIn(d1, T.email); const d2 = await ctxPage(); await signIn(d2, T.email);
  ok("target signed in on two devices", path_(d1) === "/internal/outreach" && path_(d2) === "/internal/outreach", `${path_(d1)} / ${path_(d2)}`);
  const e0 = emailsLogged.length;
  const r = await resetAgentTwoFactor({ actorAgentId: L.id, subjectAgentId: T.id });
  ok("lead resets an agent → done", r.ok && r.sessionsEnded >= 2 && r.factorsRemoved === 1 && r.emailed, JSON.stringify(r));
  const { data: f1 } = await a.auth.admin.mfa.listFactors({ userId: T.userId }); ok("target's authenticators removed", f1.factors.length === 0, `${f1.factors.length} left`);
  for (const [n, d] of [["device 1", d1], ["device 2", d2]]) { await go(d, "/internal/outreach");
    ok(`target's open session on ${n} signed out (→ /agent password step)`, path_(d) === "/agent" && !!(await d.$('input[name="password"]')) && !(await d.$('input[name="code"]')), path_(d)); }
  ok("no auth cookie survives on device 1", !(await d1.cookies()).some((x) => x.name.includes("auth-token") && x.value));
  ok("target emailed once (suppressed: test address), signed-off subject", emailsLogged.length - e0 === 1 && emailsLogged.at(-1).includes("Your LEVR Auto two-factor sign-in was reset") && emailsLogged.at(-1).includes(T.email), emailsLogged.at(-1));
  ok("email says 'right away'", twoFactorResetEmail("X").html.includes("contact X right away."), twoFactorResetEmail("X").html);
  { const { data: act } = await a.from("agent_activity_log").select("action, details").eq("agent_id", L.id).eq("action", "agent_two_factor_reset");
    ok("logged agent_two_factor_reset by the lead", act.length === 1 && act[0].details.agent_id === T.id && act[0].details.factors_removed === 1 && act[0].details.sessions_ended >= 2, JSON.stringify(act[0]?.details)); }
  { const q = await ctxPage(); await go(q, "/agent"); await q.type('input[name="email"]', T.email); await q.type('input[name="password"]', pw);
    await submitAndWait(q, () => location.pathname !== "/agent" || !!document.querySelector('input[name="code"]'));
    ok("target's next sign-in → set up two-factor again", path_(q) === "/agent/enroll", path_(q)); await q.browserContext().close(); }
  { const r2 = await resetAgentTwoFactor({ actorAgentId: admin.id, subjectAgentId: L2.id }); ok("admin resets a lead → done", r2.ok && r2.factorsRemoved === 1, JSON.stringify(r2)); }
  { const pl = await ctxPage(); await signIn(pl, L.email); ok("the lead who did the reset is unaffected", path_(pl) === "/internal/outreach", path_(pl)); await pl.browserContext().close(); }
  for (const d of [d1, d2]) await d.browserContext().close();
  // the email, rendered (signed-off wording)
  { const e = twoFactorResetEmail("Brett Johnston"); const q = await ctxPage(); await q.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await q.setContent(`<html><body style="background:#fff;color:#111;font-family:-apple-system,Helvetica,Arial;margin:24px;max-width:640px;font-size:16px;line-height:1.5"><p style="color:#555;font-size:13px">Subject: <b style="color:#111">${e.subject}</b></p>${e.html}</body></html>`);
    for (const [vp, tag] of [[{ width: 1280, height: 400, deviceScaleFactor: 2 }, "desktop"], [{ width: 390, height: 500, deviceScaleFactor: 3 }, "phone"]]) { await q.setViewport(vp); await q.screenshot({ path: path.join(OUT, `agent-1e-reset-email-${tag}.png`) }); }
    await q.browserContext().close(); }
} catch (e) { fail++; origLog("ERROR", e.stack ?? e); }
finally {
  await browser.close();
  for (const id of agentIds) await a.from("agent_activity_log").delete().eq("agent_id", id);
  await a.from("agent_activity_log").delete().eq("agent_id", admin.id).gte("created_at", runStart);
  for (const id of agentIds) await a.from("agents").delete().eq("id", id);
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  let ul = 0; for (const id of logins) if ((await a.auth.admin.getUserById(id)).data?.user) ul++;
  const { count: agl } = await a.from("agents").select("id", { count: "exact", head: true }).ilike("email", `claude-verify-${ts}%`);
  const b1 = await cnt(brett.id), ad1 = await cnt(admin.id);
  origLog(`CLEANUP: logins ${ul} | test agents ${agl} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (ul || agl || b1 !== b0 || ad1 !== ad0) { fail++; origLog("FAIL  cleanup not back to zero"); }
  origLog(`${pass} passed, ${fail} failed`);
}
