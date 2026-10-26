// Chunk 7: queue fixes, measured on the real pages. LABEL=before|after (same test, before and after the fix).
// Scratch data only, all on disposable .invalid customers and a disposable lead (never LEVRID 1); deleted afterwards.
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const LABEL = process.env.LABEL ?? "after";
const a = createAdminClient(); const BASE = "http://localhost:3100";
const SHOTS = `${LOGS}/shots/agent-phase1-chunk7`;
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}`, pw = `Que!${ts}aA`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, w) => { if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data; };
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const logins = [], customers = [], agentIds = [];
const metrics = {};
let browser;
async function mkCustomer(tag) { const email = `${PFX}-${tag}@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw }), "customer").user; logins.push(u.id); customers.push(u.id);
  must(await a.from("customers").update({ first_name: "Queue", last_name: tag }).eq("id", u.id), "name"); return { id: u.id, email }; }
const insertMany = async (table, rows) => { const ids = []; for (let i = 0; i < rows.length; i += 500) ids.push(...must(await a.from(table).insert(rows.slice(i, i + 500)).select("id"), table).map((r) => r.id)); return ids; };
try {
  // A disposable LEAD (the admin table is lead-only) with two-factor.
  const email = `${PFX}-lead@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
  const L = must(await a.from("agents").insert({ email, name: "Casey Lead", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(L.id);
  must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: L.id, p_auth_user_id: u.id }), "link");
  must(await a.rpc("set_agent_role", { p_actor_agent_id: padmin.id, p_subject_agent_id: L.id, p_role: "lead", p_in_rotation: false }), "role");
  let secret; { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
    must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut(); secret = en.totp.secret; }

  // ---------- scratch data
  const CB = await mkCustomer("callbacks");
  const SCB = must(await a.from("customer_searches").insert({ customer_id: CB.id, zip: "66101", make: "Toyota", model: "Camry", model_year: 2026 }).select("id").single(), "search").id;
  const t0 = Date.now() - 3600e3;
  const plain = Array.from({ length: 1000 }, (_, i) => ({ customer_id: CB.id, customer_search_id: SCB, event_type: "offer_logged", created_at: new Date(t0 + i * 1000).toISOString() }));
  await insertMany("notification_events", plain);
  const later = new Date(t0 + 2000 * 1000).toISOString();
  await insertMany("notification_events", [
    // Every row carries every key (PostgREST sends NULL for a key one row omits; see CLAUDE.md).
    ...Array.from({ length: 5 }, () => ({ customer_id: CB.id, customer_search_id: SCB, event_type: "offer_logged", agent_callback_requested_at: later, flagged_no_deliverable_channel: false, created_at: later })),
    ...Array.from({ length: 2 }, () => ({ customer_id: CB.id, customer_search_id: SCB, event_type: "offer_logged", agent_callback_requested_at: null, flagged_no_deliverable_channel: true, created_at: later })),
  ]);
  const AD = await mkCustomer("admin");
  // Paid, so they show under the table's default "All" (which hides unpaid searches).
  await insertMany("customer_searches", Array.from({ length: 1005 }, (_, i) => ({ customer_id: AD.id, zip: "66101", make: "Toyota", model: "Camry", model_year: 2026, paid_at: new Date().toISOString(), created_at: new Date(Date.now() - i * 1000).toISOString() })));
  const AS = await mkCustomer("assigned");
  const SAS = must(await a.from("customer_searches").insert({ customer_id: AS.id, zip: "66101", make: "Honda", model: "Civic", model_year: 2026, paid_at: new Date().toISOString(), search_status: "searching" }).select("id").single(), "search").id;
  // Its customers.email copy is stale on purpose: the table must show the login's real email,
  // which only comes from paging through every auth user.
  must(await a.from("customers").update({ email: `stale-${ts}@levrauto-test.invalid` }).eq("id", AS.id), "stale email");
  must(await a.rpc("reassign_search", { p_search_id: SAS, p_new_agent_id: L.id, p_actor_agent_id: padmin.id, p_reason: "Claude verify: admin table column" }), "reassign");
  const UC = await mkCustomer("undecided-cancelled"); const UW = await mkCustomer("undecided-waiting");
  must(await a.from("customer_searches").insert([{ customer_id: UC.id, zip: "66101", make: null, model: null, paid_at: new Date().toISOString(), search_status: "cancelled", cancelled_at: new Date().toISOString() },
    { customer_id: UW.id, zip: "66101", make: null, model: null, paid_at: new Date().toISOString(), search_status: "awaiting_finalization", cancelled_at: null }]), "undecided searches");
  const { count: totalSearches } = await a.from("customer_searches").select("id", { count: "exact", head: true });
  console.log(`scratch data ready; customer_searches in the database: ${totalSearches}`);

  // ---------- sign in as the lead
  await sleep(31000);
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c7-")) });
  const p = await browser.newPage(); p.setDefaultTimeout(300000); await p.setViewport({ width: 1440, height: 900 });
  await p.goto(`${BASE}/agent`, { waitUntil: "networkidle2" }); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await p.click('form:has(input[name="password"]) button[type="submit"]'); await p.waitForSelector('input[name="code"]'); await p.type('input[name="code"]', totp(secret));
  await p.click('form:has(input[name="code"]) button[type="submit"]'); await p.waitForFunction(() => location.pathname !== "/agent", { timeout: 240000, polling: 300 });

  // ---------- outreach: callback queue and vehicle consultation
  await p.goto(`${BASE}/internal/outreach`, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 2000, timeout: 240000 }).catch(() => {});
  const sectionCount = (heading, needle) => p.evaluate((h, n) => { const hd = [...document.querySelectorAll("h2")].find((x) => x.textContent.trim().startsWith(h)); if (!hd) return -1; const sec = hd.parentElement; return (sec.innerText.match(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length; }, heading, needle);
  metrics.callbacksShown = await sectionCount("Customer callbacks requested", CB.email);
  metrics.undeliverableShown = await sectionCount("Notification undeliverable", CB.email);
  metrics.consultCancelledShown = await sectionCount("Vehicle consultation needed", UC.email);
  metrics.consultWaitingShown = await sectionCount("Vehicle consultation needed", UW.email);
  const box = (h) => p.evaluate((h) => { const hd = [...document.querySelectorAll("h2")].find((x) => x.textContent.trim().startsWith(h)); if (!hd) return null; hd.parentElement.scrollIntoView(); const r = hd.parentElement.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: Math.min(r.height, 1400) }; }, h);
  for (const [w, hgt, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
    await p.setViewport({ width: w, height: hgt }); await sleep(800);
    for (const [h, name] of [["Customer callbacks requested", "callbacks"], ["Vehicle consultation needed", "consultation"]]) { const b = await box(h); if (b) await p.screenshot({ path: `${SHOTS}/${LABEL}-${name}-${tag}.png`, clip: b, captureBeyondViewport: true }); }
  }
  await p.setViewport({ width: 1440, height: 900 });

  // ---------- admin table
  await p.goto(`${BASE}/internal/admin`, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 2000, timeout: 240000 }).catch(() => {});
  metrics.adminRowsTotal = await p.evaluate(() => document.querySelectorAll("tbody tr").length);
  metrics.adminRowsScratch = await p.evaluate((e) => [...document.querySelectorAll("tbody tr")].filter((tr) => tr.innerText.includes(e)).length, AD.email);
  metrics.adminAssignedCell = await p.evaluate((e) => { const tr = [...document.querySelectorAll("tbody tr")].find((x) => x.innerText.includes(e)); return tr ? tr.innerText.replace(/\s+/g, " ") : null; }, AS.email);
  metrics.adminEmailsResolved = await p.evaluate((e) => [...document.querySelectorAll("tbody tr")].filter((tr) => tr.innerText.includes(e)).length, AS.email);
  // What "All" should show: every search except unpaid ones (awaiting_finalization with no paid_at).
  const { count: dbTotal } = await a.from("customer_searches").select("id", { count: "exact", head: true });
  const { count: dbUnpaid } = await a.from("customer_searches").select("id", { count: "exact", head: true }).eq("search_status", "awaiting_finalization").is("paid_at", null);
  metrics.dbSearchesTotal = dbTotal; metrics.dbShownUnderAll = dbTotal - dbUnpaid;
  for (const [w, hgt, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
    await p.setViewport({ width: w, height: hgt }); await sleep(800);
    const b = await p.evaluate((e) => { const tr = [...document.querySelectorAll("tbody tr")].find((x) => x.innerText.includes(e)); if (!tr) return null; tr.scrollIntoView({ block: "center" }); const t = tr.closest("table").getBoundingClientRect(), r = tr.getBoundingClientRect(); return { x: Math.max(0, t.left + scrollX), y: r.top + scrollY - 60, width: Math.min(t.width, innerWidth), height: r.height + 120 }; }, AS.email);
    if (b) await p.screenshot({ path: `${SHOTS}/${LABEL}-admin-assigned-row-${tag}.png`, clip: b, captureBeyondViewport: true });
  }
  console.log(`METRICS ${LABEL}: ${JSON.stringify(metrics)}`);
  if (LABEL !== "before") {
    ok("callback queue: all 5 callback requests shown (they sit past the first 1,000 events)", metrics.callbacksShown === 5, `${metrics.callbacksShown}`);
    ok("…and both 'undeliverable' flags", metrics.undeliverableShown === 2, `${metrics.undeliverableShown}`);
    ok("vehicle consultation: the cancelled undecided search is gone; the waiting one shows", metrics.consultCancelledShown === 0 && metrics.consultWaitingShown === 1, JSON.stringify([metrics.consultCancelledShown, metrics.consultWaitingShown]));
    ok("admin table: every search the 'All' view should show is a row (more than 1,000)", metrics.adminRowsTotal === metrics.dbShownUnderAll && metrics.adminRowsTotal > 1000, `${metrics.adminRowsTotal} rows / ${metrics.dbShownUnderAll} expected`);
    ok("…all 1,005 scratch searches present", metrics.adminRowsScratch === 1005, `${metrics.adminRowsScratch}`);
    ok("…the assigned search shows its agent's name", (metrics.adminAssignedCell ?? "").includes("Casey Lead"), metrics.adminAssignedCell);
    ok(`…its customer shows the login's real email, not the stale copy (users read in pages${process.env.USERS_PAGE ? " of " + process.env.USERS_PAGE : ""})`, (metrics.adminAssignedCell ?? "").includes(AS.email) && !(metrics.adminAssignedCell ?? "").includes(`stale-${ts}`), metrics.adminAssignedCell);
  }
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser?.close().catch(() => {});
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  const { data: ss } = customers.length ? await a.from("customer_searches").select("id").in("customer_id", customers) : { data: [] };
  const sids = (ss ?? []).map((r) => r.id);
  await del("notification_events", "customer_id", customers);
  for (let i = 0; i < sids.length; i += 300) { const part = sids.slice(i, i + 300);
    await del("agent_activity_log", "search_id", part); await del("search_assignments", "search_id", part); await del("agent_alerts", "search_id", part); await del("customer_searches", "id", part); }
  await del("agent_activity_log", "agent_id", agentIds); await a.from("agent_activity_log").delete().eq("agent_id", padmin.id).gte("created_at", runStart);
  // A search can be assigned to a test agent but belong to a test login rather than a test customer;
  // clear those first, or the agent delete is refused (customer_searches.assigned_agent_id).
  if (agentIds.length) { const { data: held } = await a.from("customer_searches").select("id").in("assigned_agent_id", agentIds);
    const hid = (held ?? []).map((r) => r.id);
    if (hid.length) { await del("agent_activity_log", "search_id", hid); await del("search_assignments", "search_id", hid); await del("agent_alerts", "search_id", hid); await del("customer_searches", "id", hid); } }
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await del("customers", "id", customers); await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = { logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)), searches: customers.length ? await c("customer_searches", (q) => q.in("customer_id", customers)) : 0,
    events: customers.length ? await c("notification_events", (q) => q.in("customer_id", customers)) : 0 };
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
