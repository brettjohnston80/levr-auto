// Chunk 1g: the Add-agent page (/internal/agents) and its three actions.
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const a = createAdminClient(); const BASE = "http://localhost:3100"; const OUT = path.join(LOGS, "shots");
const DEVLOG = (LOGS + "/dev3100.log");
const MANIFEST = (ROOT + "/.next/dev/server/server-reference-manifest.json");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), pw = `Team!${ts}aA`, Z = "00000000-0000-0000-0000-000000000000";
const PFX = `claude-verify-${ts}`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const logins = []; const agentIds = []; const secrets = {};
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const { data: padmin } = await a.from("agents").select("id, email").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const TABLES = ["agents", "agent_activity_log", "customers"];
async function snapshot() { const o = {}; for (const t of TABLES) { const { count } = await a.from(t).select("*", { count: "exact", head: true }); o[t] = count; }
  const { data } = await a.auth.admin.listUsers({ perPage: 1000 }); o.logins = data.users.length; return o; }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 300000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c1g-")) });
const path_ = (p) => new URL(p.url()).pathname;
async function ctxPage() { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 }); p.setDefaultTimeout(240000); return p; }
async function go(p, u) { await p.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
async function submitAndWait(p, pred) { await p.click('form button[type="submit"]'); await p.waitForFunction(pred, { timeout: 240000, polling: 300 }).catch(() => {}); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
async function signIn(p, email, withCode = true) { await go(p, "/agent"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await submitAndWait(p, () => !!document.querySelector('input[name="code"]') || location.pathname !== "/agent");
  if (withCode && secrets[email] && await p.$('input[name="code"]')) { await p.type('input[name="code"]', totp(secrets[email])); await submitAndWait(p, () => location.pathname !== "/agent"); } }
async function mkAgent(tag, role, withFactor = true) {
  const email = `${PFX}-${tag}@levrauto-test.invalid`;
  const { data: u, error } = await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }); if (error) throw error; logins.push(u.user.id);
  const { data: ag, error: ie } = await a.from("agents").insert({ email, name: `CLAUDE VERIFY ${tag.toUpperCase()}`, role: "agent", in_rotation: false }).select("id").single(); if (ie) throw ie; agentIds.push(ag.id);
  const { error: le } = await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: ag.id, p_auth_user_id: u.user.id }); if (le) throw le;
  if (role !== "agent") { const { error: re } = await a.rpc("set_agent_role", { p_actor_agent_id: padmin.id, p_subject_agent_id: ag.id, p_role: role, p_in_rotation: false }); if (re) throw re; }
  if (withFactor) { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
    const { error: ve } = await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }); if (ve) throw ve; await c.auth.signOut(); secrets[email] = en.totp.secret; }
  return { id: ag.id, email, userId: u.user.id, name: `CLAUDE VERIFY ${tag.toUpperCase()}` };
}
function teamActionIds() { const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); const out = {};
  for (const v of Object.values(m.node)) for (const w of Object.values(v.workers)) { const q = decodeURIComponent((w.moduleId.split("actions=")[1] ?? "").split("&")[0]);
    try { for (const [file, list] of JSON.parse(q)) if (file.endsWith("agent-team-actions.ts")) for (const x of list) out[x.exportedName ?? x.name] = x.id; } catch {} }
  return out; }
async function call(p, id, args) { return p.evaluate(async (id, args) => { const r = await fetch("/agent", { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify(args) }); return await r.text(); }, id, args); }
const answer = (r) => { const m = r.match(/\{"ok":(true|false),"(?:message|error)":"([^"]+)"/); return m ? `${m[1] === "true" ? "ok" : "refused"}: ${m[2]}` : r.replace(/\s+/g, " ").slice(-120); };
const notAuth = (r) => /"ok":false,"error":"Not authorized\."/.test(r);
const text = (p) => p.evaluate(() => document.body.innerText);
async function waitText(p, s) { await p.waitForFunction((s) => document.body.innerText.includes(s), { timeout: 240000, polling: 300 }, s).catch(() => {}); await p.waitForNetworkIdle({ idleTime: 600, timeout: 60000 }).catch(() => {}); return (await text(p)).includes(s); }
async function shot(p, tag) { for (const [vp, d] of [[{ width: 1280, height: 900, deviceScaleFactor: 2 }, "desktop"], [{ width: 390, height: 844, deviceScaleFactor: 3 }, "phone"]]) {
  // No isMobile/hasTouch: Puppeteer reloads the page to apply those, which would close an open
  // confirm (the layout only depends on the width).
  await p.setViewport(vp); await sleep(700); await p.screenshot({ path: path.join(OUT, `agent-1g-${tag}-${d}.png`), fullPage: true }); } await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 }); await sleep(400); }
