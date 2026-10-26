// Chunk 5: guarantee refunds on /internal/refunds-due and the per-refund reason on the cancellation
// form. Stripe TEST mode only (aborts otherwise); disposable @verify.invalid customers and a
// disposable agent (never LEVRID 1); everything deleted afterwards and confirmed by count.
// PHASE=A: normal server. PHASE=B: server with AGENT_REFUND_FORCE_RECORD_FAIL=1.
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createRequire } from "node:module";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
const require = createRequire((ROOT + "/package.json"));
const Stripe = require("stripe");
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
if (!(env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")) { console.log("ABORT: Stripe key is not a test-mode key"); process.exit(1); }
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const PHASE = process.env.PHASE ?? "A";
const a = createAdminClient(); const BASE = "http://localhost:3100";
const SHOTS = `${LOGS}/shots/agent-phase1-chunk5`;
const MANIFEST = (ROOT + "/.next/dev/server/server-reference-manifest.json");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}`, pw = `Ref!${ts}aA`;
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const logins = [], customers = [], searches = [], agentIds = [], paymentIds = [], stripeRefunds = [];
let browser;

async function mkCustomer(first, last) {
  const u = must(await a.auth.admin.createUser({ email: `${PFX}-${first.toLowerCase()}@verify.invalid`, email_confirm: true, password: pw }), "customer").user;
  logins.push(u.id); customers.push(u.id);
  must(await a.from("customers").update({ first_name: first, last_name: last }).eq("id", u.id), "name"); return u.id;
}
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();
async function mkSearch(c, f = {}) { const s = must(await a.from("customer_searches").insert({ customer_id: c, zip: "66101", make: "Toyota", model: "Camry", model_year: 2026, trim: "SE", search_status: "searching", paid_at: daysAgo(36), finalized_at: daysAgo(36), solidified_at: daysAgo(35), ...f }).select("id").single(), "search"); searches.push(s.id); return s.id; }
async function charge(amount, pm = "pm_card_visa") { return (await stripe.paymentIntents.create({ amount, currency: "usd", payment_method: pm, confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" }, metadata: { claude_verify: PFX } })).id; }
async function mkPayment(c, s, type, amount, pi) { const p = must(await a.from("payments").insert({ customer_id: c, search_id: s, payment_type: type, stripe_payment_intent_id: pi ?? await charge(amount), amount_cents: amount }).select("id, stripe_payment_intent_id").single(), "payment"); paymentIds.push(p.id); return p; }
async function mkDue(first, last, opts = {}) {
  const c = await mkCustomer(first, last);
  const s = await mkSearch(c, { guarantee_status: "refunded", guarantee_resolved_at: daysAgo(4 - (opts.order ?? 0) * 0.01) });
  const p = await mkPayment(c, s, "search_fee", 69900, opts.pi);
  return { c, s, p };
}
// A switch chain: the original search (switched; $699 there) -> the search due a refund ($100 paid switch).
async function mkChain(first, last, opts = {}) {
  const c = await mkCustomer(first, last);
  const n = await mkSearch(c, { make: "Toyota", model: "RAV4", trim: "XLE", guarantee_status: "refunded", guarantee_resolved_at: daysAgo(4 - (opts.order ?? 0) * 0.01) });
  const o = await mkSearch(c, { search_status: "switched", superseded_by_id: n, paid_at: daysAgo(40) });
  const fee = await mkPayment(c, o, "search_fee", 69900);
  const sw = await mkPayment(c, n, "switch_fee", 10000, opts.switchPi);
  return { c, s: n, o, p: fee, sw };
}
const payment = async (id) => (await a.from("payments").select("amount_cents, refunded_cents").eq("id", id).single()).data;
const refundRows = async (paymentId) => (await a.from("refunds").select("id, reason, agent_id, amount_cents, stripe_refund_id, cancellation_log_id").eq("payment_id", paymentId)).data;
const activityFor = async (agentId, searchId) => (await a.from("agent_activity_log").select("action").eq("agent_id", agentId).eq("search_id", searchId)).data;

async function shot(p, name, el) {
  for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
    await p.setViewport({ width: w, height: h }); await sleep(400);
    const target = el ? await el() : null;
    if (target) await target.screenshot({ path: `${SHOTS}/${name}-${tag}.png` });
    else await p.screenshot({ path: `${SHOTS}/${name}-${tag}.png`, fullPage: true });
  }
  await p.setViewport({ width: 1440, height: 900 });
}
const rowFor = (p, email) => p.evaluateHandle((e) => [...document.querySelectorAll("li")].find((li) => li.textContent.includes(e)), email);
async function clickIn(p, email, text) {
  const done = await p.evaluate((e, t) => { const li = [...document.querySelectorAll("li")].find((x) => x.textContent.includes(e)); const b = li && [...li.querySelectorAll("button")].find((x) => x.textContent.trim() === t || x.textContent.trim().startsWith(t)); if (!b || b.disabled) return false; b.click(); return true; }, email, text);
  if (!done) throw new Error(`no enabled "${text}" button for ${email}`);
}
const rowText = (p, email) => p.evaluate((e) => [...document.querySelectorAll("li")].find((x) => x.textContent.includes(e))?.innerText ?? null, email);
const waitText = async (p, text, ms = 60000) => { try { await p.waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms, polling: 300 }, text); }
  catch (e) { fs.writeFileSync("debug-body.txt", await p.evaluate(() => document.body.innerText)); await p.screenshot({ path: "debug.png", fullPage: true }); throw e; } };
const emailOf = (first) => `${PFX}-${first.toLowerCase()}@verify.invalid`;
function actionIds() { const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); const out = {};
  for (const v of Object.values(m.node)) for (const w of Object.values(v.workers)) { const q = decodeURIComponent((w.moduleId.split("actions=")[1] ?? "").split("&")[0]);
    try { for (const [file, list] of JSON.parse(q)) for (const x of list) out[`${path.basename(file, ".ts")}.${x.exportedName ?? x.name}`] = x.id; } catch {} }
  return out; }
async function callAction(p, name, args) { const id = actionIds()[name]; if (!id) throw new Error(`no action id for ${name}`);
  return p.evaluate(async (id, args) => { const r = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify(args) }); return await r.text(); }, id, args); }

try {
  // Disposable agent (plain agent role: any agent may refund), with two-factor, signed in through /agent.
  const email = `${PFX}-agent@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
  const L = must(await a.from("agents").insert({ email, name: "Claude Verify Agent", role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(L.id);
  must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: L.id, p_auth_user_id: u.id }), "link");
  let secret; { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
    must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut(); secret = en.totp.secret; }
  await sleep(31000); // a fresh two-factor code for the sign-in below
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c5-")) });
  const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); p.setDefaultTimeout(300000); await p.setViewport({ width: 1440, height: 900 });
  const go = async (u, pg = p) => { await pg.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 300000 }); await pg.waitForNetworkIdle({ idleTime: 800, timeout: 180000 }).catch(() => {});
    // Wait for hydration: React has attached its props to the buttons.
    await pg.waitForFunction(() => { const b = document.querySelector("main button, section button"); return !b || Object.keys(b).some((k) => k.startsWith("__reactProps")); }, { timeout: 120000, polling: 300 }).catch(() => {}); };
  await go("/agent"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await p.click('form:has(input[name="password"]) button[type="submit"]'); await p.waitForSelector('input[name="code"]'); await p.type('input[name="code"]', totp(secret));
  await p.click('form:has(input[name="code"]) button[type="submit"]'); await p.waitForFunction(() => location.pathname !== "/agent", { timeout: 240000 });

  if (PHASE === "A") {
    const A = await mkDue("Avery", "Issue", { order: 1 });
    const C = await mkDue("Casey", "Concurrent", { order: 2 });
    const D = await mkDue("Drew", "Existing", { order: 3 });
    const E = await mkDue("Emery", "Nolonger", { order: 4 });
    const F = await mkDue("Finley", "Stripefail", { order: 5, pi: `pi_claudeverify_missing_${ts}` });
    const H = await mkDue("Harper", "Staletab", { order: 6 });
    const N = await mkDue("Nico", "Notsucceeded", { order: 7, pi: await charge(69900, "pm_card_refundFail") });
    // Started now so Stripe has the whole run to flip it from succeeded to failed (it's asynchronous).
    const failing = await stripe.refunds.create({ payment_intent: N.p.stripe_payment_intent_id, amount: 69900 }); stripeRefunds.push(failing.id);
    const J = await mkChain("Jamie", "Chain", { order: 8 });
    const K2 = await mkChain("Kai", "Chaindouble", { order: 9 });
    const M = await mkChain("Morgan", "Partial", { order: 10, switchPi: `pi_claudeverify_missing_sw_${ts}` });
    const R = await mkChain("Riley", "Recordswitch", { order: 11 });
    const { data: realDue } = await a.from("customer_searches").select("id").eq("guarantee_status", "refunded").not("id", "in", `(${searches.join(",")})`);
    console.log(`other searches due a refund right now (read-only): ${realDue.length}`);

    await go("/internal/refunds-due");
    const t0 = await rowText(p, emailOf("Avery"));
    ok("list: each row shows the refundable amount, Issue refund and the record link", /\$699/.test(t0 ?? "") && /Issue refund/.test(t0) && /Record a refund already issued in Stripe/.test(t0), t0);
    await shot(p, "01-list-before");

    // 1. Issue refund, through the screen
    await clickIn(p, emailOf("Avery"), "Issue refund");
    await waitText(p, "Refund $699 to Avery Issue for the Day-30 guarantee? This sends the money back through Stripe and can't be undone.");
    await shot(p, "02-confirm-step", () => rowFor(p, emailOf("Avery")));
    const a0 = await cnt(L.id);
    await clickIn(p, emailOf("Avery"), "Refund $699");
    await waitText(p, "Avery Issue: Refunded $699. Stripe refund re_");
    await shot(p, "03-success");
    const rA = await refundRows(A.p.id); const sA = rA[0] ? await stripe.refunds.retrieve(rA[0].stripe_refund_id) : null; if (sA) stripeRefunds.push(sA.id);
    ok("issue: one Stripe test refund, read back from Stripe as succeeded for $699", rA.length === 1 && sA?.status === "succeeded" && sA.amount === 69900 && sA.payment_intent === A.p.stripe_payment_intent_id, JSON.stringify(sA && { status: sA.status, amount: sA.amount }));
    ok("issue: payments.refunded_cents = 69900; refunds row reason guarantee, agent = the signed-in agent", (await payment(A.p.id)).refunded_cents === 69900 && rA[0].reason === "guarantee" && rA[0].agent_id === L.id && rA[0].cancellation_log_id === null, JSON.stringify(rA));
    ok("issue: exactly one refund_processed activity row, by that agent", (await cnt(L.id)) - a0 === 1 && JSON.stringify(await activityFor(L.id, A.s)) === '[{"action":"refund_processed"}]');
    ok("issue: the row left the list at once", (await rowText(p, emailOf("Avery"))) === null);

    // 1b. With a $100 paid switch on the chain: two Stripe refunds, total and parts shown
    { const tJ = await rowText(p, emailOf("Jamie"));
      ok("switch chain row: refundable $799 ($699 + $100 switch fee)", /\$799/.test(tJ ?? ""), tJ);
      await clickIn(p, emailOf("Jamie"), "Issue refund");
      await waitText(p, "Refund $799 to Jamie Chain for the Day-30 guarantee ($699 search fee + $100 switch fee)? This sends the money back through Stripe and can't be undone.");
      await shot(p, "02b-confirm-with-switch-fee", () => rowFor(p, emailOf("Jamie")));
      const j0 = await cnt(L.id);
      await clickIn(p, emailOf("Jamie"), "Refund $799");
      await waitText(p, "Jamie Chain: Refunded $799 ($699 search fee + $100 switch fee). Stripe refunds re_");
      await shot(p, "03b-success-with-switch-fee");
      const rf = await refundRows(J.p.id), rs = await refundRows(J.sw.id);
      const sf = await stripe.refunds.list({ payment_intent: J.p.stripe_payment_intent_id }), ss = await stripe.refunds.list({ payment_intent: J.sw.stripe_payment_intent_id });
      [...sf.data, ...ss.data].forEach((r) => stripeRefunds.push(r.id));
      ok("switch chain: one Stripe refund per fee ($699 and $100), both succeeded", sf.data.length === 1 && ss.data.length === 1 && sf.data[0].amount === 69900 && ss.data[0].amount === 10000 && sf.data[0].status === "succeeded" && ss.data[0].status === "succeeded");
      ok("…both recorded with reason guarantee and the agent; both payments fully refunded; two refund_processed rows", rf.length === 1 && rs.length === 1 && [...rf, ...rs].every((r) => r.reason === "guarantee" && r.agent_id === L.id) && (await payment(J.p.id)).refunded_cents === 69900 && (await payment(J.sw.id)).refunded_cents === 10000 && (await cnt(L.id)) - j0 === 2, JSON.stringify([...rf, ...rs]));
      ok("…row left the list at once", (await rowText(p, emailOf("Jamie"))) === null); }

    // 1c. Concurrent requests on a chain: still one refund per fee
    { const [x2, y2] = await Promise.all([callAction(p, "guarantee-refund-actions.issueGuaranteeRefund", [K2.s]), callAction(p, "guarantee-refund-actions.issueGuaranteeRefund", [K2.s])]);
      const a1 = await stripe.refunds.list({ payment_intent: K2.p.stripe_payment_intent_id }), a2 = await stripe.refunds.list({ payment_intent: K2.sw.stripe_payment_intent_id });
      [...a1.data, ...a2.data].forEach((r) => stripeRefunds.push(r.id));
      const oks2 = [x2, y2].filter((r) => /"ok":true/.test(r)).length;
      ok("switch chain, two requests at once: one Stripe refund per fee, each recorded once, no fee over-refunded", a1.data.length === 1 && a2.data.length === 1 && (await refundRows(K2.p.id)).length === 1 && (await refundRows(K2.sw.id)).length === 1 && (await payment(K2.sw.id)).refunded_cents === 10000 && oks2 >= 1, `${a1.data.length}+${a2.data.length} Stripe; ok ${oks2}`); }

    // 1d. Part-way failure: the $699 goes through, Stripe refuses the switch fee
    { await clickIn(p, emailOf("Morgan"), "Issue refund"); await waitText(p, "Refund $799 to Morgan Partial");
      await clickIn(p, emailOf("Morgan"), "Refund $799");
      await waitText(p, "Refunded $699 ($699 search fee). Then Stripe didn't complete the refund of the $100 switch fee:");
      const tM = await rowText(p, emailOf("Morgan"));
      (await stripe.refunds.list({ payment_intent: M.p.stripe_payment_intent_id })).data.forEach((r) => stripeRefunds.push(r.id));
      ok("part-way failure: $699 refunded and recorded; the message says what happened; row now shows $100", /Nothing more was recorded, and no more money moved\./.test(tM) && /\$100/.test(tM) && (await refundRows(M.p.id)).length === 1 && (await refundRows(M.sw.id)).length === 0, tM);
      await shot(p, "12b-error-part-way", () => rowFor(p, emailOf("Morgan"))); }

    // 1e. Record an already-issued switch-fee refund; and the different-payment message on a chain row
    { const swRefund = await stripe.refunds.create({ payment_intent: R.sw.stripe_payment_intent_id, amount: 10000 }); stripeRefunds.push(swRefund.id);
      await clickIn(p, emailOf("Riley"), "Record a refund already issued in Stripe"); await p.waitForSelector(`#refund-${R.s}`);
      await p.type(`#refund-${R.s}`, swRefund.id); await clickIn(p, emailOf("Riley"), "Record refund");
      await waitText(p, `Riley Recordswitch: Recorded the $100 refund ${swRefund.id}.`);
      const rR = await refundRows(R.sw.id); const tR = await rowText(p, emailOf("Riley"));
      ok("record an issued switch-fee refund: recorded against the switch fee, reason guarantee; row shows $699 left", rR.length === 1 && rR[0].reason === "guarantee" && rR[0].amount_cents === 10000 && /\$699/.test(tR), tR);
      await clickIn(p, emailOf("Riley"), "Issue refund");
      await waitText(p, "Refund $699 to Riley Recordswitch for the Day-30 guarantee? This sends");
      ok("…its confirm now shows only the $699 (the approved single-fee wording)", true);
      await clickIn(p, emailOf("Riley"), "Cancel");
      await clickIn(p, emailOf("Riley"), "Record a refund already issued in Stripe"); await p.waitForSelector(`#refund-${R.s}`);
      await p.type(`#refund-${R.s}`, sA.id); await clickIn(p, emailOf("Riley"), "Record refund");
      await waitText(p, "That refund belongs to a different payment, not this search's $699 fee or switch fee.");
      ok("different payment on a chain row: '…not this search's $699 fee or switch fee.'", true);
      await shot(p, "08b-error-different-payment-chain", () => rowFor(p, emailOf("Riley"))); }

    // 2. Double click on the confirm button: one Stripe call
    await clickIn(p, emailOf("Harper"), "Issue refund"); await waitText(p, "Refund $699 to Harper Staletab");
    // A second tab, opened before Harper's refund, for the stale-tab case below.
    const p2 = await ctx.newPage(); p2.setDefaultTimeout(300000); await p2.setViewport({ width: 1440, height: 900 }); await go("/internal/refunds-due", p2);
    await p.evaluate((e) => { const li = [...document.querySelectorAll("li")].find((x) => x.textContent.includes(e)); const b = [...li.querySelectorAll("button")].find((x) => x.textContent.trim() === "Refund $699"); b.click(); b.click(); b.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); }, emailOf("Harper"));
    await waitText(p, "Harper Staletab: Refunded $699.");
    const rH = await refundRows(H.p.id); const listH = await stripe.refunds.list({ payment_intent: H.p.stripe_payment_intent_id }); listH.data.forEach((r) => stripeRefunds.push(r.id));
    ok("double click on Refund: one Stripe refund, one refunds row, $699 refunded once", listH.data.length === 1 && rH.length === 1 && (await payment(H.p.id)).refunded_cents === 69900, `${listH.data.length} Stripe / ${rH.length} rows`);
    // Stale tab: Harper's row is still on p2; refunding again says nothing is left, and moves no money.
    await clickIn(p2, emailOf("Harper"), "Issue refund"); await waitText(p2, "Refund $699 to Harper Staletab", 30000);
    await clickIn(p2, emailOf("Harper"), "Refund $699");
    await waitText(p2, "Nothing left to refund on this payment.");
    ok("second attempt from a stale tab: 'Nothing left to refund on this payment.', still one Stripe refund", (await stripe.refunds.list({ payment_intent: H.p.stripe_payment_intent_id })).data.length === 1 && (await refundRows(H.p.id)).length === 1);
    await shot(p2, "04-error-nothing-left", () => rowFor(p2, emailOf("Harper"))); await p2.close();

    // 3. The server action itself, called twice at once (no screen guard): still one refund
    const [x, y] = await Promise.all([callAction(p, "guarantee-refund-actions.issueGuaranteeRefund", [C.s]), callAction(p, "guarantee-refund-actions.issueGuaranteeRefund", [C.s])]);
    const listC = await stripe.refunds.list({ payment_intent: C.p.stripe_payment_intent_id }); listC.data.forEach((r) => stripeRefunds.push(r.id));
    const oks = [x, y].filter((r) => /"ok":true/.test(r)).length, nothing = [x, y].filter((r) => /Nothing left to refund/.test(r)).length;
    ok("two refund requests at the same moment: one Stripe refund (idempotency key), one success, one 'nothing left'", listC.data.length === 1 && (await refundRows(C.p.id)).length === 1 && oks === 1 && nothing === 1 && (await payment(C.p.id)).refunded_cents === 69900, `${listC.data.length} Stripe; ok ${oks}; nothing-left ${nothing}`);

    // 4. Record a refund already issued in Stripe (part of Drew's fee)
    const direct = await stripe.refunds.create({ payment_intent: D.p.stripe_payment_intent_id, amount: 20000 }); stripeRefunds.push(direct.id);
    await clickIn(p, emailOf("Drew"), "Record a refund already issued in Stripe");
    await p.waitForSelector(`#refund-${D.s}`); await shot(p, "05-record-field", () => rowFor(p, emailOf("Drew")));
    await p.type(`#refund-${D.s}`, direct.id); await clickIn(p, emailOf("Drew"), "Record refund");
    await waitText(p, `Drew Existing: Recorded the $200 refund ${direct.id}.`);
    const rD = await refundRows(D.p.id);
    ok("record existing: recorded for its real amount ($200), reason guarantee, by the agent", rD.length === 1 && rD[0].amount_cents === 20000 && rD[0].reason === "guarantee" && rD[0].agent_id === L.id && (await payment(D.p.id)).refunded_cents === 20000, JSON.stringify(rD));
    const tD = await rowText(p, emailOf("Drew"));
    ok("…row stays, now showing $499 refundable", /\$499/.test(tD ?? ""), tD);
    await shot(p, "06-record-success");
    const tryRecord = async (id, expect, shotName) => {
      await clickIn(p, emailOf("Drew"), "Record a refund already issued in Stripe").catch(() => {});
      await p.waitForSelector(`#refund-${D.s}`);
      await p.click(`#refund-${D.s}`, { clickCount: 3 }); await p.keyboard.press("Backspace"); await p.type(`#refund-${D.s}`, id);
      await clickIn(p, emailOf("Drew"), "Record refund"); await waitText(p, expect);
      if (shotName) await shot(p, shotName, () => rowFor(p, emailOf("Drew")));
    };
    await tryRecord(direct.id, "That refund has already been recorded.", "07-error-already-recorded");
    ok("same refund ID again: 'That refund has already been recorded.'", (await refundRows(D.p.id)).length === 1);
    await tryRecord(sA.id, "That refund belongs to a different payment, not this search's $699 fee.", "08-error-different-payment");
    ok("another payment's refund: refused as a different payment, nothing recorded", (await refundRows(D.p.id)).length === 1);
    await tryRecord("re_claudeverifydoesnotexist", "That refund ID wasn't found in Stripe.", "09-error-not-found");
    ok("unknown refund ID: 'That refund ID wasn't found in Stripe.'", (await refundRows(D.p.id)).length === 1);

    // 5. A refund that didn't succeed (Stripe's refund-fail test card: succeeded, then failed)
    let st = (await stripe.refunds.retrieve(failing.id)).status; for (let i = 0; i < 40 && st === "succeeded"; i++) { await sleep(3000); st = (await stripe.refunds.retrieve(failing.id)).status; }
    if (st !== "succeeded") {
      await clickIn(p, emailOf("Nico"), "Record a refund already issued in Stripe"); await p.waitForSelector(`#refund-${N.s}`);
      await p.type(`#refund-${N.s}`, failing.id); await clickIn(p, emailOf("Nico"), "Record refund");
      await waitText(p, `That refund hasn't gone through in Stripe yet (status: ${st}).`);
      await shot(p, "10-error-not-succeeded", () => rowFor(p, emailOf("Nico")));
      ok(`refund not succeeded (Stripe status ${st}): refused, nothing recorded`, (await refundRows(N.p.id)).length === 0);
    } else ok("refund-fail test card never left 'succeeded' within 2 minutes (not-succeeded case untested)", false);

    // 6. No longer due: the confirm step was open when the guarantee status changed
    await clickIn(p, emailOf("Emery"), "Issue refund"); await waitText(p, "Refund $699 to Emery Nolonger");
    must(await a.from("customer_searches").update({ guarantee_status: "met" }).eq("id", E.s), "met");
    await clickIn(p, emailOf("Emery"), "Refund $699");
    await waitText(p, "This search is no longer due a guarantee refund.");
    await shot(p, "11-error-no-longer-due", () => rowFor(p, emailOf("Emery")));
    ok("no longer due: refused before Stripe, no refund", (await stripe.refunds.list({ payment_intent: E.p.stripe_payment_intent_id })).data.length === 0 && (await refundRows(E.p.id)).length === 0);

    // 7. Stripe refuses: nothing recorded
    await clickIn(p, emailOf("Finley"), "Issue refund"); await waitText(p, "Refund $699 to Finley Stripefail");
    await clickIn(p, emailOf("Finley"), "Refund $699");
    await waitText(p, "Stripe didn't complete the refund:");
    const fText = await rowText(p, emailOf("Finley"));
    ok("Stripe failure: the message ends 'Nothing was recorded, and no money moved.'; no refunds row", /Nothing was recorded, and no money moved\./.test(fText) && (await refundRows(F.p.id)).length === 0, fText);
    await shot(p, "12-error-stripe-failed", () => rowFor(p, emailOf("Finley")));

    // 8. After a reload: refunded rows are gone; partly refunded stays
    await go("/internal/refunds-due");
    const after = await p.evaluate(() => document.body.innerText);
    ok("after reload: Avery, Harper, Casey gone; Drew ($499), Finley, Nico still listed; Emery (met) gone",
      !["Avery Issue", "Harper Staletab", "Casey Concurrent", "Emery Nolonger", "Jamie Chain", "Kai Chaindouble"].some((n) => after.includes(n)) && ["Drew Existing", "Finley Stripefail", "Nico Notsucceeded", "Morgan Partial", "Riley Recordswitch"].every((n) => after.includes(n)) && /\$499/.test(await rowText(p, emailOf("Drew"))));
    await shot(p, "13-list-after-reload");

    // 9. Cancellation form: per-refund reason
    const K = await mkCustomer("Kendall", "Cancel");
    const SK = await mkSearch(K, { cancellation_call_requested_at: new Date().toISOString(), guarantee_status: "pending" });
    const fee = await mkPayment(K, SK, "search_fee", 69900); const ext = await mkPayment(K, SK, "extension_fee", 10000);
    await go("/internal/outreach");
    const card = () => p.evaluateHandle((e) => [...document.querySelectorAll("#cancellation-calls div.rounded-2xl")].find((d) => d.textContent.includes(e)), emailOf("Kendall"));
    await p.waitForFunction((e) => [...document.querySelectorAll("#cancellation-calls div.rounded-2xl")].some((d) => d.textContent.includes(e) && d.querySelectorAll("select").length >= 3), { timeout: 120000 }, emailOf("Kendall"));
    const opts = await p.evaluate((e) => { const d = [...document.querySelectorAll("#cancellation-calls div.rounded-2xl")].find((x) => x.textContent.includes(e)); const s = d.querySelectorAll("select")[1]; return { labels: [...s.options].map((o) => o.textContent), value: s.value }; }, emailOf("Kendall"));
    ok("reason picker: refund_reasons labels, default Cancellation", JSON.stringify(opts.labels) === JSON.stringify(["Cancellation", "Day-30 guarantee", "Goodwill", "Duplicate charge", "Other"]) && opts.value === "cancellation", JSON.stringify(opts));
    await shot(p, "14-cancellation-form-reasons", card);
    // Fill: reason category; extension fee $100 Goodwill; search fee $699 Cancellation.
    await p.evaluate((e, extId, feeId) => {
      const d = [...document.querySelectorAll("#cancellation-calls div.rounded-2xl")].find((x) => x.textContent.includes(e));
      const set = (el, v) => { const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
      const selects = d.querySelectorAll("select"); set(selects[0], selects[0].options[1].value);
      const lines = [...d.querySelectorAll("div.flex.flex-wrap.items-center.justify-between")];
      for (const line of lines) {
        const isExt = line.textContent.includes("Extension fee");
        set(line.querySelector("select"), isExt ? "goodwill" : "cancellation");
        set(line.querySelector("input[type=number]"), isExt ? "100" : "699");
      }
    }, emailOf("Kendall"));
    await sleep(500); await shot(p, "15-cancellation-form-filled", card);
    await p.evaluate((e) => { const d = [...document.querySelectorAll("#cancellation-calls div.rounded-2xl")].find((x) => x.textContent.includes(e)); [...d.querySelectorAll("button")].find((b) => b.textContent.includes("Cancel search & resolve")).click(); }, emailOf("Kendall"));
    await waitText(p, "Search cancelled. 2 refunds issued.");
    await shot(p, "16-cancellation-done", card);
    const { data: log } = await a.from("cancellation_log").select("id").eq("search_id", SK).single();
    const rk = [...(await refundRows(fee.id)), ...(await refundRows(ext.id))]; rk.forEach((r) => stripeRefunds.push(r.stripe_refund_id));
    const byReason = Object.fromEntries(rk.map((r) => [r.reason, r]));
    ok("cancellation: two refunds rows, reasons Goodwill ($100, extension) and Cancellation ($699, fee)", rk.length === 2 && byReason.goodwill?.amount_cents === 10000 && byReason.cancellation?.amount_cents === 69900, JSON.stringify(rk));
    ok("…both linked to the cancellation record, agent recorded on each", rk.every((r) => r.cancellation_log_id === log.id && r.agent_id === L.id));
    const sk = await Promise.all(rk.map((r) => stripe.refunds.retrieve(r.stripe_refund_id)));
    ok("…both real Stripe test refunds, succeeded", sk.every((r) => r.status === "succeeded"));
  } else {
    // PHASE B: Stripe refunds, then recording fails (forced) -> the recovery message, then recover.
    const G = await mkDue("Gray", "Recordfail", { order: 1 });
    await go("/internal/refunds-due");
    await clickIn(p, emailOf("Gray"), "Issue refund"); await waitText(p, "Refund $699 to Gray Recordfail");
    await clickIn(p, emailOf("Gray"), "Refund $699");
    await waitText(p, "The refund went through in Stripe (re_");
    const gText = await rowText(p, emailOf("Gray")); const reId = (gText.match(/\((re_[A-Za-z0-9]+)\)/) ?? [])[1]; if (reId) stripeRefunds.push(reId);
    ok("recorded failed after Stripe succeeded: the 'Don't refund again' message with the refund id; nothing recorded", /Don't refund again\. Record it with "Record a refund already issued in Stripe"\./.test(gText) && !!reId && (await refundRows(G.p.id)).length === 0, gText);
    await shot(p, "17-error-recorded-failed", () => rowFor(p, emailOf("Gray")));
    await clickIn(p, emailOf("Gray"), "Record a refund already issued in Stripe"); await p.waitForSelector(`#refund-${G.s}`);
    await p.type(`#refund-${G.s}`, reId); await clickIn(p, emailOf("Gray"), "Record refund");
    await waitText(p, `Gray Recordfail: Recorded the $699 refund ${reId}.`);
    ok("…recovered through 'Record a refund already issued in Stripe': recorded once, row gone, one Stripe refund", (await refundRows(G.p.id)).length === 1 && (await rowText(p, emailOf("Gray"))) === null && (await stripe.refunds.list({ payment_intent: G.p.stripe_payment_intent_id })).data.length === 1);
  }
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser?.close().catch(() => {});
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  await del("agent_activity_log", "agent_id", agentIds); await del("agent_activity_log", "search_id", searches);
  await a.from("agent_activity_log").delete().eq("agent_id", padmin.id).gte("created_at", runStart);
  await del("refunds", "payment_id", paymentIds); await del("cancellation_log", "search_id", searches); await del("payments", "id", paymentIds);
  await del("agent_alerts", "search_id", searches); await del("search_assignments", "search_id", searches); await del("notification_events", "customer_search_id", searches);
  if (searches.length) await a.from("customer_searches").update({ superseded_by_id: null }).in("id", searches);
  await del("customer_searches", "id", searches);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await del("customers", "id", customers); await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = { logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)), searches: searches.length ? await c("customer_searches", (q) => q.in("id", searches)) : 0,
    payments: paymentIds.length ? await c("payments", (q) => q.in("id", paymentIds)) : 0, refunds: paymentIds.length ? await c("refunds", (q) => q.in("payment_id", paymentIds)) : 0,
    refundsByStripeId: stripeRefunds.length ? await c("refunds", (q) => q.in("stripe_refund_id", stripeRefunds)) : 0,
    cancellations: searches.length ? await c("cancellation_log", (q) => q.in("search_id", searches)) : 0 };
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
