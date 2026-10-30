// Chunk 2: every app-level agent action writes exactly one, correctly attributed activity row.
// Actor: a disposable LEAD agent (never LEVRID 1). Scratch customer, searches, offers, dealer
// aliases, articles and social posts, all deleted afterwards and confirmed by count.
// MODE=forced: the dev server runs with AGENT_ACTIVITY_FORCE_FAIL="salesperson_added:code,salesperson_updated:call".
import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { createAdminClient } from "../lib/admin.mjs";
import { createClient } from "@supabase/supabase-js";
const env = {}; for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const MODE = process.env.MODE ?? "normal";
const a = createAdminClient(); const BASE = "http://localhost:3100";
const DEVLOG = (LOGS + "/dev3100.log");
const MANIFEST = (ROOT + "/.next/dev/server/server-reference-manifest.json");
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString(), PFX = `claude-verify-${ts}`, pw = `Act!${ts}aA`;
const FAKE_MAKE = `ClaudeVerify${ts}`, FAKE_MODEL = "Scratch";
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const rows = [];
function totp(s) { const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let b = ""; for (const ch of s.toUpperCase()) b += al.indexOf(ch).toString(2).padStart(5, "0"); const k = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac("sha1", k).update(c).digest(); const o = h[19] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 600000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c2-")) });
const at = (p) => new URL(p.url()).pathname;
async function ctxPage() { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 1280, height: 900 }); p.setDefaultTimeout(300000); return p; }
async function go(p, u) { await p.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 300000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 180000 }).catch(() => {}); }
async function submit(p, pred) { await p.click('form:has(input[name="password"]) button[type="submit"], form:has(input[name="code"]) button[type="submit"]'); await p.waitForFunction(pred, { timeout: 240000, polling: 300 }).catch(() => {}); await p.waitForNetworkIdle({ idleTime: 800, timeout: 120000 }).catch(() => {}); }
const logins = [], agentIds = [], secrets = {};
async function mkAgent(tag, role, withFactor) {
  const email = `${PFX}-${tag}@levrauto-test.invalid`;
  const u = must(await a.auth.admin.createUser({ email, email_confirm: true, password: pw, app_metadata: { account_type: "agent" } }), "login").user; logins.push(u.id);
  const ag = must(await a.from("agents").insert({ email, name: `CLAUDE VERIFY ${tag.toUpperCase()}`, role: "agent", in_rotation: false }).select("id").single(), "agent"); agentIds.push(ag.id);
  must(await a.rpc("link_agent_login", { p_actor_agent_id: padmin.id, p_agent_id: ag.id, p_auth_user_id: u.id }), "link");
  if (role !== "agent") must(await a.rpc("set_agent_role", { p_actor_agent_id: padmin.id, p_subject_agent_id: ag.id, p_role: role, p_in_rotation: false }), "role");
  if (withFactor) { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: pw }); const { data: en } = await c.auth.mfa.enroll({ factorType: "totp" });
    must(await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) }), "verify"); await c.auth.signOut(); secrets[email] = en.totp.secret; }
  return { id: ag.id, email, userId: u.id };
}
async function agentSignIn(p, email) { await go(p, "/agent"); await p.type('input[name="email"]', email); await p.type('input[name="password"]', pw);
  await submit(p, () => !!document.querySelector('input[name="code"]') || location.pathname !== "/agent");
  if (await p.$('input[name="code"]')) { await p.type('input[name="code"]', totp(secrets[email])); await submit(p, () => location.pathname !== "/agent"); } }
function actionIds() { const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); const out = {};
  for (const v of Object.values(m.node)) for (const w of Object.values(v.workers)) { const q = decodeURIComponent((w.moduleId.split("actions=")[1] ?? "").split("&")[0]);
    try { for (const [file, list] of JSON.parse(q)) for (const x of list) out[`${path.basename(file, ".ts")}.${x.exportedName ?? x.name}`] = x.id; } catch {} }
  return out; }
