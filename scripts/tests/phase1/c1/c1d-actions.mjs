// Call every agent server action directly (no page render), as: (a) no session, (b) a customer, (c) an agent with password only.
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { createAdminClient } from "../lib/admin.mjs";
const a = createAdminClient(); const BASE = "http://localhost:3100"; const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), pw = `Act!${ts}aA`;
const ids = JSON.parse(fs.readFileSync(new URL("./action-ids.json", import.meta.url)));
const emailC = `claude-verify-${ts}-c@verify.invalid`, emailA = `claude-verify-${ts}-a@levrauto-test.invalid`;
const Z = "00000000-0000-0000-0000-000000000000";
// Tables these actions can write to: count + newest change, before and after.
const TABLES = ["qualifying_offers","offer_addons","deal_progress","customer_searches","agents","dealerships","dealer_aliases","dealership_salespeople","articles","social_posts","offer_messages","general_threads","refunds","cancellation_log","agent_bypass_log","purchase_status_log","documents","notification_events","search_assignments","agent_activity_log","agent_alerts","payments","listings"];
async function snapshot() {
  const out = {};
  for (const t of TABLES) {
    const { count, error } = await a.from(t).select("*", { count: "exact", head: true });
    if (error) { out[t] = `ERR ${error.message}`; continue; }
    let latest = null;
    for (const col of ["updated_at", "created_at"]) {
      const { data, error: e2 } = await a.from(t).select(col).order(col, { ascending: false, nullsFirst: false }).limit(1);
      if (!e2) { latest = data[0]?.[col] ?? null; break; }
    }
    out[t] = `${count} | ${latest}`;
  }
  return out;
}
const { data: admin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const logins = []; let agentId = null;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 300000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c1d-act-")) });
let pass = 0, fail = 0; const failures = [];
try {
  const mk = async (email, agent) => { const { data, error } = await a.auth.admin.createUser({ email, email_confirm: true, password: pw, ...(agent ? { app_metadata: { account_type: "agent" } } : {}) }); if (error) throw error; logins.push(data.user.id); return data.user.id; };
  const uC = await mk(emailC, false), uA = await mk(emailA, true);
  const { data: ag } = await a.from("agents").insert({ email: emailA, name: "CLAUDE VERIFY ACTION AGENT", role: "agent", in_rotation: false }).select("id").single(); agentId = ag.id;
  await a.rpc("link_agent_login", { p_actor_agent_id: admin.id, p_agent_id: ag.id, p_auth_user_id: uA });
  // the agent has a real authenticator, so "password only" is a genuine first-level session
  const { createClient } = await import("@supabase/supabase-js");
  const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
  const crypto = await import("node:crypto");
  const totp = (s) => { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); };
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: emailA, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
  await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }); await c.auth.signOut();

  const sessions = {};
  { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.goto(BASE + "/agent", { waitUntil: "networkidle0", timeout: 300000 }); sessions["a. no session"] = p; }
  { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); p.setDefaultTimeout(240000);
    await p.goto(BASE + "/login", { waitUntil: "networkidle0", timeout: 300000 }); await p.type('input[name="email"]', emailC); await p.type('input[name="password"]', pw);
    await p.click('form button[type="submit"]'); await p.waitForFunction(() => location.pathname !== "/login", { timeout: 240000 });
    await p.goto(BASE + "/agent", { waitUntil: "networkidle0", timeout: 300000 }); sessions["b. customer"] = p; }
  { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); p.setDefaultTimeout(240000);
    await p.goto(BASE + "/agent", { waitUntil: "networkidle0", timeout: 300000 }); await p.type('input[name="email"]', emailA); await p.type('input[name="password"]', pw);
    await p.click('form button[type="submit"]'); await p.waitForSelector('input[name="code"]', { timeout: 240000 });
    const { data: aal } = { data: null }; sessions["c. agent, password only"] = p; }
  // confirm the three sessions are what they claim to be
  for (const [label, p] of Object.entries(sessions)) {
    const names = (await p.cookies()).filter((x) => x.name.includes("auth-token")).length;
    console.log(`session ${label}: auth cookies ${names}`);
  }

  const before = await snapshot();
  const results = {};
  for (const [name, [id, file]] of Object.entries(ids)) {
    results[name] = { file };
    for (const [label, p] of Object.entries(sessions)) {
      const r = await p.evaluate(async (id, Z) => {
        const res = await fetch("/agent", { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify([Z, Z, Z, Z]) });
        return { status: res.status, body: await res.text() };
      }, id, Z);
      const clean = /\{"(ok":false,"error|error)":"[^"]*Not authorized\."\}/.test(r.body);
      results[name][label] = clean ? "Not authorized." : `UNEXPECTED ${r.status} ${r.body.replace(/\s+/g, " ").slice(-160)}`;
      clean ? pass++ : (fail++, failures.push(`${name} [${label}]: ${results[name][label]}`));
    }
  }
  const after = await snapshot();
  const changed = TABLES.filter((t) => before[t] !== after[t]);
  console.log("\nACTION".padEnd(38) + "| a. no session     | b. customer       | c. agent, password only");
  for (const [name, r] of Object.entries(results)) console.log(`${(name + " (" + r.file.replace("lib/", "") + ")").padEnd(70).slice(0, 70)} | ${r["a. no session"].padEnd(17)} | ${r["b. customer"].padEnd(17)} | ${r["c. agent, password only"]}`);
  console.log(`\nDATABASE: ${TABLES.length} tables checked; changed during the calls: ${changed.length ? changed.map((t) => `${t}: ${before[t]} -> ${after[t]}`).join("; ") : "none"}`);
  if (changed.length) fail++;
  for (const f of failures) console.log("FAIL", f);
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser.close();
  if (agentId) { await a.from("agent_activity_log").delete().eq("agent_id", agentId); await a.from("agents").delete().eq("id", agentId); }
  await a.from("agent_activity_log").delete().eq("agent_id", admin.id).gte("created_at", runStart);
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  let ul = 0; for (const id of logins) if ((await a.auth.admin.getUserById(id)).data?.user) ul++;
  const { count: agl } = await a.from("agents").select("id", { count: "exact", head: true }).ilike("email", `claude-verify-${ts}%`);
  console.log(`CLEANUP: logins ${ul} | test agents ${agl}`);
  console.log(`${pass} of ${Object.keys(ids).length * 3} calls refused cleanly; ${fail} problems`);
  console.log(`${pass} passed, ${Object.keys(ids).length * 3 - pass} failed`);
}