async function rowButtons(p, email) { return p.evaluate((email) => { const row = [...document.querySelectorAll("[data-agent-row]")].find((r) => r.dataset.agentRow === email && r.offsetParent !== null); return row ? [...row.querySelectorAll("button")].map((b) => b.textContent) : null; }, email); }
async function clickInRow(p, email, label) { await p.evaluate((email, label) => { const row = [...document.querySelectorAll("[data-agent-row]")].find((r) => r.dataset.agentRow === email && r.offsetParent !== null); [...row.querySelectorAll("button")].find((b) => b.textContent === label).click(); }, email, label); }
async function fillAdd(p, name, email, role) { await p.evaluate(() => document.querySelector('form[data-add-agent] input[name="name"]').value = ""); await p.evaluate(() => document.querySelector('form[data-add-agent] input[name="email"]').value = "");
  await p.type('form[data-add-agent] input[name="name"]', name); await p.type('form[data-add-agent] input[name="email"]', email); if (role) await p.select('select[name="role"]', role); }
// The server logs each suppressed email as a label line plus its { to, subject } object, which wraps
// onto further lines when the address is long, so read each entry whole.
const inviteEmails = () => fs.readFileSync(DEVLOG, "utf8").split("[email suppressed").slice(1).filter((e) => e.slice(0, 600).includes("invited to the LEVR Auto agent dashboard")).length;

