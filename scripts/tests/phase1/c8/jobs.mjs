// Chunk 8 rehearsal: every scheduled job whose code changed in Phase 1, run end to end through its
// real route on scratch data only (?only=<ids>), twice (the second run must do nothing). Stripe
// test mode only. Shows what each job did.
import { ROOT, LOGS } from "../lib/paths.mjs";
import fs from "node:fs"; import { createRequire } from "node:module";
import { createAdminClient } from "../lib/admin.mjs";
const require = createRequire((ROOT + "/package.json")); const Stripe = require("stripe");
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
if (!(env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")) { console.log("ABORT: Stripe key is not a test-mode key"); process.exit(1); }
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const a = createAdminClient(); const BASE = "http://localhost:3100";
const DEVLOG = (LOGS + "/dev3100.log");
const ts = Date.now(), PFX = `claude-verify-${ts}`, pw = `Job!${ts}aA`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const must = (r, w) => { if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data; };
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();
const { data: brett } = await a.from("agents").select("id, last_assigned_at").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id);
// Untouched-control: a snapshot of every search that ISN'T ours (status, deadline fields, reminder stamps).
const snap = async () => { const { data } = await a.from("customer_searches").select("id, search_status, paused_at, search_deadline_at, deadline_reminder_sent_for, resume_reminder_sent_for, assigned_agent_id").order("id"); return data; };
const before = await snap();
const logins = [], searches = [], articles = [];
const call = async (route, only, extra = "") => { const r = await fetch(`${BASE}/api/cron/${route}${only ? `?only=${only.join(",")}${extra}` : ""}`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const row = async (id) => (await a.from("customer_searches").select("search_status, paused_at, search_deadline_at, deadline_reminder_sent_for, resume_reminder_sent_for, assigned_agent_id").eq("id", id).single()).data;
const logText = () => fs.readFileSync(DEVLOG, "utf8");
const report = {};
try {
  const mk = async (tag, domain = "levrauto-test.invalid") => { const u = must(await a.auth.admin.createUser({ email: `${PFX}-${tag}@${domain}`, email_confirm: true, password: pw }), tag).user; logins.push(u.id);
    must(await a.from("customers").update({ first_name: "Job", last_name: tag, notify_by_email: true }).eq("id", u.id), "name"); return u.id; };
  const C1 = await mk("one"), C2 = await mk("autorenew"), CR = await mk("realstyle", "claude-verify.test");
  const ins = async (c, f) => { const id = must(await a.from("customer_searches").insert({ customer_id: c, zip: "66101", make: "Toyota", model: "Camry", model_year: 2026, paid_at: daysAgo(70), finalized_at: daysAgo(70), ...f }).select("id").single(), "search").id; searches.push(id); return id; };
  const D1 = await ins(C1, { search_status: "searching", solidified_at: daysAgo(55) });             // Day-60 reminder due (deadline in 5 days)
  const D2 = await ins(C1, { search_status: "searching", solidified_at: daysAgo(61) });             // overdue: paused
  const D3 = await ins(C2, { search_status: "searching", solidified_at: daysAgo(61), auto_renew_enabled: true }); // overdue with auto-renew: charged and extended
  const R1 = await ins(C1, { search_status: "paused", solidified_at: daysAgo(90), paused_at: daysAgo(25) });      // resume reminder due (window ends in 5 days)
  const SR = await ins(CR, { search_status: "searching", solidified_at: daysAgo(1), paid_at: daysAgo(1) });     // real-style, unassigned: sweep dry run only
  // Auto-renew customer: a Stripe test customer with a saved test card.
  const sc = await stripe.customers.create({ email: `${PFX}-autorenew@levrauto-test.invalid`, metadata: { claude_verify: PFX } });
  const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: sc.id });
  must(await a.from("customers").update({ stripe_customer_id: sc.id, stripe_default_payment_method_id: pm.id }).eq("id", C2), "stripe fields");
  // Digest: one routine event for C1.
  must(await a.from("notification_events").insert({ customer_id: C1, customer_search_id: D1, event_type: "offer_response_recorded", event_data: { dealerName: "CLAUDE VERIFY MOTORS", response: "accepted" } }), "event");
  // Article reminder: a scratch draft whose scheduled publish date has passed.
  articles.push(must(await a.from("articles").insert({ slug: `${PFX}-article`, title: "CLAUDE VERIFY ARTICLE", topic: "Rehearsal", status: "draft", scheduled_month: "2026-10-01", content: "Scratch." }).select("id").single(), "article").id);

  // Every changed job refuses an unscoped local run.
  for (const r of ["agent-sweeps", "day60-deadline-reminder", "day60-pause-overdue-searches", "day60-resume-reminder", "notification-digest", "article-reminder"]) {
    const u = await call(r, null);
    ok(`${r}: unscoped run outside production refused`, u.status === 200 && /only/.test(u.json.skipped ?? ""), JSON.stringify(u.json));
  }

  // Day-60 deadline reminder
  { const r1 = await call("day60-deadline-reminder", [D1, D2, R1]); const s1 = await row(D1);
    report["day60-deadline-reminder"] = r1.json;
    ok("Day-60 reminder: sent for the search 5 days from its deadline only; stamped deadline_reminder_sent_for", r1.json.remindersSent?.length === 1 && JSON.stringify(r1.json.remindersSent).includes(D1) && !!s1.deadline_reminder_sent_for, JSON.stringify(r1.json));
    const r2 = await call("day60-deadline-reminder", [D1]);
    ok("…second run sends nothing", r2.json.remindersSent?.length === 0, JSON.stringify(r2.json)); }
  // Day-60 pause (one plain, one auto-renew)
  { const r1 = await call("day60-pause-overdue-searches", [D2, D3, D1]); const s2 = await row(D2), s3 = await row(D3);
    report["day60-pause-overdue-searches"] = r1.json;
    const pays = (await a.from("payments").select("payment_type, amount_cents, stripe_payment_intent_id").eq("search_id", D3)).data;
    ok("Day-60 pause: the overdue search is paused (paused_at set)", s2.search_status === "paused" && !!s2.paused_at && JSON.stringify(r1.json.paused).includes(D2), JSON.stringify(s2));
    ok("…the auto-renew search is charged $100 (Stripe test), extended 30 days, still searching, payment recorded", s3.search_status === "searching" && new Date(s3.search_deadline_at) > new Date() && pays?.length === 1 && pays[0].amount_cents === 10000 && JSON.stringify(r1.json.autoRenewed).includes(D3), JSON.stringify({ s3, pays }));
    if (pays?.[0]) { const pi = await stripe.paymentIntents.retrieve(pays[0].stripe_payment_intent_id); ok("…the Stripe test charge succeeded", pi.status === "succeeded" && pi.amount === 10000, pi.status); }
    ok("…the search not yet due is untouched", (await row(D1)).search_status === "searching");
    const r2 = await call("day60-pause-overdue-searches", [D2, D3, D1]);
    ok("…second run does nothing", (r2.json.paused?.length ?? 0) === 0 && (r2.json.autoRenewed?.length ?? 0) === 0, JSON.stringify(r2.json)); }
  // Resume reminder
  { const r1 = await call("day60-resume-reminder", [R1, D2]); const s = await row(R1);
    report["day60-resume-reminder"] = r1.json;
    ok("Resume reminder: sent for the search paused 25 days ago only; stamped resume_reminder_sent_for", r1.json.remindersSent?.length === 1 && JSON.stringify(r1.json.remindersSent).includes(R1) && !!s.resume_reminder_sent_for, JSON.stringify(r1.json));
    const r2 = await call("day60-resume-reminder", [R1]);
    ok("…second run sends nothing", r2.json.remindersSent?.length === 0, JSON.stringify(r2.json)); }
  // Notification digest (customer ids)
  { const r1 = await call("notification-digest", [C1]); const ev = (await a.from("notification_events").select("digest_sent_at").eq("customer_id", C1)).data;
    report["notification-digest"] = r1.json;
    ok("Digest: one daily update for the scratch customer; its event stamped digest_sent_at", r1.json.sent?.length === 1 && ev.every((e) => !!e.digest_sent_at), JSON.stringify(r1.json));
    const r2 = await call("notification-digest", [C1]);
    ok("…second run sends nothing", (r2.json.sent?.length ?? 0) === 0, JSON.stringify(r2.json)); }
  // Article reminder (article ids)
  { const r1 = await call("article-reminder", articles); const art = (await a.from("articles").select("reminder_last_threshold_days").eq("id", articles[0]).single()).data;
    report["article-reminder"] = r1.json;
    const agentLogged = logText().split(/\n(?=\S)/).filter((l) => l.includes("[email suppressed — agent email outside production]") && l.includes("CLAUDE VERIFY ARTICLE")).length;
    ok("Article reminder: sent for the overdue scratch draft (agent email logged, not sent, outside production); threshold stamped", (r1.json.remindersSent?.length ?? 0) === 1 && art.reminder_last_threshold_days === 0 && agentLogged >= 1, JSON.stringify({ json: r1.json, art, agentLogged }));
    const r2 = await call("article-reminder", articles);
    ok("…second run sends nothing", (r2.json.remindersSent?.length ?? 0) === 0, JSON.stringify(r2.json)); }
  // Agent sweep: scoped, and a dry run over a real-style customer (never a real run on one).
  { const dry = await call("agent-sweeps", [SR, D1], "&dry_run=1");
    report["agent-sweeps (dry run)"] = dry.json;
    ok("Agent sweep dry run: would assign the real-style paid search; the test customer's search left out; nothing written", JSON.stringify(dry.json.assignment?.wouldAssign) === JSON.stringify([SR]) && dry.json.assignment?.testCustomersExcluded > 0 && (await row(SR)).assigned_agent_id === null, JSON.stringify(dry.json));
    const real = await call("agent-sweeps", [D1]);
    report["agent-sweeps (scoped, test search)"] = real.json;
    ok("Agent sweep scoped to a test customer's search: examined 0, nothing assigned", real.json.assignment?.examined === 0 && (await row(D1)).assigned_agent_id === null, JSON.stringify(real.json)); }

  // Nothing outside the scratch searches changed.
  const after = await snap(); const ours = new Set(searches);
  const changed = after.filter((r) => !ours.has(r.id)).filter((r) => JSON.stringify(r) !== JSON.stringify(before.find((b) => b.id === r.id)));
  ok("no tester or real search changed (status, deadlines, reminder stamps, agent)", changed.length === 0 && after.filter((r) => !ours.has(r.id)).length === before.length, `${changed.length} changed`);
  const { data: b } = await a.from("agents").select("last_assigned_at").eq("id", brett.id).single();
  ok("LEVRID 1 untouched", b.last_assigned_at === brett.last_assigned_at);
  fs.writeFileSync((LOGS + "/c8/jobs-report.json"), JSON.stringify(report, null, 2));
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  await del("notification_events", "customer_search_id", searches); await del("payments", "search_id", searches);
  await del("agent_activity_log", "search_id", searches); await del("search_assignments", "search_id", searches); await del("agent_alerts", "search_id", searches);
  await del("customer_searches", "id", searches); await del("articles", "id", articles);
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await del("customers", "id", logins);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = { searches: searches.length ? await c("customer_searches", (q) => q.in("id", searches)) : 0, articles: articles.length ? await c("articles", (q) => q.in("id", articles)) : 0,
    payments: searches.length ? await c("payments", (q) => q.in("search_id", searches)) : 0,
    logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length };
  const b1 = await cnt(brett.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
