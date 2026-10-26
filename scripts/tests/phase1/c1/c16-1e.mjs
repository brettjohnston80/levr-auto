// C16 role gates (plain agent refused, lead allowed) + Chunk 1e two-factor reset.
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const a = createAdminClient(); const BASE = "http://localhost:3100"; const OUT = path.join(LOGS, "shots");
const DEVLOG = (LOGS + "/dev3100.log");
const ids = JSON.parse(fs.readFileSync(new URL("./gated-ids.json", import.meta.url)));
const GATED = Object.keys(ids).filter((n) => n !== "searchCustomers");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), pw = `Gate!${ts}aA`, Z = "00000000-0000-0000-0000-000000000000";
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const logins = []; const agentIds = []; const secrets = {};
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const { data: admin } = await a.from("agents").select("id, email").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(admin.id);
const TABLES = ["articles","social_posts","dealer_aliases","dealerships","customer_searches","purchase_status_log","agent_activity_log","agents"];
async function snapshot() { const o = {}; for (const t of TABLES) { const { count } = await a.from(t).select("*", { count: "exact", head: true }); let latest = null; for (const col of ["updated_at","created_at"]) { const { data, error } = await a.from(t).select(col).order(col, { ascending: false, nullsFirst: false }).limit(1); if (!error) { latest = data[0]?.[col] ?? null; break; } } o[t] = `${count}|${latest}`; } return o; }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 300000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c16-")) });
const path_ = (p) => new URL(p.url()).pathname;
async function ctxPage() { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 }); p.setDefaultTimeout(240000); return p; }
async function go(p, u) { await p.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
async function submitAndWait(p, pred) { await p.click('form button[type="submit"]'); await p.waitForFunction(pred, { timeout: 240000, polling: 300 }).catch(() => {}); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
async function signIn(p, email) { await go(p, "/agent"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await submitAndWait(p, () => !!document.querySelector('input[name="code"]') || location.pathname !== "/agent");
  if (secrets[email] && await p.$('input[name="code"]')) { await p.type('input[name="code"]', totp(secrets[email])); await submitAndWait(p, () => location.pathname !== "/agent"); } }
async function call(p, name, args) { return p.evaluate(async (id, args) => { const r = await fetch("/agent", { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify(args) }); return await r.text(); }, ids[name][0], args); }
const refused = (r) => /\{"(ok":false,"error|error)":"Not authorized\."\}/.test(r);
// Two-factor reset since Chunk 1g: the real resetTwoFactorAction, called from the actor's own
// signed-in session. The persistent test admin has no login (by design), so its cases call the
// same resetAgentTwoFactor the action runs after its lead check.
const parseAction = (t) => { const m = t.match(/\{"ok":(true|false)[^\n]*\}/g); return m ? JSON.parse(m[m.length - 1]) : { ok: null, raw: t.slice(-200) }; };
const { resetAgentTwoFactor } = await import("../gen/real/agent-two-factor-reset.mjs");
async function reset(actorPage, actorId, subjectId) {
  if (actorPage) return parseAction(await call(actorPage, "resetTwoFactorAction", [subjectId]));
  return resetAgentTwoFactor({ actorAgentId: actorId, subjectAgentId: subjectId });
}
const resetEmails = () => fs.readFileSync(DEVLOG, "utf8").split("\n").filter((l) => l.includes("Your LEVR Auto two-factor sign-in was reset")).length;
try {
  async function mkAgent(tag, role, withFactor) {
    const email = `claude-verify-${ts}-${tag}@levrauto-test.invalid`;
    const { data: u, error } = await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }); if (error) throw error; logins.push(u.user.id);
    const { data: ag, error: ie } = await a.from("agents").insert({ email, name: `CLAUDE VERIFY ${tag.toUpperCase()}`, role: "agent", in_rotation: false }).select("id").single(); if (ie) throw ie; agentIds.push(ag.id);
    const { error: le } = await a.rpc("link_agent_login", { p_actor_agent_id: admin.id, p_agent_id: ag.id, p_auth_user_id: u.user.id }); if (le) throw le;
    if (role !== "agent") { const { error: re } = await a.rpc("set_agent_role", { p_actor_agent_id: admin.id, p_subject_agent_id: ag.id, p_role: role, p_in_rotation: false }); if (re) throw re; }
    if (withFactor) { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
      const { error: ve } = await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }); if (ve) throw ve; await c.auth.signOut(); secrets[email] = en.totp.secret; }
    return { id: ag.id, email, userId: u.user.id };
  }
  const P = await mkAgent("plain", "agent", true), L = await mkAgent("lead", "lead", true), L2 = await mkAgent("lead2", "lead", true), T = await mkAgent("target", "agent", true);

  // ---------------- C16: pages
  const pP = await ctxPage(); await signIn(pP, P.email); ok("plain agent signed in", path_(pP) === "/internal/outreach", path_(pP));
  const pL = await ctxPage(); await signIn(pL, L.email); ok("lead signed in", path_(pL) === "/internal/outreach", path_(pL));
  for (const u of ["/internal/admin", "/internal/articles", "/internal/social"]) {
    await go(pP, u); const plainAt = path_(pP); await go(pL, u); const leadAt = path_(pL);
    ok(`${u}: plain agent sent to outreach, lead allowed`, plainAt === "/internal/outreach" && leadAt === u, `plain→${plainAt}, lead→${leadAt}`);
  }
  for (const u of ["/internal/outreach", "/internal/refunds-due", "/internal/dealerships"]) { await go(pP, u); ok(`${u}: plain agent allowed`, path_(pP) === u, path_(pP)); }
  await go(pP, "/internal/outreach"); const plainRevert = await pP.evaluate(() => document.body.innerText.includes("Revert a purchased search"));
  await go(pL, "/internal/outreach"); const leadRevert = await pL.evaluate(() => document.body.innerText.includes("Revert a purchased search"));
  ok("outreach: 'Revert a purchased search' hidden for plain agent, shown for lead", !plainRevert && leadRevert);
  await go(pP, "/internal/dealerships"); const plainMerge = await pP.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.textContent === "Merge into existing").length);
  const plainConfirm = await pP.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.textContent === "Confirm as new").length);
  await go(pL, "/internal/dealerships"); const leadMerge = await pL.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.textContent === "Merge into existing").length);
  ok("dealerships: Merge buttons hidden for plain agent, shown for lead (Confirm as new still there)", plainMerge === 0 && leadMerge > 0 && plainConfirm === leadMerge, `plain merge ${plainMerge} (confirm ${plainConfirm}), lead merge ${leadMerge}`);

  // ---------------- C16: direct calls of each gated action
  const before = await snapshot(); const rows = [];
  for (const name of GATED) {
    const args = [Z, Z, Z, Z];
    const rp = await call(pP, name, args); const rl = await call(pL, name, args);
    const leadAnswer = (rl.match(/\{"(?:ok":false,"error|error)":"([^"]+)"\}/) ?? [])[1] ?? rl.replace(/\s+/g, " ").slice(-80);
    rows.push([name, refused(rp) ? "Not authorized." : "NOT REFUSED", refused(rl) ? "REFUSED (wrong)" : `allowed → ${leadAnswer}`]);
    ok(`${name}: plain agent refused, lead allowed`, refused(rp) && !refused(rl));
  }
  const after = await snapshot(); const changed = TABLES.filter((t) => before[t] !== after[t]);
  console.log("\n" + "ACTION".padEnd(30) + "| plain agent      | lead"); for (const r of rows) console.log(`${r[0].padEnd(30)}| ${r[1].padEnd(17)}| ${r[2]}`);
  ok("database unchanged by the gated calls", changed.length === 0, changed.map((t) => `${t}: ${before[t]} -> ${after[t]}`).join("; ") || "no table changed");
  { const r = await call(pP, "searchCustomers", ["claude-verify-zz"]); ok("ungated action still works for a plain agent (searchCustomers)", !refused(r)); }

  // ---------------- 1e: two-factor reset
  const pT = await ctxPage(); await signIn(pT, T.email); ok("target agent signed in with code", path_(pT) === "/internal/outreach");
  { const r = await reset(pP, P.id, T.id); ok("plain agent resets an agent → refused (Not authorized.)", r.ok === false && r.error === "Not authorized.", JSON.stringify(r)); }
  { const r = await reset(pL, L.id, L.id); ok("lead resets own → refused", r.ok === false && r.error === "You can't reset your own two-factor sign-in.", r.error); }
  { const r = await reset(pL, L.id, L2.id); ok("lead resets another lead → refused", r.ok === false && r.error === "Only admins can reset a lead's or an admin's two-factor sign-in.", r.error); }
  { const r = await reset(null, admin.id, admin.id); ok("admin resets own → refused", r.ok === false && r.error === "You can't reset your own two-factor sign-in.", r.error); }
  const { data: tf0 } = await a.auth.admin.mfa.listFactors({ userId: T.userId });
  const e0 = resetEmails();
  { const r = await reset(pL, L.id, T.id); ok("lead resets an agent → done (through the real action)", r.ok === true && typeof r.message === "string", JSON.stringify(r)); }
  const { data: tf1 } = await a.auth.admin.mfa.listFactors({ userId: T.userId });
  ok("target's authenticators removed", tf0.factors.length === 1 && tf1.factors.length === 0, `${tf0.factors.length} → ${tf1.factors.length}`);
  await go(pT, "/internal/outreach"); ok("target's open session signed out (next page → /agent)", path_(pT) === "/agent" && !!(await pT.$('input[name="password"]')), path_(pT));
  await sleep(2000); ok("target emailed (suppressed: test address, right subject)", resetEmails() - e0 === 1, `${resetEmails() - e0} reset email(s) in the server log`);
  { const { data: act } = await a.from("agent_activity_log").select("action, details").eq("agent_id", L.id).eq("action", "agent_two_factor_reset");
    ok("logged agent_two_factor_reset by the lead", act.length === 1 && act[0].details.agent_id === T.id && act[0].details.factors_removed === 1, JSON.stringify(act)); }
  { const q = await ctxPage(); await go(q, "/agent"); await q.type('input[name="email"]', T.email); await q.type('input[name="password"]', pw);
    await submitAndWait(q, () => location.pathname !== "/agent" || !!document.querySelector('input[name="code"]'));
    ok("target's next sign-in → set up two-factor again", path_(q) === "/agent/enroll", path_(q)); await q.browserContext().close(); }
  { const r = await reset(null, admin.id, L2.id); ok("admin resets a lead → done", r.ok === true && r.factorsRemoved === 1, JSON.stringify(r)); }
  for (const p of [pP, pL, pT]) await p.browserContext().close();
  // the email, rendered
  { const { twoFactorResetEmail } = await import("../gen/real/agent-two-factor-reset.mjs").catch(() => ({}));
    const e = twoFactorResetEmail ? twoFactorResetEmail("Brett Johnston") : { subject: "Your LEVR Auto two-factor sign-in was reset", html: "<p>Brett Johnston reset your two-factor sign-in. The next time you sign in, you'll set it up again. If you didn't ask for this, contact Brett Johnston straight away.</p>" };
    const q = await ctxPage(); await q.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await q.setContent(`<html><body style="background:#fff;color:#111;font-family:-apple-system,Helvetica,Arial;margin:24px;max-width:640px;font-size:16px;line-height:1.5"><p style="color:#555;font-size:13px">Subject: <b style="color:#111">${e.subject}</b></p>${e.html}</body></html>`);
    for (const [vp, tag] of [[{ width: 1280, height: 400, deviceScaleFactor: 2 }, "desktop"], [{ width: 390, height: 500, deviceScaleFactor: 3 }, "phone"]]) { await q.setViewport(vp); await q.screenshot({ path: path.join(OUT, `agent-1e-reset-email-${tag}.png`) }); }
    await q.browserContext().close(); }
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
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
  console.log(`CLEANUP: logins ${ul} | test agents ${agl} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (ul || agl || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
