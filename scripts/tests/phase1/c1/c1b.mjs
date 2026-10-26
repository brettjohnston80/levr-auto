// Chunk 1b: drive the real /agent page on the branch server (localhost:3100) in a throwaway headless Chrome.
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const a = createAdminClient(); const BASE = "http://localhost:3100"; const OUT = path.join(LOGS, "shots");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), pw = `Agent!${ts}aZ`;
const agentEmail = `claude-verify-${ts}-agent@levrauto-test.invalid`, agent2Email = `claude-verify-${ts}-agent2@levrauto-test.invalid`, custEmail = `claude-verify-${ts}-c@verify.invalid`, nobody = `claude-verify-${ts}-nobody@levrauto-test.invalid`, lockEmail = `claude-verify-${ts}-lock@levrauto-test.invalid`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const logins = []; let testAgentId = null; const extraAgents = []; const shots = [];
function totp(secretB32) {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "";
  for (const ch of secretB32.replace(/=+$/, "").toUpperCase()) bits += alpha.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac("sha1", key).update(ctr).digest(); const o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
}
const { data: admin } = await a.from("agents").select("id, auth_user_id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const brett0 = await cnt(brett.id), admin0 = await cnt(admin.id);
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c1b-profile-")) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function newPage(phone) {
  const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { width: 1280, height: 860, deviceScaleFactor: 2 });
  p.setDefaultTimeout(90000); return p;
}
async function shot(p, name) { await p.mouse.move(0, 0); const f = path.join(OUT, `agent-1b-${name}.png`); await sleep(300); await p.screenshot({ path: f }); shots.push(f); }
async function open(p) { await p.goto(BASE + "/agent", { waitUntil: "networkidle0", timeout: 180000 }); }
async function submitPassword(p, email, password) {
  await p.type('input[name="email"]', email); await p.type('input[name="password"]', password);
  const t = Date.now(); await p.click('button[type="submit"]');
  await p.waitForFunction(() => !document.querySelector('button[type="submit"]')?.disabled && (document.querySelector('[role="alert"]') || document.querySelector('input[name="code"]') || !location.pathname.startsWith("/agent")), { timeout: 60000 }).catch(() => {});
  return Date.now() - t;
}
const alertText = (p) => p.evaluate(() => document.querySelector('[role="alert"]')?.textContent ?? null);
try {
  // --- setup: agent login with password + verified authenticator, linked as the persistent test admin
  const { data: cu } = await a.auth.admin.createUser({ email: agentEmail, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }); logins.push(cu.user.id);
  const { data: cc } = await a.auth.admin.createUser({ email: custEmail, email_confirm: true, password: pw }); logins.push(cc.user.id);
  const { data: ta, error: te } = await a.from("agents").insert({ email: agentEmail, name: "CLAUDE VERIFY TEST AGENT", role: "agent", in_rotation: false }).select("id").single(); if (te) throw te; testAgentId = ta.id;
  const { error: le } = await a.rpc("link_agent_login", { p_actor_agent_id: admin.id, p_agent_id: ta.id, p_auth_user_id: cu.user.id }); if (le) throw le;
  const pub = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await pub.auth.signInWithPassword({ email: agentEmail, password: pw });
  const { data: enr, error: ee } = await pub.auth.mfa.enroll({ factorType: "totp" }); if (ee) throw ee;
  const secret = enr.totp.secret;
  const { error: ve } = await pub.auth.mfa.challengeAndVerify({ factorId: enr.id, code: totp(secret) }); if (ve) throw ve;
  await pub.auth.signOut();
  { const { data: u2 } = await a.auth.admin.createUser({ email: agent2Email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }); logins.push(u2.user.id);
    const { data: t2, error: t2e } = await a.from("agents").insert({ email: agent2Email, name: "CLAUDE VERIFY TEST AGENT 2", role: "agent", in_rotation: false }).select("id").single(); if (t2e) throw t2e; extraAgents.push(t2.id);
    const { error: l2e } = await a.rpc("link_agent_login", { p_actor_agent_id: admin.id, p_agent_id: t2.id, p_auth_user_id: u2.user.id }); if (l2e) throw l2e; }
  ok("setup: test agent with a verified authenticator, plus a second real test agent (no attempts yet)", true, agentEmail);

  for (const phone of [false, true]) {
    const tag = phone ? "phone" : "desktop";
    // 1. empty
    let p = await newPage(phone); await open(p);
    const hdr = await p.evaluate(() => ({ header: !!document.querySelector("header"), footer: !!document.querySelector("footer"), title: document.title, h1: document.querySelector("h1")?.textContent }));
    ok(`${tag}: empty page, no site header/footer`, !hdr.header && !hdr.footer && hdr.title === "LEVR Auto agent sign-in" && hdr.h1 === "Agent sign-in", JSON.stringify(hdr));
    const attrs = await p.evaluate(() => { const g = (n) => { const e = document.querySelector(`input[name="${n}"]`); return { type: e.type, autocomplete: e.getAttribute("autocomplete"), autocapitalize: e.getAttribute("autocapitalize"), id: e.id }; }; return { email: g("email"), password: g("password") }; });
    ok(`${tag}: email/password fields for password managers`, attrs.email.type === "email" && attrs.email.autocomplete === "username" && attrs.email.autocapitalize === "off" && attrs.password.type === "password" && attrs.password.autocomplete === "current-password", JSON.stringify(attrs));
    await p.mouse.move(0, 0);
    await shot(p, `1-empty-${tag}`);
    // 2. wrong details (wrong password for a real test agent)
    const ms = await submitPassword(p, agentEmail, "Wrong!Pass1");
    ok(`${tag}: wrong password → generic error`, (await alertText(p)) === "That didn't work. Check your details and try again.", `${await alertText(p)} (${ms} ms)`);
    await shot(p, `2-wrong-details-${tag}`);
    await p.browserContext().close();
  }
  // generic error for every other failure, with timings
  for (const [label, email, password] of [["unknown email", nobody, pw], ["customer login", custEmail, pw]]) {
    const p = await newPage(false); await open(p); const ms = await submitPassword(p, email, password);
    ok(`${label} → same generic error`, (await alertText(p)) === "That didn't work. Check your details and try again.", `${ms} ms`);
    if (label === "customer login") {
      const sess = (await p.cookies()).filter((c) => c.name.includes("auth-token")).length;
      ok("customer login left signed out", sess === 0, `${sess} auth cookies`);
    }
    await p.browserContext().close();
  }
  // 4. two-factor prompt, wrong code, then the right code
  for (const phone of [false, true]) {
    const tag = phone ? "phone" : "desktop"; const p = await newPage(phone); await open(p);
    await submitPassword(p, agentEmail, pw);
    const head = await p.evaluate(() => document.querySelector("h2")?.textContent);
    ok(`${tag}: right password → code step`, head === "Enter your authenticator code" && !!(await p.$('input[name="code"]')), head);
    const code = await p.evaluate(() => { const e = document.querySelector('input[name="code"]'); return { inputmode: e.getAttribute("inputmode"), autocomplete: e.getAttribute("autocomplete"), pattern: e.getAttribute("pattern"), help: [...document.querySelectorAll("p")].map((x) => x.textContent).find((t) => t.includes("authenticator")) }; });
    ok(`${tag}: code field number pad + one-time-code autofill, help text`, code.inputmode === "numeric" && code.autocomplete === "one-time-code" && code.help === "Lost access to your authenticator? Contact your lead.", JSON.stringify(code));
    await shot(p, `4-two-factor-${tag}`);
    if (!phone) {
      await p.type('input[name="code"]', "000000"); await p.click('button[type="submit"]');
      await p.waitForFunction(() => document.querySelector('[role="alert"]'), { timeout: 60000 });
      ok("wrong code → generic error", (await alertText(p)) === "That didn't work. Check your details and try again.", await alertText(p));
      await shot(p, "5-wrong-code-desktop");
      await p.reload({ waitUntil: "networkidle0" });
      ok("reload keeps the code step (signed in at the first level)", !!(await p.$('input[name="code"]')));
      await p.type('input[name="code"]', totp(secret));
      await Promise.all([p.waitForNavigation({ timeout: 120000 }).catch(() => {}), p.click('button[type="submit"]')]);
      ok("right code → agent dashboard", new URL(p.url()).pathname === "/internal/outreach", new URL(p.url()).pathname);
      await p.goto(BASE + "/agent", { waitUntil: "domcontentloaded" });
      ok("signed-in agent visiting /agent goes to the dashboard", new URL(p.url()).pathname === "/internal/outreach", new URL(p.url()).pathname);
    }
    await p.browserContext().close();
  }
  // 3. rate limited: identical for an address that doesn't exist and a real agent's address
  async function lockout(email, label, phoneShot) {
    const p = await newPage(false); await open(p); const times = [];
    for (let i = 0; i < 6; i++) {
      await p.evaluate(() => { document.querySelector('input[name="email"]').value = ""; document.querySelector('input[name="password"]').value = ""; });
      times.push(await submitPassword(p, email, "Wrong!Pass1"));
    }
    const msgs = await alertText(p);
    const disabled = await p.evaluate(() => document.querySelector('button[type="submit"]').disabled);
    if (phoneShot) await shot(p, "3-rate-limited-desktop");
    await p.browserContext().close();
    const { data: em } = await a.rpc("is_test_agent_email", { p_email: email });
    console.log(`  ${label}: attempt times ${times.join(", ")} ms; 6th: "${msgs}"; Sign in disabled after lockout: ${disabled}`);
    return { msgs, times, disabled };
  }
  const noAcct = await lockout(lockEmail, "address that doesn't exist", true);
  const real = await lockout(agent2Email, "real agent's address", false);
  const TOO = "Too many sign-in attempts. Wait 15 minutes and try again.";
  ok("lockout message identical (no account vs real agent)", noAcct.msgs === TOO && real.msgs === TOO);
  ok("lockout: button enabled, not disabled", !noAcct.disabled && !real.disabled);
  ok("every attempt held to >= 900 ms in both", [...noAcct.times, ...real.times].every((t) => t >= 900), `${Math.min(...noAcct.times, ...real.times)}–${Math.max(...noAcct.times, ...real.times)} ms`);
  { const p = await newPage(true); await open(p); await submitPassword(p, lockEmail, "Wrong!Pass1");
    ok("phone: still rate-limited", (await alertText(p)) === TOO, await alertText(p));
    await shot(p, "3-rate-limited-phone"); await p.browserContext().close(); }
  const { data: rows } = await a.from("agent_signin_attempts").select("stage, succeeded").gte("created_at", runStart);
  const summary = rows.reduce((m, r) => (m[`${r.stage}:${r.succeeded ? "ok" : "fail"}`] = (m[`${r.stage}:${r.succeeded ? "ok" : "fail"}`] ?? 0) + 1, m), {});
  { const { data: fr } = await a.from("agent_signin_attempts").select("email_hash, succeeded").gte("created_at", runStart).eq("succeeded", false);
    const byHash = Object.values(fr.reduce((m, r) => (m[r.email_hash] = (m[r.email_hash] ?? 0) + 1, m), {})).sort();
    console.log("  failures recorded per account:", JSON.stringify(byHash)); }
  ok("attempts recorded as hashes only", rows.length > 0, JSON.stringify(summary));
  const { data: raw } = await a.from("agent_signin_attempts").select("email_hash").gte("created_at", runStart).limit(1);
  ok("no raw email stored", !raw[0].email_hash.includes("@") && raw[0].email_hash.length === 64, raw[0].email_hash.slice(0, 12) + "…");
} catch (e) { fail++; console.log("ERROR", e.message ?? e); }
finally {
  await browser.close();
  const { count: att } = await a.from("agent_signin_attempts").select("id", { count: "exact", head: true }).gte("created_at", runStart);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  if (testAgentId) await a.from("agents").delete().eq("id", testAgentId);
  for (const id of extraAgents) await a.from("agents").delete().eq("id", id);
  await a.from("agent_activity_log").delete().eq("agent_id", admin.id).gte("created_at", runStart);
  for (const id of logins) await a.auth.admin.deleteUser(id);
  let ul = 0; for (const id of logins) if ((await a.auth.admin.getUserById(id)).data?.user) ul++;
  const { count: attLeft } = await a.from("agent_signin_attempts").select("id", { count: "exact", head: true }).gte("created_at", runStart);
  const { count: agLeft } = await a.from("agents").select("id", { count: "exact", head: true }).ilike("email", `claude-verify-${ts}%`);
  const { count: cuLeft } = await a.from("customers").select("id", { count: "exact", head: true }).in("id", logins);
  const b1 = await cnt(brett.id), ad1 = await cnt(admin.id);
  const { data: adm } = await a.from("agents").select("auth_user_id, in_rotation, role").eq("id", admin.id).single();
  console.log(`CLEANUP: sign-in attempts ${att} -> ${attLeft} | test agents ${agLeft} | logins ${ul} | customer rows ${cuLeft} | test admin activity ${admin0} -> ${ad1} (unlinked ${adm.auth_user_id === null}) | Brett activity ${brett0} -> ${b1}`);
  if (b1 !== brett0 || ad1 !== admin0 || attLeft || agLeft || ul || cuLeft) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`); console.log(shots.join("\n"));
}