let IDS = {};
// Calls a server action with real React reply encoding. A {__form: {...}} arg is sent as FormData
// ("$K<n>" reference, fields prefixed "<n>_"), a {__file:{name,type,b64}} field as a File.
async function call(p, name, args) {
  if (!IDS[name]) IDS = actionIds();
  const id = IDS[name]; if (!id) throw new Error(`no action id for ${name}`);
  return p.evaluate(async (id, args) => {
    const outer = new FormData(); let n = 0; let multipart = false;
    const json = args.map((arg) => {
      if (arg && typeof arg === "object" && arg.__form) { multipart = true; n++; const ref = n;
        for (const [k, v] of Object.entries(arg.__form)) {
          if (v && typeof v === "object" && v.__file) { const bin = Uint8Array.from(atob(v.__file.b64), (c) => c.charCodeAt(0)); outer.append(`_${ref}_${k}`, new File([bin], v.__file.name, { type: v.__file.type })); }
          else outer.append(`_${ref}_${k}`, String(v)); }
        return `$K${ref.toString(16)}`; }
      return arg; });
    let r;
    if (multipart) { outer.append("0", JSON.stringify(json)); r = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body: outer }); }
    else r = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify(args) });
    return `${r.status} ${await r.text()}`;
  }, id, args);
}
const okOf = (r) => /"ok":true/.test(r);
const errOf = (r) => (r.match(/"error":"([^"]+)"/) ?? [])[1] ?? r.replace(/\s+/g, " ").slice(-160);
const latest = async (agentId) => (await a.from("agent_activity_log").select("action, search_id, customer_id, qualifying_offer_id, dealer_alias_id, details").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(1)).data[0];

// One action: exactly one new row for `agentId`, with the expected code and links.
async function act(label, p, name, args, code, expect = {}, agentId) {
  const before = await cnt(agentId);
  const r = await call(p, name, args);
  const after = await cnt(agentId);
  const row = after > before ? await latest(agentId) : null;
  const linkProblems = Object.entries(expect).filter(([k, v]) => (row?.[k] ?? null) !== v).map(([k, v]) => `${k}=${row?.[k] ?? null} (want ${v})`);
  const good = okOf(r) && after - before === 1 && row?.action === code && linkProblems.length === 0;
  if (!okOf(r)) { console.log("RAW", label); fs.writeFileSync(`raw-${rows.length}.txt`, r); }
  rows.push([label, code, okOf(r) ? "ok" : `FAILED: ${errOf(r)}`, after - before, row?.action ?? "-", linkProblems.join("; ") || "links ok"]);
  ok(`${label} → 1 × ${code}`, good, good ? "" : `action ${okOf(r) ? "ok" : errOf(r)}; rows ${after - before}; got ${row?.action}; ${linkProblems.join("; ")}`);
  return { r, row };
}