try {
  const P = await mkAgent("plain", "agent"), PW = await mkAgent("pwonly", "agent"), L = await mkAgent("lead", "lead"), L2 = await mkAgent("lead2", "lead"), A = await mkAgent("admin", "admin"), U = await mkAgent("nofactor", "agent", false);
  // a customer login
  const custEmail = `${PFX}-customer@levrauto-test.invalid`;
  const { data: cu } = await a.auth.admin.createUser({ email: custEmail, email_confirm: true, password: pw }); logins.push(cu.user.id);

  // ---- sessions
  const pNone = await ctxPage(); await go(pNone, "/agent");
  const pCust = await ctxPage(); await go(pCust, "/login"); await pCust.type('input[name="email"]', custEmail); await pCust.type('input[name="password"]', pw);
  await submitAndWait(pCust, () => location.pathname !== "/login"); ok("customer signed in", path_(pCust) === "/account", path_(pCust));
  const pP = await ctxPage(); await signIn(pP, P.email); ok("plain agent signed in (two-factor)", path_(pP) === "/internal/outreach");
  const pPW = await ctxPage(); await signIn(pPW, PW.email, false); ok("password-only agent at the code step", path_(pPW) === "/agent" && !!(await pPW.$('input[name="code"]')));
  const pL = await ctxPage(); await signIn(pL, L.email); ok("lead signed in", path_(pL) === "/internal/outreach");
  const pA = await ctxPage(); await signIn(pA, A.email); ok("admin signed in", path_(pA) === "/internal/outreach");

  // ---- page access
  for (const [label, p, want] of [["signed out", pNone, "/agent"], ["customer", pCust, "/agent"], ["password-only agent", pPW, "/agent"], ["plain agent", pP, "/internal/outreach"], ["lead", pL, "/internal/agents"], ["admin", pA, "/internal/agents"]]) {
    await go(p, "/internal/agents"); ok(`page: ${label} → ${want}`, path_(p) === want, path_(p)); }
  await go(pPW, "/agent"); // back to a page for direct calls
  const ids = teamActionIds(); ok("found the 3 action ids", ["addAgentAction", "resendInviteAction", "resetTwoFactorAction"].every((n) => ids[n]), JSON.stringify(ids));

  // ---- direct calls refused: no session, customer, plain agent, password-only agent
  const before = await snapshot();
  const callArgs = { addAgentAction: [{ name: "CLAUDE VERIFY X", email: `${PFX}-x@levrauto-test.invalid`, role: "admin" }], resendInviteAction: [U.id], resetTwoFactorAction: [P.id] };
  for (const [label, p] of [["no session", pNone], ["customer", pCust], ["plain agent", pP], ["password-only agent", pPW]]) {
    for (const n of Object.keys(callArgs)) { const r = await call(p, ids[n], callArgs[n]); ok(`${n}: ${label} refused`, notAuth(r), answer(r)); } }
  const after = await snapshot();
  ok("refused calls changed nothing", JSON.stringify(before) === JSON.stringify(after), `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  { const { data: f } = await a.auth.admin.mfa.listFactors({ userId: P.userId }); ok("plain agent still has its authenticator", f.factors.length === 1); }

  // ---- lead: page and form
  await go(pL, "/internal/agents");
  const leadOpts = await pL.$$eval('select[name="role"] option', (o) => o.map((x) => x.textContent));
  ok("lead: role options are Agent only", JSON.stringify(leadOpts) === '["Agent"]', JSON.stringify(leadOpts));
  ok("lead: own row has no buttons", (await rowButtons(pL, L.email))?.length === 0, JSON.stringify(await rowButtons(pL, L.email)));
  ok("lead: plain agent (two-factor on) shows Reset two-factor", JSON.stringify(await rowButtons(pL, P.email)) === '["Reset two-factor"]', JSON.stringify(await rowButtons(pL, P.email)));
  ok("lead: agent without two-factor shows Resend invite", JSON.stringify(await rowButtons(pL, U.email)) === '["Resend invite"]', JSON.stringify(await rowButtons(pL, U.email)));
  ok("lead: another lead and the admin show no buttons", (await rowButtons(pL, L2.email))?.length === 0 && (await rowButtons(pL, A.email))?.length === 0);
  ok("lead: list shows TEST badges and statuses", /TEST/.test(await text(pL)) && (await text(pL)).includes("Two-factor on") && (await text(pL)).includes("Invite not finished"));
  await shot(pL, "lead-empty");

  // bad email, empty-ish name, add, duplicate
  await fillAdd(pL, "CLAUDE VERIFY NEW1", `${PFX}-new1@gmail.com`); await pL.click('form[data-add-agent] button[type="submit"]');
  ok("lead: non-work email → error", await waitText(pL, "Use a @levrauto.com work email (or a @levrauto-test.invalid test address)."));
  await shot(pL, "lead-error-email");
  const i0 = inviteEmails();
  await fillAdd(pL, "CLAUDE VERIFY NEW1", `${PFX}-new1@levrauto-test.invalid`);
  // catch the busy label
  await pL.click('form[data-add-agent] button[type="submit"]');
  const busy = await pL.waitForFunction(() => document.querySelector('form[data-add-agent] button[type="submit"]').textContent === "Sending invite…", { timeout: 20000, polling: 20 }).then(() => true).catch(() => false);
  ok("lead: busy label 'Sending invite…'", busy);
  ok("lead: adds an agent → success line", await waitText(pL, `Invite sent to ${PFX}-new1@levrauto-test.invalid. CLAUDE VERIFY NEW1 is a test agent, so has no LEVRID.`));
  await shot(pL, "lead-added");
  const { data: n1 } = await a.from("agents").select("id, role, in_rotation, levrid, auth_user_id, active").eq("email", `${PFX}-new1@levrauto-test.invalid`).single(); agentIds.push(n1.id); if (n1.auth_user_id) logins.push(n1.auth_user_id);
  ok("new agent: role agent, out of rotation, no LEVRID, login linked", n1.role === "agent" && !n1.in_rotation && n1.levrid === null && !!n1.auth_user_id && n1.active, JSON.stringify(n1));
  { const { data: u } = await a.auth.admin.getUserById(n1.auth_user_id); ok("new agent's login is agent-only", u.user.app_metadata?.account_type === "agent"); }
  { const { count } = await a.from("customers").select("id", { count: "exact", head: true }).ilike("email", `${PFX}-new1%`); ok("no customer record for the new agent", count === 0); }
  await sleep(1500); ok("invite email sent (suppressed: test address)", inviteEmails() - i0 === 1, `${inviteEmails() - i0}`);
  { const { data: act } = await a.from("agent_activity_log").select("action").eq("agent_id", L.id).in("action", ["agent_added", "agent_invited"]); ok("logged agent_added + agent_invited by the lead", act.length >= 2, act.map((x) => x.action).join(",")); }
  await fillAdd(pL, "CLAUDE VERIFY NEW1", `${PFX}-new1@levrauto-test.invalid`); await pL.click('form[data-add-agent] button[type="submit"]');
  ok("lead: same email again → already exists", await waitText(pL, "An agent with that email already exists."));
  { const r = await call(pL, ids.addAgentAction, [{ name: "CLAUDE VERIFY X", email: `${PFX}-x@levrauto-test.invalid`, role: "lead" }]); ok("lead adds a lead (direct call) → refused", answer(r) === "refused: Only admins can add a lead or an admin.", answer(r)); }
  { const r = await call(pL, ids.addAgentAction, [{ name: "CLAUDE VERIFY X", email: `${PFX}-x@levrauto-test.invalid`, role: "admin" }]); ok("lead adds an admin (direct call) → refused", answer(r) === "refused: Only admins can add a lead or an admin.", answer(r)); }
  { const { count } = await a.from("agents").select("id", { count: "exact", head: true }).eq("email", `${PFX}-x@levrauto-test.invalid`); ok("…nothing added", count === 0); }
  { const r = await call(pL, ids.addAgentAction, [{ name: "   ", email: `${PFX}-x@levrauto-test.invalid`, role: "agent" }]); ok("blank name → Enter a name.", answer(r) === "refused: Enter a name.", answer(r)); }

  // resend invite from the list (reload so the new agent shows)
  await go(pL, "/internal/agents");
  ok("lead: newly added agent listed with Resend invite", JSON.stringify(await rowButtons(pL, `${PFX}-new1@levrauto-test.invalid`)) === '["Resend invite"]');
  const i1 = inviteEmails(); await clickInRow(pL, `${PFX}-new1@levrauto-test.invalid`, "Resend invite");
  ok("lead: Resend invite → sent again", await waitText(pL, `Invite sent again to ${PFX}-new1@levrauto-test.invalid.`));
  await sleep(1500); ok("…one more invite email", inviteEmails() - i1 === 1);
  await shot(pL, "lead-resent");
  { const r = await call(pL, ids.resendInviteAction, [P.id]); ok("resend to an agent with two-factor on → refused", answer(r) === "refused: This agent has already set up their sign-in.", answer(r)); }
  { const r = await call(pL, ids.resendInviteAction, [L2.id]); ok("lead resends to a lead → refused", /^refused: Only admins/.test(answer(r)), answer(r)); }

  // reset two-factor from the list: plain agent P signed in on its own device
  await go(pL, "/internal/agents");
  await clickInRow(pL, P.email, "Reset two-factor");
  ok("lead: reset asks to confirm", await waitText(pL, `Reset ${P.name}'s two-factor sign-in? They'll be signed out everywhere and set it up again next time they sign in. Confirm it's really them by phone or video first.`));
  await shot(pL, "lead-reset-confirm");
  await clickInRow(pL, P.email, "Cancel"); await sleep(500);
  ok("Cancel → back to the button, nothing reset", JSON.stringify(await rowButtons(pL, P.email)) === '["Reset two-factor"]' && (await a.auth.admin.mfa.listFactors({ userId: P.userId })).data.factors.length === 1);
  await clickInRow(pL, P.email, "Reset two-factor"); await sleep(300); await clickInRow(pL, P.email, "Reset");
  const busyR = await pL.waitForFunction(() => document.body.innerText.includes("Resetting…"), { timeout: 20000, polling: 20 }).then(() => true).catch(() => false);
  ok("busy label 'Resetting…'", busyR);
  ok("lead resets an agent → success line", await waitText(pL, `${P.name}'s two-factor sign-in was reset. They've been signed out everywhere.`));
  await shot(pL, "lead-reset-done");
  ok("plain agent's authenticators removed", (await a.auth.admin.mfa.listFactors({ userId: P.userId })).data.factors.length === 0);
  await go(pP, "/internal/outreach"); ok("plain agent's open session signed out", path_(pP) === "/agent", path_(pP));
  { const { data: act } = await a.from("agent_activity_log").select("details").eq("agent_id", L.id).eq("action", "agent_two_factor_reset"); ok("logged agent_two_factor_reset by the lead (actor from the session)", act.length === 1 && act[0].details.agent_id === P.id, JSON.stringify(act)); }
  { const r = await call(pL, ids.resetTwoFactorAction, [L.id]); ok("lead resets own (direct call) → refused", answer(r) === "refused: You can't reset your own two-factor sign-in.", answer(r)); }
  { const r = await call(pL, ids.resetTwoFactorAction, [L2.id]); ok("lead resets a lead (direct call) → refused", answer(r) === "refused: Only admins can reset a lead's or an admin's two-factor sign-in.", answer(r)); }
  ok("…lead2 still has its authenticator", (await a.auth.admin.mfa.listFactors({ userId: L2.userId })).data.factors.length === 1);

  // ---- admin
  await go(pA, "/internal/agents");
  const adminOpts = await pA.$$eval('select[name="role"] option', (o) => o.map((x) => x.textContent));
  ok("admin: role options Agent, Lead, Admin", JSON.stringify(adminOpts) === '["Agent","Lead","Admin"]', JSON.stringify(adminOpts));
  ok("admin: leads show Reset two-factor, own row none", JSON.stringify(await rowButtons(pA, L.email)) === '["Reset two-factor"]' && (await rowButtons(pA, A.email))?.length === 0);
  ok("admin: the persistent test admin shows no buttons", (await rowButtons(pA, padmin.email))?.length === 0, JSON.stringify(await rowButtons(pA, padmin.email)));
  { const bEmail = (await a.from("agents").select("email").eq("levrid", 1).single()).data.email;
    ok("admin: Brett's row shows 'Old login, not moved yet' with no buttons", (await rowButtons(pA, bEmail))?.length === 0 && (await pA.evaluate((e) => [...document.querySelectorAll("[data-agent-row]")].find((r) => r.dataset.agentRow === e).innerText, bEmail)).includes("Old login, not moved yet"));
    // Removed 2026-10-24: a direct "Resend invite" call aimed at Brett's row. Tests never act on
    // Brett's account, even for a refusal check (lib/protect.mjs, lib/guard.mjs).
  }
  await shot(pA, "admin-empty");
  await fillAdd(pA, "CLAUDE VERIFY NEWLEAD", `${PFX}-newlead@levrauto-test.invalid`, "lead"); await pA.click('form[data-add-agent] button[type="submit"]');
  ok("admin adds a lead → success line", await waitText(pA, `Invite sent to ${PFX}-newlead@levrauto-test.invalid. CLAUDE VERIFY NEWLEAD is a test agent, so has no LEVRID.`));
  const { data: n2 } = await a.from("agents").select("id, role, in_rotation, auth_user_id").eq("email", `${PFX}-newlead@levrauto-test.invalid`).single(); agentIds.push(n2.id); if (n2.auth_user_id) logins.push(n2.auth_user_id);
  ok("new lead: role lead, out of rotation", n2.role === "lead" && !n2.in_rotation, JSON.stringify(n2));
  await shot(pA, "admin-added");
  await go(pA, "/internal/agents"); await clickInRow(pA, L2.email, "Reset two-factor"); await sleep(300); await clickInRow(pA, L2.email, "Reset");
  ok("admin resets a lead → success line", await waitText(pA, `${L2.name}'s two-factor sign-in was reset.`));
  ok("…lead2's authenticators removed", (await a.auth.admin.mfa.listFactors({ userId: L2.userId })).data.factors.length === 0);
  { const r = await call(pA, ids.resetTwoFactorAction, [A.id]); ok("admin resets own (direct call) → refused", answer(r) === "refused: You can't reset your own two-factor sign-in.", answer(r)); }
  await go(pL, "/internal/agents"); ok("the lead is still signed in after everything", path_(pL) === "/internal/agents");
  for (const p of [pNone, pCust, pP, pPW, pL, pA]) await p.browserContext().close();
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser.close();
  // anything this run created (including agents added through the page)
  const { data: mine } = await a.from("agents").select("id, auth_user_id").ilike("email", `${PFX}%`);
  for (const r of mine ?? []) { if (!agentIds.includes(r.id)) agentIds.push(r.id); if (r.auth_user_id && !logins.includes(r.auth_user_id)) logins.push(r.auth_user_id); }
  for (const id of agentIds) await a.from("agent_activity_log").delete().eq("agent_id", id);
  await a.from("agent_activity_log").delete().eq("agent_id", padmin.id).gte("created_at", runStart);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", id, error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await a.from("customers").delete().ilike("email", `${PFX}%`);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  let ul = 0; for (const id of logins) if ((await a.auth.admin.getUserById(id)).data?.user) ul++;
  const { count: agl } = await a.from("agents").select("id", { count: "exact", head: true }).ilike("email", `${PFX}%`);
  const { count: cul } = await a.from("customers").select("id", { count: "exact", head: true }).ilike("email", `${PFX}%`);
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: logins ${ul} | test agents ${agl} | customer rows ${cul} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (ul || agl || cul || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
