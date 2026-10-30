// Chunk 1f rehearsal: the deploy-day cutover, with stand-in test accounts only (never LEVRID 1).
//   S       = stand-in for Brett's agent row (test admin, no LEVRID), email = its "old" customer login
//   custOld = stand-in for Brett's current login (a customer login)
//   newLogin= stand-in for his future agent-only login
//   H       = the temporary holder row the new login is linked to until the relink
// Branch code (new) runs on :3100; Brett's dev server on :3000 runs main (today's production code).
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g,""); }
process.env.NODE_ENV = "development";
const { createAdminClient } = await import("../lib/admin.mjs");
const { createAgentLogin, linkAgentLogin } = await import("../gen/real/agent-accounts.mjs");
const { createAgentSetupLink } = await import("../gen/real/agent-invite.mjs");
const a = createAdminClient(); const NEW = "http://localhost:3100", OLD = "http://localhost:3000"; const OUT = path.join(LOGS, "shots");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}`;
const pwOld = `Old!${ts}aA`, pwNew = `New!${ts}bB`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id, auth_user_id, email").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 300000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "r1f-")) });
const at = (p) => new URL(p.url()).pathname;
async function ctxPage() { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 }); p.setDefaultTimeout(240000); return p; }
async function go(p, u) { await p.goto(u, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
async function submit(p, sel, pred) { await p.click(sel); await p.waitForFunction(pred, { timeout: 240000, polling: 300 }).catch(() => {}); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
const FORM = 'form:has(input[name="password"]) button[type="submit"], form:has(input[name="code"]) button[type="submit"], form:has(input[name="token_hash"]) button[type="submit"]';
async function agentSignIn(p, email, pw, secret) { await go(p, NEW + "/agent"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await submit(p, FORM, () => !!document.querySelector('input[name="code"]') || location.pathname !== "/agent" || !!document.querySelector('[role="alert"]'));
  if (secret && await p.$('input[name="code"]')) { await p.type('input[name="code"]', totp(secret)); await submit(p, FORM, () => location.pathname !== "/agent"); } }
async function oldSiteSignIn(p, email, pw) { await go(p, OLD + "/login"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await submit(p, 'form:has(input[name="password"]) button[type="submit"]', () => location.pathname !== "/login"); }
const header = (p) => p.evaluate(() => document.querySelector("header")?.innerText.replace(/\s+/g, " ") ?? "");
const logins = [], agentIds = [];
try {
  // ---------- Starting state (like Brett's today): an admin row whose email is its customer login
  const custEmail = `${PFX}-oldlogin@levrauto-test.invalid`;
  const { data: cu, error: cuErr } = await a.auth.admin.createUser({ email: custEmail, email_confirm: true, password: pwOld }); if (cuErr) throw cuErr; logins.push(cu.user.id);
  const { data: S, error: sErr } = await a.from("agents").insert({ email: custEmail, name: "CLAUDE VERIFY STAND-IN BRETT", role: "agent", in_rotation: false }).select("id, levrid").single(); if (sErr) throw sErr; agentIds.push(S.id);
  { const { error } = await a.rpc("set_agent_role", { p_actor_agent_id: padmin.id, p_subject_agent_id: S.id, p_role: "admin", p_in_rotation: false }); if (error) throw error; }
  const pOld = await ctxPage(); await oldSiteSignIn(pOld, custEmail, pwOld); await go(pOld, OLD + "/internal/outreach");
  ok("before: old login reaches /internal on TODAY's code (matched by email)", at(pOld) === "/internal/outreach", at(pOld));

  // ---------- Part A (before deploy): new agent-only login, held by a temporary row
  const newEmail = `${PFX}-newlogin@levrauto-test.invalid`, holderEmail = `${PFX}-holder@levrauto-test.invalid`;
  const { data: H, error: hErr } = await a.rpc("add_agent", { p_actor_agent_id: padmin.id, p_email: holderEmail, p_name: "CLAUDE VERIFY HOLDER (temporary)", p_role: "agent", p_in_rotation: false });
  if (hErr) throw hErr; agentIds.push(H.id);
  const nl = await createAgentLogin(newEmail, S.id); if (!nl.ok) throw new Error(nl.error); logins.push(nl.value);
  const ln = await linkAgentLogin(padmin.id, H.id, nl.value); if (!ln.ok) throw new Error(ln.error);
  ok("A1: holder row (test, no LEVRID, out of rotation) linked to the new agent-only login", H.levrid === null && H.in_rotation === false && ln.value.auth_user_id === nl.value);
  { const { count } = await a.from("customers").select("id", { count: "exact", head: true }).eq("id", nl.value); ok("A1: no customer record for the new login", count === 0); }
  const link = await createAgentSetupLink(newEmail, "invite", NEW); if (!link.ok) throw new Error(link.error);
  const p = await ctxPage(); await go(p, link.url);
  await submit(p, FORM, () => location.pathname === "/agent/set-password");
  ok("A2: setup link → set password", at(p) === "/agent/set-password", at(p));
  await p.type('input[name="password"]', pwNew); await p.type('input[name="confirm"]', pwNew);
  await submit(p, FORM, () => location.pathname === "/agent/enroll");
  ok("A3: password set → turn on two-factor", at(p) === "/agent/enroll", at(p));
  await p.waitForSelector("details summary"); await p.click("details summary"); await sleep(300);
  const secret = await p.evaluate(() => document.querySelector('[aria-label="Authenticator key"]').textContent.replace(/ /g, ""));
  await p.type('input[name="code"]', totp(secret)); await submit(p, FORM, () => location.pathname !== "/agent/enroll");
  ok("A4: code accepted → dashboard (as the holder)", at(p) === "/internal/outreach" && (await header(p)).includes("CLAUDE VERIFY HOLDER"), `${at(p)} | ${await header(p)}`);
  await p.screenshot({ path: path.join(OUT, "agent-1f-rehearsal-A-holder-signed-in.png") });
  const { data: f1 } = await a.auth.admin.mfa.listFactors({ userId: nl.value });
  ok("A5: one verified authenticator on the new login", f1.factors.length === 1 && f1.factors[0].status === "verified");
  const p2 = await ctxPage(); await agentSignIn(p2, newEmail, pwNew, secret);
  ok("A6: fresh sign-in with password + code works on the new login", at(p2) === "/internal/outreach", at(p2));
  await go(pOld, OLD + "/internal/outreach");
  ok("A7: old login STILL reaches /internal on today's code (nothing about it changed)", at(pOld) === "/internal/outreach", at(pOld));

  // ---------- Deploy happens here. On the new code the old (customer) login is no agent:
  const pc = await ctxPage(); await go(pc, NEW + "/agent"); await pc.type('input[name="email"]', custEmail); await pc.type('input[name="password"]', pwOld);
  await submit(pc, FORM, () => !!document.querySelector('[role="alert"]') || location.pathname !== "/agent");
  ok("D: on the new code the old login can't sign in as an agent", at(pc) === "/agent" && !(await pc.$('input[name="code"]')), await pc.evaluate(() => document.querySelector('[role="alert"]')?.textContent));

  await go(pOld, OLD + "/internal/outreach");
  ok("D2: that refused attempt did NOT sign the old login out of its other session", at(pOld) === "/internal/outreach", at(pOld));

  // ---------- Part B (right after deploy): remove the holder and move the stand-in to the new login
  //   (deploy day: ONE SQL transaction in the SQL Editor; here the same three statements in order)
  { const { error: e1 } = await a.from("agent_activity_log").delete().eq("agent_id", H.id);
    const { error: e2 } = await a.from("agents").delete().eq("id", H.id).eq("email", holderEmail);
    const { data: r, error: e3 } = await a.rpc("relink_agent_login", { p_actor_agent_id: S.id, p_agent_id: S.id, p_new_auth_user_id: nl.value });
    ok("B1: holder removed and relink ran", !e1 && !e2 && !e3 && r.auth_user_id === nl.value && r.email === newEmail, (e1 ?? e2 ?? e3)?.message ?? JSON.stringify({ auth_user_id: r.auth_user_id, email: r.email })); }
  { const { data: act } = await a.from("agent_activity_log").select("details").eq("agent_id", S.id).eq("action", "agent_login_relinked");
    ok("B2: logged agent_login_relinked by the admin, old → new email", act.length === 1 && act[0].details.from_email === custEmail && act[0].details.to_email === newEmail, JSON.stringify(act[0]?.details)); }
  await go(p, NEW + "/internal/outreach");
  ok("B3: the already-open session is now the moved agent (no re-sign-in)", at(p) === "/internal/outreach" && (await header(p)).includes("STAND-IN BRETT"), await header(p));
  const p3 = await ctxPage(); await agentSignIn(p3, newEmail, pwNew, secret);
  ok("B4: fresh sign-in (password + same authenticator) → dashboard as the moved agent", at(p3) === "/internal/outreach" && (await header(p3)).includes("STAND-IN BRETT"), await header(p3));
  await go(p3, NEW + "/internal/agents"); ok("B5: admin page loads for the moved agent", at(p3) === "/internal/agents", at(p3));
  await p3.screenshot({ path: path.join(OUT, "agent-1f-rehearsal-B-after-relink.png") });
  { const pcu = await ctxPage(); await go(pcu, NEW + "/login"); await pcu.type('input[name="email"]', custEmail); await pcu.type('input[name="password"]', pwOld);
    await submit(pcu, 'form:has(input[name="password"]) button[type="submit"]', () => location.pathname !== "/login");
    ok("B6: old login still works as a CUSTOMER on the new code (→ where the search stands)", ["/", "/account"].includes(at(pcu)) || at(pcu).startsWith("/account/"), at(pcu));
    await go(pcu, NEW + "/internal/outreach"); ok("B7: …and can't reach /internal", at(pcu) === "/agent", at(pcu)); }

  // ---------- Rollback recipe (if the new code has to be rolled back after the relink)
  await go(pOld, OLD + "/internal/outreach");
  ok("R1: on today's code, after the relink, the old login has lost /internal (email moved)", at(pOld) !== "/internal/outreach", at(pOld));
  { const { error } = await a.from("agents").update({ email: custEmail }).eq("id", S.id); ok("R2: rollback step: put the old email back on the agent row", !error, error?.message); }
  await go(pOld, OLD + "/internal/outreach");
  ok("R3: …old login reaches /internal on today's code again", at(pOld) === "/internal/outreach", at(pOld));
  for (const q of [pOld, p, p2, pc, p3]) await q.browserContext().close();
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser.close();
  const { data: mine } = await a.from("agents").select("id").ilike("email", `${PFX}%`);
  for (const r of mine ?? []) if (!agentIds.includes(r.id)) agentIds.push(r.id);
  for (const id of agentIds) await a.from("agent_activity_log").delete().eq("agent_id", id);
  await a.from("agent_activity_log").delete().eq("agent_id", padmin.id).gte("created_at", runStart);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await a.from("customers").delete().ilike("email", `${PFX}%`);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  let ul = 0; for (const id of logins) if ((await a.auth.admin.getUserById(id)).data?.user) ul++;
  const agl = (await a.from("agents").select("id", { count: "exact", head: true }).ilike("email", `${PFX}%`)).count;
  const cul = (await a.from("customers").select("id", { count: "exact", head: true }).ilike("email", `${PFX}%`)).count;
  const { data: b2 } = await a.from("agents").select("auth_user_id, email").eq("id", brett.id).single();
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: logins ${ul} | test agents ${agl} | customer rows ${cul} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1} | Brett's row unchanged: ${b2.auth_user_id === brett.auth_user_id && b2.email === brett.email}`);
  if (ul || agl || cul || b1 !== b0 || ad1 !== ad0 || b2.auth_user_id !== brett.auth_user_id || b2.email !== brett.email) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