const scratch = { customers: [], searches: [], aliases: [], articles: [], posts: [], listings: [], storage: [] };
try {
  const L = await mkAgent("lead", "lead", true);
  // ---------------- forced-failure run (separate server start)
  if (MODE === "forced") {
    const p = await ctxPage(); await agentSignIn(p, L.email); await go(p, "/internal/dealerships");
    const ds = must(await a.from("dealerships").insert({ name: `CLAUDE VERIFY DEALERSHIP ${ts}`, city: "Testville", state: "KS" }).select("id").single(), "dealership");
    scratch.dealerships = [ds.id];
    const logBefore = fs.readFileSync(DEVLOG, "utf8").length;
    for (const [mode, name, args, code] of [
      ["code (the database's insert is refused)", "dealership-actions.addSalesperson", [ds.id, "CLAUDE VERIFY SALES", "555-0100", ""], "salesperson_added"],
    ]) {
      const n0 = await cnt(L.id); const r = await call(p, name, args); const n1 = await cnt(L.id);
      const { data: sp } = await a.from("dealership_salespeople").select("id").eq("dealership_id", ds.id);
      const { data: al } = await a.from("agent_alerts").select("kind, details").eq("agent_id", L.id).gte("created_at", runStart);
      const mine = (al ?? []).filter((x) => x.details?.details?.forced_test_failure === code);
      ok(`forced ${mode}: action still succeeds`, okOf(r) && sp.length === 1, errOf(r));
      ok(`forced ${mode}: 0 activity rows`, n1 === n0, `${n1 - n0}`);
      ok(`forced ${mode}: exactly 1 activity_log_failed alert`, mine.length === 1 && mine[0].kind === "activity_log_failed", JSON.stringify(mine));
      scratch.sp = sp[0].id;
    }
    { const n0 = await cnt(L.id); const r = await call(p, "dealership-actions.updateSalesperson", [scratch.sp, "CLAUDE VERIFY SALES 2", "555-0101", ""]); const n1 = await cnt(L.id);
      const { data: sp } = await a.from("dealership_salespeople").select("name").eq("id", scratch.sp).single();
      const { data: al } = await a.from("agent_alerts").select("kind, details").eq("agent_id", L.id).gte("created_at", runStart);
      const mine = (al ?? []).filter((x) => x.details?.details?.forced_test_failure === "salesperson_updated");
      ok("forced call (the call itself fails): action still succeeds", okOf(r) && sp.name === "CLAUDE VERIFY SALES 2", errOf(r));
      ok("forced call: 0 activity rows", n1 === n0, `${n1 - n0}`);
      ok("forced call: exactly 1 activity_log_failed alert (written by the app helper)", mine.length === 1 && mine[0].kind === "activity_log_failed" && /log_agent_activity_forced_missing|function/i.test(mine[0].details?.error ?? ""), JSON.stringify(mine[0]?.details?.error)); }
    await new Promise((res) => setTimeout(res, 1500));
    const tags = (fs.readFileSync(DEVLOG, "utf8").slice(logBefore).match(/\[agent-activity-failed\]/g) ?? []).length;
    ok("server log has the [agent-activity-failed] tag for both", tags >= 2, `${tags}`);
    await p.browserContext().close();
  } else {
  // ---------------- scratch data
  const custEmail = `${PFX}-customer@levrauto-test.invalid`;
  const cu = must(await a.auth.admin.createUser({ email: custEmail, email_confirm: true, password: pw }), "customer").user; logins.push(cu.id); scratch.customers.push(cu.id);
  const C = cu.id;
  const now = new Date().toISOString();
  const mkSearch = async (fields) => { const s = must(await a.from("customer_searches").insert({ customer_id: C, zip: "66101", ...fields }).select("id").single(), "search"); scratch.searches.push(s.id); return s.id; };
  const S1 = await mkSearch({ make: FAKE_MAKE, model: FAKE_MODEL, model_year: 2026, search_status: "searching", paid_at: now, finalized_at: now, solidified_at: now });
  const S2 = await mkSearch({ make: null, model: null, search_status: "awaiting_finalization", paid_at: now });
  const S3 = await mkSearch({ make: FAKE_MAKE, model: FAKE_MODEL, model_year: 2026, search_status: "awaiting_finalization", paid_at: now });
  const S4 = await mkSearch({ make: FAKE_MAKE, model: FAKE_MODEL, model_year: 2026, search_status: "searching", paid_at: now, finalized_at: now, solidified_at: now });
  const offerRow = (sid, name) => ({ customer_search_id: sid, dealer_name: name, offer_price_cents: 3000000, msrp_cents: 3200000, status: "customer_accepted", delivered_at: now, customer_responded_at: now });
  const B = must(await a.from("qualifying_offers").insert(offerRow(S1, `CLAUDE VERIFY DEALER ${ts} B`)).select("id").single(), "offer B").id;
  const Coff = must(await a.from("qualifying_offers").insert(offerRow(S4, `CLAUDE VERIFY DEALER ${ts} C`)).select("id").single(), "offer C").id;
  must(await a.from("documents").insert({ qualifying_offer_id: B, type: "service_agreement", external_signature_id: `claude-verify-${ts}`, signed_at: now }), "agreement");
  const ev = must(await a.from("notification_events").insert({ customer_id: C, customer_search_id: S1, event_type: "offer_logged", agent_callback_requested_at: now }).select("id").single(), "event").id;
  const aliasA = must(await a.from("dealer_aliases").insert({ dealer_name: `CLAUDE VERIFY DEALER ${ts} ALIAS-A`, dealer_city: "Testville", dealer_state: "KS" }).select("id").single(), "alias A").id;
  const aliasB = must(await a.from("dealer_aliases").insert({ dealer_name: `CLAUDE VERIFY DEALER ${ts} ALIAS-B`, dealer_city: "Testville", dealer_state: "KS" }).select("id").single(), "alias B").id;
  const art = async (tag) => { const r = must(await a.from("articles").insert({ slug: `${PFX}-${tag}`, title: `CLAUDE VERIFY ARTICLE ${tag}`, topic: "How a test checklist works", status: "draft", scheduled_month: "2099-01-01", content: "Scratch draft.", caption_x: "x", caption_facebook: "f", caption_instagram: "i", caption_linkedin: "l" }).select("id").single(), "article"); scratch.articles.push(r.id); return r.id; };
  const artA = await art("a"), artB = await art("b");
  const post = async (theme) => { const r = must(await a.from("social_posts").insert({ theme, week_start: "2099-01-05", status: "draft", caption_x: "x", caption_facebook: "f", caption_instagram: "i", caption_linkedin: "l" }).select("id").single(), "post"); scratch.posts.push(r.id); return r.id; };
  const postA = await post("ask_around_tuesday"), postB = await post("sunday_question");
  // Fresh scratch listings so the two syncs skip (no MarketCheck call): the fake make for the inventory
  // refresh, and Alfa Romeo Tonale (no listings, no searches) for the undecided finalize.
  for (const [mk, md] of [[FAKE_MAKE, FAKE_MODEL], ["Alfa Romeo", "Tonale"]]) {
    const l = must(await a.from("listings").insert({ vin: `CV${ts}${md.slice(0, 3).toUpperCase()}`.slice(0, 17), make: mk, model: md, year: 2026, trim: "Scratch", synced_at: new Date().toISOString() }).select("id").single(), "listing"); scratch.listings.push(l.id); }
  const T1 = await mkAgent("invitee", "agent", false), T2 = await mkAgent("resetme", "agent", true);

  // ---------------- sessions
  const p = await ctxPage(); await agentSignIn(p, L.email);
  ok("lead signed in", at(p) === "/internal/outreach", at(p));
  for (const u of ["/internal/dealerships", "/internal/articles", "/internal/social", "/internal/agents", "/internal/outreach"]) await go(p, u);
  const pc = await ctxPage(); await go(pc, "/login"); await pc.type('input[name="email"]', custEmail); await pc.type('input[name="password"]', pw);
  await submit(pc, () => location.pathname !== "/login"); await go(pc, "/account/deal"); await go(pc, "/account/messages");
  ok("customer signed in", at(pc) === "/" || at(pc).startsWith("/account"), at(pc));
  IDS = actionIds();
  const offerLinks = (o, s) => ({ qualifying_offer_id: o, search_id: s, customer_id: C });

  // ---------------- offers
  const r1 = await act("logQualifyingOffer (with an add-on line, AI-parsed)", p, "outreach-actions.logQualifyingOffer", [{ __form: {
    customer_search_id: S1, dealer_name: `CLAUDE VERIFY DEALER ${ts} OFFLOT`, dealer_city: "Testville", dealer_state: "KS", dealer_zip: "66101",
    offer_price: "29000", msrp: "32000", addons_json: JSON.stringify([{ description: "Nitrogen tires", amountCents: 19900 }]), delivery_mode: "fee", delivery_fee: "0", ai_parsed: "1" } }],
    "offer_logged", { search_id: S1, customer_id: C }, L.id);
  const { data: A } = await a.from("qualifying_offers").select("id, logged_by_agent_id, dealer_alias_id").eq("customer_search_id", S1).eq("dealer_name", `CLAUDE VERIFY DEALER ${ts} OFFLOT`).single();
  ok("offer: logged_by_agent_id = the lead, dealer_alias_id set", A.logged_by_agent_id === L.id && !!A.dealer_alias_id, JSON.stringify(A));
  ok("offer_logged row links the offer and alias, details ai_parsed and the add-on", r1.row?.qualifying_offer_id === A.id && r1.row?.dealer_alias_id === A.dealer_alias_id && r1.row?.details?.ai_parsed === true && r1.row?.details?.addons?.length === 1, JSON.stringify(r1.row?.details));
  if (A.dealer_alias_id) scratch.aliases.push(A.dealer_alias_id);
  await act("logOfferAddon", p, "outreach-actions.logOfferAddon", [{ __form: { qualifying_offer_id: A.id, description: "Paint protection", amount: "499" } }], "offer_addon_added", offerLinks(A.id, S1), L.id);
  const { data: addon } = await a.from("offer_addons").select("id").eq("qualifying_offer_id", A.id).eq("description", "Paint protection").single();
  must(await a.from("offer_addons").update({ removal_status: "pending", removal_requested_at: now }).eq("id", addon.id), "removal pending");
  await act("resolveAddonRemoval", p, "outreach-actions.resolveAddonRemoval", [addon.id, "dealer_declined", "Dealer says no"], "addon_removal_resolved", offerLinks(A.id, S1), L.id);
  await act("setOfferDeliveryEstimate", p, "outreach-actions.setOfferDeliveryEstimate", [{ __form: { offer_id: A.id, delivery_mode: "requested" } }], "delivery_estimate_set", offerLinks(A.id, S1), L.id);

  // ---------------- messages (customer sends first: no activity row, but last_customer_message_at)
  { const n0 = await cnt(L.id); const r = await call(pc, "offer-message-actions.sendCustomerMessage", [A.id, "Hi, is this still available?"]);
    const { data: q } = await a.from("qualifying_offers").select("last_customer_message_at, customer_activity_at").eq("id", A.id).single();
    ok("customer offer message: sent, last_customer_message_at set, no agent row", okOf(r) && !!q.last_customer_message_at && (await cnt(L.id)) === n0, errOf(r));
    await act("markOfferActivityReviewed", p, "outreach-actions.markOfferActivityReviewed", [A.id, q.customer_activity_at], "activity_reviewed", offerLinks(A.id, S1), L.id); }
  const m1 = await act("sendAgentMessage (offer thread)", p, "offer-message-actions.sendAgentMessage", [A.id, "Yes, it is.", null], "message_sent", offerLinks(A.id, S1), L.id);
  ok("message_sent details: offer thread, reviewed false", m1.row?.details?.thread === "offer" && m1.row?.details?.reviewed === false, JSON.stringify(m1.row?.details));
  { const r = await call(pc, "offer-message-actions.sendCustomerGeneralMessage", ["General question"]);
    const { data: g } = await a.from("general_threads").select("last_customer_message_at, customer_activity_at").eq("customer_id", C).single();
    ok("customer general message: sent, last_customer_message_at set", okOf(r) && !!g.last_customer_message_at, errOf(r));
    await act("markGeneralActivityReviewed", p, "offer-message-actions.markGeneralActivityReviewed", [C, g.customer_activity_at], "activity_reviewed", { customer_id: C, search_id: null }, L.id); }
  { const r = await call(pc, "offer-message-actions.sendCustomerGeneralMessage", ["Another question"]);
    const { data: g } = await a.from("general_threads").select("customer_activity_at").eq("customer_id", C).single();
    const m2 = await act("sendAgentGeneralMessage (reply that also clears the review)", p, "offer-message-actions.sendAgentGeneralMessage", [C, "Answer.", g.customer_activity_at], "message_sent", { customer_id: C }, L.id);
    ok("reply + review = ONE row (message_sent, reviewed true)", okOf(r) && m2.row?.details?.reviewed === true && m2.row?.details?.thread === "general", JSON.stringify(m2.row?.details)); }
  await act("markOfferVehicleSold", p, "outreach-actions.markOfferVehicleSold", [A.id], "offer_vehicle_marked_sold", offerLinks(A.id, S1), L.id);
  await act("resolveNotificationCallback", p, "outreach-actions.resolveNotificationCallback", [ev], "notification_flag_resolved", { search_id: S1, customer_id: C }, L.id);
  { const { data: e } = await a.from("notification_events").select("flag_resolved_by_agent_id").eq("id", ev).single(); ok("notification: flag_resolved_by_agent_id = the lead", e.flag_resolved_by_agent_id === L.id); }

  // ---------------- deal steps
  await act("confirmAvailability", p, "outreach-actions.confirmAvailability", [B], "availability_confirmed", offerLinks(B, S1), L.id);
  await act("confirmDepositReceived", p, "outreach-actions.confirmDepositReceived", [B, "500"], "deposit_confirmed", offerLinks(B, S1), L.id);
  { const { data: d } = await a.from("deal_progress").select("availability_confirmed_by_agent_id, deposit_confirmed_by_agent_id").eq("qualifying_offer_id", B).single();
    ok("deal_progress: both *_by_agent_id = the lead", d.availability_confirmed_by_agent_id === L.id && d.deposit_confirmed_by_agent_id === L.id, JSON.stringify(d)); }
  await act("checkServiceAgreementSigningStatus", p, "outreach-actions.checkServiceAgreementSigningStatus", [B], "signing_status_checked", offerLinks(B, S1), L.id);
  await act("withdrawAcceptedOffer", p, "outreach-actions.withdrawAcceptedOffer", [Coff, "Dealer sold it"], "offer_released", offerLinks(Coff, S4), L.id);
  await act("markSearchPurchased", p, "outreach-actions.markSearchPurchased", [S1, B], "search_marked_purchased", offerLinks(B, S1), L.id);

  // ---------------- finalize, inventory
  await act("finalizeSearchByAgent", p, "outreach-actions.finalizeSearchByAgent", [S3, { trim: "Scratch", colors: ["Red"], requiredOptions: [] }], "search_finalized_by_agent", { search_id: S3, customer_id: C }, L.id);
  await act("finalizeUndecidedSearch (sync skipped: fresh scratch listing)", p, "outreach-actions.finalizeUndecidedSearch", [S2, { make: "Alfa Romeo", model: "Tonale", modelYear: 2026, trim: "Ti", colors: [], requiredOptions: [], pickupTravel: "unlimited" }], "undecided_search_finalized", { search_id: S2, customer_id: C }, L.id);
  const inv = await act("refreshSearchInventory (skipped: refreshed in the last 24h)", p, "outreach-actions.refreshSearchInventory", [S4], "inventory_refreshed", { search_id: S4, customer_id: C }, L.id);
  ok("inventory_refreshed: refreshed false (no MarketCheck call)", inv.row?.details?.refreshed === false, JSON.stringify(inv.row?.details));

  // ---------------- dealerships
  await go(p, "/internal/dealerships");
  await act("confirmAliasAsNewDealership", p, "dealership-actions.confirmAliasAsNewDealership", [aliasA, `CLAUDE VERIFY DEALERSHIP ${ts}`, "Testville", "KS"], "dealer_alias_confirmed", { dealer_alias_id: aliasA }, L.id);
  const { data: da } = await a.from("dealer_aliases").select("dealership_id").eq("id", aliasA).single(); scratch.dealerships = [da.dealership_id];
  await act("mergeAliasIntoDealership", p, "dealership-actions.mergeAliasIntoDealership", [aliasB, da.dealership_id], "dealer_alias_merged", { dealer_alias_id: aliasB }, L.id);
  await act("addSalesperson", p, "dealership-actions.addSalesperson", [da.dealership_id, "CLAUDE VERIFY SALES", "555-0100", ""], "salesperson_added", {}, L.id);
  const { data: sp } = await a.from("dealership_salespeople").select("id").eq("dealership_id", da.dealership_id).single();
  await act("updateSalesperson", p, "dealership-actions.updateSalesperson", [sp.id, "CLAUDE VERIFY SALES 2", "555-0101", ""], "salesperson_updated", {}, L.id);
  await act("removeSalesperson", p, "dealership-actions.removeSalesperson", [sp.id], "salesperson_removed", {}, L.id);

  // ---------------- articles and social (scratch rows only)
  const png = fs.readFileSync((ROOT + "/public/og-image.png")).toString("base64");
  const edits = { content: "Scratch draft, edited.", captionX: "x2", captionFacebook: "f2", captionInstagram: "i2", captionLinkedin: "l2" };
  await go(p, "/internal/articles");
  await act("updateArticleDraft", p, "article-actions.updateArticleDraft", [artA, edits], "article_saved", {}, L.id);
  const ai = await act("attachArticleImage", p, "article-actions.attachArticleImage", [artA, { __form: { image: { __file: { name: "scratch.png", type: "image/png", b64: png } } } }], "article_image_attached", {}, L.id);
  if (ai.row?.details?.image_storage_path) scratch.storage.push(ai.row.details.image_storage_path);
  await act("approveArticle (scheduled 2099, so nothing goes live)", p, "article-actions.approveArticle", [artA, edits], "article_approved", {}, L.id);
  await act("regenerateArticleDraft (real Claude call, scratch row)", p, "article-actions.regenerateArticleDraft", [artB], "article_regenerated", {}, L.id);
  await go(p, "/internal/social");
  const sedits = { captionX: "x2", captionFacebook: "f2", captionInstagram: "i2", captionLinkedin: "l2" };
  await act("updateSocialPostDraft", p, "social-actions.updateSocialPostDraft", [postA, sedits], "social_post_saved", {}, L.id);
  const si = await act("attachSocialPostImage", p, "social-actions.attachSocialPostImage", [postA, { __form: { image: { __file: { name: "scratch.png", type: "image/png", b64: png } } } }], "social_post_image_attached", {}, L.id);
  if (si.row?.details?.image_storage_path) scratch.storage.push(si.row.details.image_storage_path);
  await act("approveSocialPost", p, "social-actions.approveSocialPost", [postA, sedits], "social_post_approved", {}, L.id);
  await act("markPlatformPosted", p, "social-actions.markPlatformPosted", ["social", postA, "x"], "platform_marked_posted", {}, L.id);
  await act("regenerateSocialPost (real Claude call, scratch row)", p, "social-actions.regenerateSocialPost", [postB], "social_post_regenerated", {}, L.id);

  // ---------------- team
  await go(p, "/internal/agents");
  const inv2 = await act("resendInviteAction (login already exists)", p, "agent-team-actions.resendInviteAction", [T1.id], "agent_invited", {}, L.id);
  ok("agent_invited details: resent true", inv2.row?.details?.resent === true && inv2.row?.details?.agent_id === T1.id, JSON.stringify(inv2.row?.details));
  await act("resetTwoFactorAction", p, "agent-team-actions.resetTwoFactorAction", [T2.id], "agent_two_factor_reset", {}, L.id);
  { // enrollment, as the invited agent itself
    const n0 = await cnt(T1.id);
    const gl = must(await a.auth.admin.generateLink({ type: "recovery", email: T1.email }), "link");
    const q = await ctxPage(); await go(q, `/agent/accept?token_hash=${gl.properties.hashed_token}&purpose=invite`);
    await q.click("form button[type=submit]"); await q.waitForFunction(() => location.pathname === "/agent/set-password", { timeout: 240000 }).catch(() => {});
    await q.type('input[name="password"]', pw); await q.type('input[name="confirm"]', pw);
    await q.click("form button[type=submit]"); await q.waitForFunction(() => location.pathname === "/agent/enroll", { timeout: 240000 }).catch(() => {});
    await q.waitForSelector("details summary"); await q.click("details summary"); await new Promise((r) => setTimeout(r, 300));
    const secret = await q.evaluate(() => document.querySelector('[aria-label="Authenticator key"]').textContent.replace(/ /g, ""));
    await q.type('input[name="code"]', totp(secret)); await q.click("form button[type=submit]"); await q.waitForFunction(() => location.pathname !== "/agent/enroll", { timeout: 240000 }).catch(() => {});
    const row = await latest(T1.id);
    ok("enrollment → 1 × agent_two_factor_enrolled, by the agent itself", at(q) === "/internal/outreach" && (await cnt(T1.id)) - n0 === 1 && row?.action === "agent_two_factor_enrolled", `${at(q)} ${row?.action}`);
    rows.push(["enrollment (/agent/enroll)", "agent_two_factor_enrolled", at(q) === "/internal/outreach" ? "ok" : "FAILED", (await cnt(T1.id)) - n0, row?.action, "by the agent"]);
    await q.browserContext().close();
  }
  // nothing attributed to anyone else
  { const { data: stray } = await a.from("agent_activity_log").select("agent_id, action").gte("created_at", runStart).not("agent_id", "in", `(${[L.id, T1.id, padmin.id].join(",")})`);
    ok("no activity row attributed to any other agent (Brett included)", (stray ?? []).length === 0, JSON.stringify(stray)); }
  { const { data: al } = await a.from("agent_alerts").select("id").gte("created_at", runStart).eq("kind", "activity_log_failed");
    ok("no activity_log_failed alerts in the normal run", (al ?? []).length === 0, `${(al ?? []).length}`); }
  await p.browserContext().close(); await pc.browserContext().close();
  console.log("\nACTION".padEnd(62) + "| CODE".padEnd(30) + "| RESULT | ROWS | LINKS");
  for (const r of rows) console.log(`${r[0].padEnd(61)}| ${r[1].padEnd(28)}| ${String(r[2]).padEnd(6)} | ${r[3]}    | ${r[5]}`);
  }
} catch (e) { fail++; console.log("ERROR", e.stack ?? e); }
finally {
  await browser.close();
  const del = async (t, col, ids) => { if (ids.length) { const { error } = await a.from(t).delete().in(col, ids); if (error) console.log("cleanup", t, error.message); } };
  const { data: mine } = await a.from("agents").select("id").ilike("email", `${PFX}%`);
  for (const r of mine ?? []) if (!agentIds.includes(r.id)) agentIds.push(r.id);
  await del("agent_activity_log", "agent_id", agentIds);
  await a.from("agent_activity_log").delete().eq("agent_id", padmin.id).gte("created_at", runStart);
  await del("agent_alerts", "agent_id", agentIds);
  const S = scratch.searches;
  if (S.length) {
    await a.from("customer_searches").update({ purchased_qualifying_offer_id: null }).in("id", S);
    for (const [t, col] of [["post_deal_surveys", "customer_search_id"], ["cancellation_log", "search_id"], ["purchase_status_log", "search_id"], ["notification_events", "customer_search_id"]]) await del(t, col, S);
    const { data: offers } = await a.from("qualifying_offers").select("id").in("customer_search_id", S); const O = (offers ?? []).map((o) => o.id);
    await del("offer_messages", "qualifying_offer_id", O); await del("deal_progress", "qualifying_offer_id", O); await del("offer_addons", "qualifying_offer_id", O); await del("documents", "qualifying_offer_id", O);
    await del("qualifying_offers", "id", O);
    await del("search_option_selections", "search_id", S); await del("search_trim_preferences", "search_id", S); await del("search_combination_preferences", "search_id", S);
    await del("customer_searches", "id", S);
  }
  await del("offer_messages", "customer_id", scratch.customers); await del("general_threads", "customer_id", scratch.customers);
  await del("listings", "id", scratch.listings);
  if (scratch.dealerships?.length) { await del("dealership_salespeople", "dealership_id", scratch.dealerships); await a.from("dealer_aliases").delete().in("dealership_id", scratch.dealerships); await del("dealerships", "id", scratch.dealerships); }
  await a.from("dealer_aliases").delete().like("dealer_name", `CLAUDE VERIFY DEALER ${ts}%`);
  if (scratch.storage.length) await a.storage.from("social-post-images").remove(scratch.storage);
  await del("articles", "id", scratch.articles); await del("social_posts", "id", scratch.posts);
  for (const id of agentIds) { const { error } = await a.from("agents").delete().eq("id", id); if (error) console.log("delete agent", error.message); }
  for (const id of logins) await a.auth.admin.deleteUser(id);
  await del("customers", "id", scratch.customers);
  await a.from("agent_signin_attempts").delete().gte("created_at", runStart);
  const c = async (t, f) => (await f(a.from(t).select("*", { count: "exact", head: true }))).count;
  const left = {
    logins: (await Promise.all(logins.map(async (id) => !!(await a.auth.admin.getUserById(id)).data?.user))).filter(Boolean).length,
    agents: await c("agents", (q) => q.ilike("email", `${PFX}%`)),
    searches: S.length ? await c("customer_searches", (q) => q.in("id", S)) : 0,
    aliases: await c("dealer_aliases", (q) => q.like("dealer_name", `CLAUDE VERIFY DEALER ${ts}%`)),
    dealerships: await c("dealerships", (q) => q.like("name", `CLAUDE VERIFY DEALERSHIP ${ts}%`)),
    articles: await c("articles", (q) => q.like("slug", `${PFX}%`)),
    posts: scratch.posts.length ? await c("social_posts", (q) => q.in("id", scratch.posts)) : 0,
    listings: scratch.listings.length ? await c("listings", (q) => q.in("id", scratch.listings)) : 0,
    alerts: agentIds.length ? await c("agent_alerts", (q) => q.in("agent_id", agentIds)) : 0,
  };
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: ${JSON.stringify(left)} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (Object.values(left).some((v) => v) || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
