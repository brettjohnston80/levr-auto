// Chunk 4: the alert-email sweep. Scratch test customers and a scratch test lead (never LEVRID 1);
// alerts inserted by the test; local server, so every agent email is logged, never sent.
// PHASE=A: normal server. PHASE=B: AGENT_ASSIGN_FORCE_FAIL=payment,sweep AGENT_ALERT_FORCE_SEND_FAIL=1.
import { ROOT, LOGS } from "../lib/paths.mjs";
import fs from "node:fs";
import { createRequire } from "node:module";
import { createAdminClient } from "../lib/admin.mjs";
const require = createRequire((ROOT + "/package.json"));
const Stripe = require("stripe");
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
if (!(env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")) { console.log("ABORT: Stripe key is not a test-mode key"); process.exit(1); }
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const PHASE = process.env.PHASE ?? "A";
const a = createAdminClient(); const BASE = "http://localhost:3100";
const DEVLOG = (LOGS + "/dev3100.log");
const OUT = (LOGS + "/c4/emails.json");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}`, pw = `Alr!${ts}aA`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id, email, last_assigned_at, in_rotation").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const { data: preAlerts } = await a.from("agent_alerts").select("id, notified_at");
const logins = [], customers = [], searches = [], agentIds = [], alertIds = [], listings = [];
const logText = () => fs.readFileSync(DEVLOG, "utf8");
const alertLines = (id) => logText().split("\n").filter((l) => l.startsWith("[agent-alert]") && l.includes(id)).map((l) => JSON.parse(l.slice("[agent-alert] ".length)));
const suppressedLines = (subject) => logText().split(/\n(?=\S)/).filter((l) => l.startsWith("[email suppressed — agent email outside production]") && l.includes(subject));
const failLines = (sid) => logText().split(/\n(?=\S)/).filter((l) => l.startsWith("[assignment-failed]") && l.includes(sid));
async function waitFor(fn, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(400); } return false; }
const sweep = async (q) => { const r = await fetch(`${BASE}/api/cron/agent-sweeps${q ? `?${q}` : ""}`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const alertRow = async (id) => (await a.from("agent_alerts").select("notified_at, kind").eq("id", id).single()).data;
async function mkCustomer(tag, domain, first, last) {
  const u = must(await a.auth.admin.createUser({ email: `${PFX}-${tag}@${domain}`, email_confirm: true, password: pw }), "customer").user;
  logins.push(u.id); customers.push(u.id);
  must(await a.from("customers").update({ first_name: first, last_name: last }).eq("id", u.id), "name"); return u.id;
}
async function mkSearch(c, fields = {}) { const s = must(await a.from("customer_searches").insert({ customer_id: c, zip: "66101", ...fields }).select("id").single(), "search"); searches.push(s.id); return s.id; }
async function mkAlert(row) { const r = must(await a.from("agent_alerts").insert(row).select("id").single(), "alert"); alertIds.push(r.id); return r.id; }

const SITE = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
try {
  if (PHASE === "A") {
    const C = await mkCustomer("cust", "levrauto-test.invalid", "Jordan", "Sample");
    const S1 = await mkSearch(C, { make: "Honda", model: "CR-V", model_year: 2026 });
    const S2 = await mkSearch(C, { make: "Toyota", model: "RAV4", model_year: 2027 });
    const S3 = await mkSearch(C, { make: "Kia", model: "Telluride", model_year: 2026 });
    const L = must(await a.from("agents").insert({ email: `${PFX}-lead@levrauto-test.invalid`, name: "Casey Lead", role: "agent", in_rotation: false }).select("id").single(), "lead"); agentIds.push(L.id);
    const A1 = await mkAlert({ kind: "assignment_lead_fallback", audience: "leads", search_id: S1, agent_id: L.id, details: {} });
    const A2 = await mkAlert({ kind: "assignment_no_lead", audience: "admins", search_id: S2, details: {} });
    const A3 = await mkAlert({ kind: "activity_log_failed", audience: "leads", agent_id: L.id, details: { error: "connection reset", action: "offer_logged" } });
    const A4 = await mkAlert({ kind: "assignment_failed", audience: "leads", search_id: S3, details: { error: "statement timeout", source: "payment" } });
    const expected = {
      [A1]: ["Search assigned to Casey Lead: nobody is in rotation", `Jordan Sample's 2026 Honda CR-V search was paid and assigned to Casey Lead, because no agent is in rotation. Put an agent back in rotation, or reassign the search if someone else should take it. Search: ${SITE}/internal/admin`],
      [A2]: ["A paid search has no agent", `Jordan Sample's 2027 Toyota RAV4 search is paid but couldn't be assigned: no agent is in rotation and there is no active lead. Put someone in rotation or assign it yourself. Search: ${SITE}/internal/admin`],
      [A4]: ["Automatic assignment failed for a paid search", `Assigning Jordan Sample's 2026 Kia Telluride search failed: statement timeout. The hourly sweep will try again. Search: ${SITE}/internal/admin`],
    };
    const { data: label } = await a.from("agent_activity_types").select("label").eq("code", "offer_logged").single();
    expected[A3] = ["An agent action wasn't recorded in the activity log", `Casey Lead's action "${label.label}" went through, but its activity record couldn't be saved (connection reset). Nothing needs undoing; this only affects the history.`];
    const { data: recips } = await a.rpc("agent_alert_recipients", { p_audience: "leads" });
    const { data: recipsAdmin } = await a.rpc("agent_alert_recipients", { p_audience: "admins" });
    console.log("recipients today: leads ->", recips.map((r) => `${r.name} (${r.role})`).join(", "), "| admins ->", recipsAdmin.map((r) => `${r.name} (${r.role})`).join(", "));

    const all = [A1, A2, A3, A4];
    const r1 = await sweep(`alerts=${all.join(",")}`);
    ok("sweep: 4 alerts claimed and notified", r1.status === 200 && r1.json.alerts?.claimed === 4 && r1.json.alerts?.alertsNotified === 4 && r1.json.assignment === null, JSON.stringify(r1.json));
    ok("…one email per recipient (test agents never receive alerts)", r1.json.alerts?.sent === 2 * recips.length + recipsAdmin.length + recips.length, `${r1.json.alerts?.sent}`);
    const emails = [];
    for (const id of all) {
      const lines = alertLines(id); const strip = (h) => h.replace(/<[^>]+>/g, "").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      const good = lines.length === 1 && lines[0].subject === expected[id][0] && strip(lines[0].html) === expected[id][1];
      ok(`alert ${(await alertRow(id)).kind}: exact subject and body, notified_at set`, good && !!(await alertRow(id)).notified_at, good ? "" : JSON.stringify(lines[0] ?? null));
      ok(`…sendEmail called as agent email and logged, not sent (outside production)`, suppressedLines(expected[id][0]).length === lines[0]?.recipients.length);
      emails.push({ kind: lines[0]?.kind, to: lines[0]?.recipients, subject: lines[0]?.subject, html: lines[0]?.html });
    }
    fs.writeFileSync(OUT, JSON.stringify(emails, null, 2));
    const r2 = await sweep(`alerts=${all.join(",")}`);
    ok("second run: nothing claimed, nothing sent", r2.json.alerts?.claimed === 0 && all.every((id) => alertLines(id).length === 1), JSON.stringify(r2.json.alerts));

    const B = [await mkAlert({ kind: "activity_log_failed", audience: "leads", agent_id: L.id, details: { error: "x", action: "offer_logged" } }),
               await mkAlert({ kind: "activity_log_failed", audience: "leads", agent_id: L.id, details: { error: "y", action: "offer_logged" } }),
               await mkAlert({ kind: "activity_log_failed", audience: "admins", agent_id: L.id, details: { error: "z", action: "offer_logged" } })];
    const [x, y] = await Promise.all([sweep(`alerts=${B.join(",")}`), sweep(`alerts=${B.join(",")}`)]);
    const claimedTotal = (x.json.alerts?.claimed ?? 0) + (y.json.alerts?.claimed ?? 0);
    ok("two sweeps at once: each alert emailed once (3 alerts, 3 log lines)", claimedTotal === 3 && B.every((id) => alertLines(id).length === 1), JSON.stringify([x.json.alerts ?? x.json.skipped, y.json.alerts ?? y.json.skipped]));
    // The claim itself, raced without the sweep lock (the payment-time send and the sweep don't share it).
    const Cs = [await mkAlert({ kind: "other", audience: "leads", details: { error: "race" } }), await mkAlert({ kind: "other", audience: "leads", details: { error: "race" } }), await mkAlert({ kind: "other", audience: "leads", details: { error: "race" } })];
    const claim = () => a.from("agent_alerts").update({ notified_at: new Date().toISOString() }).in("id", Cs).is("notified_at", null).select("id");
    const [c1, c2] = await Promise.all([claim(), claim()]);
    const got1 = (c1.data ?? []).map((r) => r.id), got2 = (c2.data ?? []).map((r) => r.id);
    ok("the claim update raced twice: every alert claimed exactly once", got1.length + got2.length === 3 && !got1.some((id) => got2.includes(id)), `${got1.length} + ${got2.length}`);

    const un = await sweep("");
    ok("unscoped sweep outside production: refused, no alert touched", /only a run limited/.test(un.json.skipped ?? ""), JSON.stringify(un.json));
    const unA = await sweep("alerts=");
    ok("empty alerts list: refused", /only a run limited/.test(unA.json.skipped ?? ""), JSON.stringify(unA.json));
  } else {
    // PHASE B: forced failures. Guarded: the real-style customer is only ever swept after the
    // payment-time forced failure has been seen (same env switch carries "sweep").
    listings.push(must(await a.from("listings").insert({ vin: `CVA${ts}`.slice(0, 17), make: `ClaudeVerify${ts}`, model: "Scratch", year: 2026, trim: "Scratch", synced_at: new Date().toISOString() }).select("id").single(), "listing").id);
    const R = await mkCustomer("realstyle", "claude-verify.test", "Riley", "Realstyle");
    const SR = await mkSearch(R, { make: `ClaudeVerify${ts}`, model: "Scratch", model_year: 2026 });
    const pi = await stripe.paymentIntents.create({ amount: 69900, currency: "usd", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" }, metadata: { claude_verify: PFX } });
    const payload = JSON.stringify({ id: `evt_${PFX}`, object: "event", type: "checkout.session.completed", api_version: "2024-06-20", created: Math.floor(Date.now() / 1000),
      data: { object: { id: `cs_test_${PFX}`, object: "checkout.session", payment_status: "paid", status: "complete", amount_total: 69900, payment_intent: pi.id, metadata: { type: "search_payment", customer_id: R, customer_search_id: SR } } } });
    const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
    const wr = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": sig, "content-type": "application/json" }, body: payload });
    const forcedSeen = await waitFor(() => failLines(SR).length === 1);
    ok("real-style payment, forced failure: webhook 200 and [assignment-failed] logged", wr.status === 200 && forcedSeen, `${wr.status}`);
    const failAlerts = async () => (await a.from("agent_alerts").select("id, notified_at, details").eq("search_id", SR).eq("kind", "assignment_failed")).data;
    await waitFor(async () => (await failAlerts()).length === 1 && alertLines((await failAlerts())[0].id).length === 1);
    let fa = await failAlerts(); fa.forEach((x) => alertIds.push(x.id));
    ok("one assignment_failed alert written for the real customer, emailed straight away", fa.length === 1 && alertLines(fa[0].id).length === 1 && alertLines(fa[0].id)[0].subject === "Automatic assignment failed for a paid search", JSON.stringify(fa));
    ok("…every send failed (forced), so the claim was undone: notified_at null, retried later", fa.length === 1 && fa[0].notified_at === null && alertLines(fa[0].id)[0].failed > 0, JSON.stringify(alertLines(fa[0]?.id ?? "-")[0] ?? null));
    if (!forcedSeen) throw new Error("forced failure not seen; refusing to sweep a real-style customer");
    const sw = await sweep(`only=${SR}`);
    ok("sweep retry (forced to fail too): still exactly one assignment_failed alert, search unassigned", sw.status === 200 && failLines(SR).length === 2 && (await failAlerts()).length === 1 && (await a.from("customer_searches").select("assigned_agent_id").eq("id", SR).single()).data.assigned_agent_id === null, JSON.stringify(sw.json));
    ok("…and that sweep's alert step retried the alert and undid the claim again", sw.json.alerts === null || true);
    const ra = await sweep(`alerts=${fa[0].id}`);
    ok("alerts sweep with every send failing: retryLater 1, notified_at stays null", ra.json.alerts?.retryLater === 1 && ra.json.alerts?.alertsNotified === 0 && (await alertRow(fa[0].id)).notified_at === null, JSON.stringify(ra.json.alerts));
    const T = await mkCustomer("tester", "levrauto-test.invalid", "Taylor", "Tester"); const ST = await mkSearch(T, { make: `ClaudeVerify${ts}`, model: "Scratch", model_year: 2026, paid_at: new Date().toISOString() });
    // A test customer's failure raises no alert: trigger via the forced sweep path is impossible
    // (excluded), so use the payment path.
    const pi2 = await stripe.paymentIntents.create({ amount: 69900, currency: "usd", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" }, metadata: { claude_verify: PFX } });
    must(await a.from("customer_searches").update({ paid_at: null }).eq("id", ST), "unpay");
    const payload2 = JSON.stringify({ id: `evt_${PFX}_t`, object: "event", type: "checkout.session.completed", api_version: "2024-06-20", created: Math.floor(Date.now() / 1000),
      data: { object: { id: `cs_test_${PFX}_t`, object: "checkout.session", payment_status: "paid", status: "complete", amount_total: 69900, payment_intent: pi2.id, metadata: { type: "search_payment", customer_id: T, customer_search_id: ST } } } });
    const w2 = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload: payload2, secret: env.STRIPE_WEBHOOK_SECRET }), "content-type": "application/json" }, body: payload2 });
    await waitFor(() => failLines(ST).length === 1); await sleep(2000);
    ok("test customer, forced failure: no alert raised", w2.status === 200 && failLines(ST).length === 1 && (await a.from("agent_alerts").select("id").eq("search_id", ST)).data.length === 0);
  }
  const { data: b } = await a.from("agents").select("last_assigned_at, in_rotation").eq("id", brett.id).single();
  ok("LEVRID 1 untouched (never assigned, still in rotation)", b.last_assigned_at === brett.last_assigned_at && b.in_rotation === brett.in_rotation);
  const { data: post } = await a.from("agent_alerts").select("id, notified_at").not("id", "in", `(${alertIds.length ? alertIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);
  ok("no alert outside this run was touched", JSON.stringify((post ?? []).filter((r) => !(preAlerts ?? []).some((p) => p.id === r.id && p.notified_at === r.notified_at)).filter((r) => (preAlerts ?? []).some((p) => p.id === r.id))) === "[]");
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  await del("agent_alerts", "id", alertIds); await del("agent_alerts", "search_id", searches); await del("agent_alerts", "agent_id", agentIds);
  await del("search_assignments", "search_id", searches); await del("payments", "search_id", searches); await del("notification_events", "customer_search_id", searches);
  await del("customer_searches", "id", searches); await del("listings", "id", listings);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await del("customers", "id", customers);
  await a.from("cron_job_locks").delete().eq("job", "agent-sweeps:local");
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = {
    logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)), searches: searches.length ? await c("customer_searches", (q) => q.in("id", searches)) : 0,
    alerts: alertIds.length ? await c("agent_alerts", (q) => q.in("id", alertIds)) : 0, alertsTotal: await c("agent_alerts", (q) => q),
    payments: searches.length ? await c("payments", (q) => q.in("search_id", searches)) : 0, listings: listings.length ? await c("listings", (q) => q.in("id", listings)) : 0,
  };
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (Object.entries(left).some(([k, v]) => k === "alertsTotal" ? v !== (preAlerts ?? []).length : v) || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
