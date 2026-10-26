// Chunk 1c: invite → accept → set password → turn on two-factor; reset; forgot password.
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createAdminClient } from "../lib/admin.mjs";
import { addAgent, resendAgentInvite, createAgentSetupLink, inviteEmail, resetEmail } from "../gen/real/agent-invite.mjs";
const a = createAdminClient(); const BASE = "http://localhost:3100"; const OUT = path.join(LOGS, "shots");
const DEVLOG = (LOGS + "/dev3100.log");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString();
const email1 = `claude-verify-${ts}-invite@levrauto-test.invalid`, email2 = `claude-verify-${ts}-reset@levrauto-test.invalid`, custEmail = `claude-verify-${ts}-c@verify.invalid`;
const pw1 = `First!${ts}aA`, pw2 = `Second!${ts}bB`, pw3 = `Third!${ts}cC`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const shots = []; const loginIds = []; const agentIds = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function totp(secretB32, offset = 0) {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "";
  for (const ch of secretB32.replace(/=+$/, "").toUpperCase()) bits += alpha.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = crypto.createHmac("sha1", key).update(ctr).digest(); const o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
}
const { data: admin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const brett0 = await cnt(brett.id), admin0 = await cnt(admin.id);
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 300000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c1c-profile-")) });
const DESK = { width: 1280, height: 900, deviceScaleFactor: 2 }, PHONE = { width: 390, height: 844, deviceScaleFactor: 3 };
async function newPage() { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport(DESK); p.setDefaultTimeout(180000); return p; }
async function both(p, name) { // the same state, desktop then phone width (no reload)
  await p.mouse.move(0, 0);
  for (const [vp, tag] of [[DESK, "desktop"], [PHONE, "phone"]]) { await p.setViewport(vp); await sleep(400); const f = path.join(OUT, `agent-1c-${name}-${tag}.png`); await p.screenshot({ path: f, fullPage: true }); shots.push(f); }
  await p.setViewport(DESK);
}
const go = (p, url) => p.goto(url.startsWith("http") ? url : BASE + url, { waitUntil: "networkidle0", timeout: 180000 });
const alertText = (p) => p.evaluate(() => document.querySelector('[role="alert"]')?.textContent ?? null);
const h1 = (p) => p.evaluate(() => document.querySelector("h1")?.textContent);
async function clickAndSettle(p) {
  const before = p.url();
  const msg = () => p.evaluate(() => [...document.querySelectorAll('[role="alert"],[role="status"]')].map((e) => e.textContent).join("|"));
  const msgBefore = await msg().catch(() => "");
  const codeBefore = await p.$('input[name="code"]').then((e) => !!e);
  await p.click('form button[type="submit"]');
  // Done when the address changes, or a new message (error/confirmation) appears.
  await p.waitForFunction((u, m, c) => location.href !== u || !!document.querySelector('input[name="code"]') !== c || [...document.querySelectorAll('[role="alert"],[role="status"]')].map((e) => e.textContent).join("|") !== m,
    { timeout: 180000, polling: 300 }, before, msgBefore, codeBefore).catch(() => {});
  await p.waitForNetworkIdle({ idleTime: 800, timeout: 90000 }).catch(() => {});
  await sleep(800);
}
const devLogLines = (pat) => fs.readFileSync(DEVLOG, "utf8").split("\n").filter((l) => l.includes(pat));
try {
  // ---- invite (the real addAgent code since Chunk 1g, acting as the persistent test admin)
  const logs = []; const origLog = console.log; console.log = (...x) => { logs.push(x.map((v) => typeof v === "string" ? v : JSON.stringify(v)).join(" ")); origLog(...x); };
  const inv = await addAgent({ actorAgentId: admin.id, name: "CLAUDE VERIFY INVITED AGENT", email: email1, role: "agent", baseUrl: BASE });
  console.log = origLog;
  ok("invite: ok", inv.ok, JSON.stringify(inv));
  const { data: ag1 } = await a.from("agents").select("id, levrid, role, in_rotation, auth_user_id, active").eq("email", email1).single();
  agentIds.push(ag1.id); loginIds.push(ag1.auth_user_id);
  const { data: u1 } = await a.auth.admin.getUserById(ag1.auth_user_id);
  ok("invite: agents row (agent, no LEVRID, out of rotation) linked to an agent-only login with agent_id", ag1.role === "agent" && ag1.levrid === null && ag1.in_rotation === false && !!ag1.auth_user_id && u1.user.app_metadata.account_type === "agent" && u1.user.app_metadata.agent_id === ag1.id, JSON.stringify({ ...ag1, app_metadata: u1.user.app_metadata }));
  const { count: c1 } = await a.from("customers").select("id", { count: "exact", head: true }).eq("id", ag1.auth_user_id);
  ok("invite: 0 customer records", c1 === 0);
  ok("invite: email suppressed (test address), right subject", logs.some((l) => l.includes("email suppressed") && l.includes("You've been invited to the LEVR Auto agent dashboard")), logs.find((l) => l.includes("suppressed")));
  const { data: acts } = await a.from("agent_activity_log").select("action").eq("agent_id", admin.id).gte("created_at", runStart).order("created_at");
  ok("invite: logged agent_added, agent_invited", acts.map((x) => x.action).join(",") === "agent_added,agent_invited", acts.map((x) => x.action).join(","));
  // Since Chunk 1g, adding the same email again is refused and a resend is its own action.
  const again = await addAgent({ actorAgentId: admin.id, name: "x", email: email1, role: "agent", baseUrl: BASE });
  ok("add again: refused, 'An agent with that email already exists.'", !again.ok && again.error === "An agent with that email already exists.", JSON.stringify(again));
  const resent = await resendAgentInvite({ actorAgentId: admin.id, agentId: ag1.id, baseUrl: BASE });
  ok("resend invite: sent to the same agent", resent.ok && resent.email === email1, JSON.stringify(resent));
  const bad = await addAgent({ actorAgentId: admin.id, name: "x", email: "someone@gmail.com", role: "agent", baseUrl: BASE });
  ok("invite refused for a non-work address", !bad.ok, bad.error);
  const { data: plain } = await a.from("agents").insert({ email: `claude-verify-${ts}-plain@levrauto-test.invalid`, name: "CLAUDE VERIFY PLAIN AGENT", role: "agent", in_rotation: false }).select("id").single(); agentIds.push(plain.id);
  const notLead = await addAgent({ actorAgentId: plain.id, name: "x", email: `claude-verify-${ts}-x@levrauto-test.invalid`, role: "agent", baseUrl: BASE });
  ok("invite refused when the inviter is a plain agent", !notLead.ok, notLead.error);
  // the email itself, rendered
  { const p = await newPage(); const ie = inviteEmail("Brett Johnston", `${BASE}/agent/accept?token_hash=EXAMPLE&purpose=invite`);
    await p.setContent(`<html><body style="font-family:-apple-system,Helvetica,Arial;margin:24px;max-width:640px"><p style="color:#666;font-size:13px">Subject: <b>${ie.subject}</b></p>${ie.html}</body></html>`); await both(p, "01-invite-email");
    const re = resetEmail(`${BASE}/agent/accept?token_hash=EXAMPLE&purpose=reset`);
    await p.setContent(`<html><body style="font-family:-apple-system,Helvetica,Arial;margin:24px;max-width:640px"><p style="color:#666;font-size:13px">Subject: <b>${re.subject}</b></p>${re.html}</body></html>`); await both(p, "11-reset-email");
    await p.browserContext().close(); }

  // ---- accept → set password → enroll
  const link = await createAgentSetupLink(email1, "invite", BASE); if (!link.ok) throw new Error(link.error);
  const p = await newPage(); await go(p, link.url);
  ok("accept page (invite)", (await h1(p)) === "Welcome to the LEVR Auto agent dashboard");
  await both(p, "02-accept-invite");
  await clickAndSettle(p);
  ok("Continue → set-password page", new URL(p.url()).pathname === "/agent/set-password" && (await h1(p)) === "Set your password", new URL(p.url()).pathname);
  await both(p, "03-set-password");
  await p.type('input[name="password"]', "short"); await p.type('input[name="confirm"]', "short"); await clickAndSettle(p);
  ok("weak password → the password rule", (await alertText(p))?.startsWith("Use at least 8 characters"), await alertText(p));
  await both(p, "04-set-password-rule");
  await p.evaluate(() => { document.querySelector('input[name="password"]').value = ""; document.querySelector('input[name="confirm"]').value = ""; });
  await p.type('input[name="password"]', pw1); await p.type('input[name="confirm"]', pw1 + "x"); await clickAndSettle(p);
  ok("mismatch → Passwords don't match.", (await alertText(p)) === "Passwords don't match.", await alertText(p));
  await both(p, "05-set-password-mismatch");
  await p.evaluate(() => { document.querySelector('input[name="password"]').value = ""; document.querySelector('input[name="confirm"]').value = ""; });
  await p.type('input[name="password"]', pw1); await p.type('input[name="confirm"]', pw1); await clickAndSettle(p);
  ok("good password → enroll page", new URL(p.url()).pathname === "/agent/enroll" && (await h1(p)) === "Turn on two-factor sign-in", new URL(p.url()).pathname);
  await p.waitForSelector("details summary", { timeout: 180000 });
  await both(p, "06-enroll");
  await p.waitForSelector("details summary", { timeout: 180000 }); await p.click("details summary"); await sleep(300);
  const secret = await p.evaluate(() => document.querySelector('[aria-label="Authenticator key"]').textContent.replace(/ /g, ""));
  await both(p, "07-enroll-key-shown");
  await p.type('input[name="code"]', "000000"); await clickAndSettle(p);
  ok("enroll: wrong code → generic error", (await alertText(p)) === "That didn't work. Check your details and try again.", await alertText(p));
  await both(p, "08-enroll-wrong-code");
  await p.evaluate(() => { document.querySelector('input[name="code"]').value = ""; });
  await p.type('input[name="code"]', totp(secret)); await clickAndSettle(p);
  ok("enroll: right code → agent dashboard", new URL(p.url()).pathname === "/internal/outreach", new URL(p.url()).pathname);
  const { data: f1 } = await a.auth.admin.mfa.listFactors({ userId: ag1.auth_user_id });
  ok("one verified authenticator, no leftovers", f1.factors.length === 1 && f1.factors[0].status === "verified", JSON.stringify(f1.factors.map((f) => f.status)));
  const { data: en } = await a.from("agent_activity_log").select("action").eq("agent_id", ag1.id);
  ok("logged agent_two_factor_enrolled (by the agent)", en.some((x) => x.action === "agent_two_factor_enrolled"));
  await p.browserContext().close();

  // ---- a used link can't be used twice
  { const q = await newPage(); await go(q, link.url); await clickAndSettle(q);
    ok("used link → invalid, with the invite hint", (await alertText(q)) === "This link has expired or has already been used." && (await q.evaluate(() => document.body.innerText)).includes("Ask your lead to send a new invite."), await alertText(q));
    await both(q, "09-accept-invalid-invite"); await q.browserContext().close(); }
  // ---- password + code alone can't open set-password
  { const q = await newPage(); await go(q, "/agent");
    await q.type('input[name="email"]', email1); await q.type('input[name="password"]', pw1); await clickAndSettle(q);
    await q.type('input[name="code"]', totp(secret)); await clickAndSettle(q);
    await go(q, "/agent/set-password");
    ok("signed in with password + code: set-password not reachable", new URL(q.url()).pathname !== "/agent/set-password", new URL(q.url()).pathname);
    await q.browserContext().close(); }

  // ---- forgot password (C15)
  { const q = await newPage(); await go(q, "/agent");
    ok("sign-in page has 'Forgot your password?'", await q.evaluate(() => [...document.querySelectorAll("a")].some((x) => x.textContent === "Forgot your password?")));
    await both(q, "00-signin-with-forgot-link");
    await go(q, "/agent/forgot-password"); ok("forgot page", (await h1(q)) === "Reset your password"); await both(q, "10-forgot");
    // a second, freshly set-up agent with no link sent yet (so no cooldown), to see a real reset email go out
    const { data: u2 } = await a.auth.admin.createUser({ email: email2, email_confirm: true, password: pw2, app_metadata: { account_type: "agent" } }); loginIds.push(u2.user.id);
    const { data: ag2 } = await a.from("agents").insert({ email: email2, name: "CLAUDE VERIFY RESET AGENT", role: "agent", in_rotation: false }).select("id").single(); agentIds.push(ag2.id);
    await a.rpc("link_agent_login", { p_actor_agent_id: admin.id, p_agent_id: ag2.id, p_auth_user_id: u2.user.id });
    const before = devLogLines("Reset your LEVR Auto agent password").length;
    const timeIt = async (addr) => { await go(q, "/agent/forgot-password"); await q.type('input[name="email"]', addr); const t = Date.now(); await q.click('button[type="submit"]'); await q.waitForSelector('[role="status"]', { timeout: 180000 }); const el = Date.now() - t; return [el, await q.evaluate(() => document.querySelector('[role="status"]')?.textContent)]; };
    const [tReal, msgReal] = await timeIt(email2);
    await both(q, "10b-forgot-sent");
    await sleep(6000);
    const [tNone, msgNone] = await timeIt(`claude-verify-${ts}-nobody@levrauto-test.invalid`);
    const [tCool, msgCool] = await timeIt(email2);
    await sleep(6000);
    const after = devLogLines("Reset your LEVR Auto agent password").length;
    ok("forgot: same answer for a real agent, an unknown address, and a repeat", msgReal === msgNone && msgNone === msgCool && msgReal?.startsWith("If that's an agent's work email"), msgReal);
    ok("forgot: times", [tReal, tNone, tCool].every((t) => t >= 900), `${tReal} / ${tNone} / ${tCool} ms`);
    ok("forgot: exactly one reset email (real agent; none for unknown; none on the repeat within 5 minutes)", after - before === 1, `${after - before} suppressed reset email(s) in the server log`);
    await q.browserContext().close(); }

  // ---- reset an agent who already has an authenticator: back to the code step
  // another device already fully signed in, to check the reset signs it out
  const other = await newPage(); await go(other, "/agent");
  await other.type('input[name="email"]', email1); await other.type('input[name="password"]', pw1); await clickAndSettle(other);
  await other.type('input[name="code"]', totp(secret)); await clickAndSettle(other);
  ok("other device signed in before the reset", new URL(other.url()).pathname === "/internal/outreach", new URL(other.url()).pathname);
  { const rl = await createAgentSetupLink(email1, "reset", BASE); const q = await newPage(); await go(q, rl.url);
    ok("accept page (reset)", (await h1(q)) === "Reset your password"); await both(q, "12-accept-reset");
    await clickAndSettle(q); await q.type('input[name="password"]', pw3); await q.type('input[name="confirm"]', pw3); await clickAndSettle(q);
    ok("reset with an authenticator → code step, not the dashboard", new URL(q.url()).pathname === "/agent" && !!(await q.$('input[name="code"]')), new URL(q.url()).pathname);
    await q.type('input[name="code"]', totp(secret)); await clickAndSettle(q);
    ok("code → dashboard", new URL(q.url()).pathname === "/internal/outreach");
    await go(other, "/agent");
    ok("the reset signed the other device out", !!(await other.$('input[name="password"]')) && !(await other.$('input[name="code"]')), new URL(other.url()).pathname);
    await other.browserContext().close();
    await q.browserContext().close();
    const { data: s } = await a.auth.admin.mfa.listFactors({ userId: ag1.auth_user_id });
    ok("authenticator kept after reset", s.factors.length === 1 && s.factors[0].status === "verified");
  }
  // old password no longer works, new one does (direct, no browser)
  { const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
    const { createClient } = await import("@supabase/supabase-js");
    const c = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const old = await c().auth.signInWithPassword({ email: email1, password: pw1 }); const nw = await c().auth.signInWithPassword({ email: email1, password: pw3 });
    ok("after reset: old password refused, new password works", !!old.error && !nw.error, `${old.error?.message} / ${nw.error ? nw.error.message : "ok"}`); }
  // ---- a customer's reset link can't get into the agent pages
  { const { data: cu } = await a.auth.admin.createUser({ email: custEmail, email_confirm: true, password: pw2 }); loginIds.push(cu.user.id);
    const { data: gl } = await a.auth.admin.generateLink({ type: "recovery", email: custEmail });
    const q = await newPage(); await go(q, `${BASE}/agent/accept?token_hash=${gl.properties.hashed_token}&purpose=reset`); await clickAndSettle(q);
    ok("customer's link at /agent/accept → invalid, signed out", (await alertText(q)) === "This link has expired or has already been used." && (await q.cookies()).filter((x) => x.name.includes("auth-token")).length === 0, await alertText(q));
    await both(q, "13-accept-invalid-reset"); await q.browserContext().close(); }
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser.close();
  for (const id of agentIds) await a.from("agent_activity_log").delete().eq("agent_id", id);
  await a.from("agent_activity_log").delete().eq("agent_id", admin.id).gte("created_at", runStart);
  for (const id of agentIds) await a.from("agents").delete().eq("id", id);
  for (const id of loginIds.filter(Boolean)) await a.auth.admin.deleteUser(id);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  let ul = 0; for (const id of loginIds.filter(Boolean)) if ((await a.auth.admin.getUserById(id)).data?.user) ul++;
  const { count: agLeft } = await a.from("agents").select("id", { count: "exact", head: true }).ilike("email", `claude-verify-${ts}%`);
  const { count: atLeft } = await a.from("agent_signin_attempts").select("id", { count: "exact", head: true }).gte("created_at", runStart);
  const { count: cuLeft } = await a.from("customers").select("id", { count: "exact", head: true }).in("id", loginIds.filter(Boolean));
  const b1 = await cnt(brett.id), ad1 = await cnt(admin.id);
  console.log(`CLEANUP: logins ${ul} | test agents ${agLeft} | customer rows ${cuLeft} | sign-in attempts ${atLeft} | test admin activity ${admin0} -> ${ad1} | Brett activity ${brett0} -> ${b1}`);
  if (ul || agLeft || cuLeft || atLeft || b1 !== brett0 || ad1 !== admin0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`); console.log(shots.map((f) => path.basename(f)).join("  "));
}
