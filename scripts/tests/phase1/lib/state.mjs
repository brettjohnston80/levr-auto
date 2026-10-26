// Read-only safety snapshot, taken before and after every run (lib/run.sh). Prints one JSON line.
//   - Brett (LEVRID 1): activity rows, role, rotation, active. Must be identical before and after.
//   - Accounts tests must never touch (tester round, review account, Brett's verification account,
//     the training agent): their searches, offers and latest change. Must be identical.
//   - Leftovers from the tests: claude-verify-<digits> agents, customers, logins, and their
//     searches. Must be 0 after.
// Usage: node lib/state.mjs > before.json   ...   node lib/state.mjs --compare before.json
import fs from "node:fs";
import crypto from "node:crypto";
import { createAdminClient } from "./admin.mjs";

const a = createAdminClient();
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const count = async (q, what) => { const r = await q; if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.count; };
const SCRATCH = /^claude-verify-\d{10,}-/;
const PERSISTENT_ADMIN = "claude-verify-admin@levrauto-test.invalid";
const OFF_LIMITS = [
  ...Array.from({ length: 11 }, (_, i) => `tester${i + 1}@levrauto-test.invalid`),
  "brett-deal-review@levrauto-test.invalid",
  "test-verification@levrauto.invalid",
];

const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await a.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const byEmail = new Map(users.map((u) => [(u.email ?? "").toLowerCase(), u.id]));

const agentState = async (filter, label) => {
  const ag = must(await filter(a.from("agents").select("id, role, in_rotation, active")).maybeSingle(), label);
  if (!ag) return "not added";
  const activity = await count(a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", ag.id), `${label} activity`);
  return { role: ag.role, in_rotation: ag.in_rotation, active: ag.active, activity };
};

const offLimits = {};
for (const email of OFF_LIMITS) {
  const id = byEmail.get(email);
  if (!id) { offLimits[email] = "no login"; continue; }
  const searches = must(await a.from("customer_searches").select("id, updated_at").eq("customer_id", id), `${email} searches`);
  const ids = searches.map((s) => s.id);
  const offers = ids.length ? await count(a.from("qualifying_offers").select("id", { count: "exact", head: true }).in("customer_search_id", ids), `${email} offers`) : 0;
  const cust = must(await a.from("customers").select("*").eq("id", id).maybeSingle(), `${email} customer`);
  offLimits[email] = {
    searches: searches.length,
    offers,
    latestSearchChange: searches.map((s) => s.updated_at).sort().at(-1) ?? null,
    customerRow: cust ? crypto.createHash("sha256").update(JSON.stringify(cust)).digest("hex").slice(0, 16) : null,
  };
}

const scratchAgents = must(await a.from("agents").select("id, email").ilike("email", "claude-verify-%"), "scratch agents").filter((x) => x.email !== PERSISTENT_ADMIN && SCRATCH.test(x.email));
const scratchLogins = users.filter((u) => SCRATCH.test(u.email ?? "")).map((u) => u.id);
const scratchCustomers = must(await a.from("customers").select("id, email").ilike("email", "claude-verify-%"), "scratch customers").filter((c) => SCRATCH.test(c.email ?? ""));
const scratchSearches = scratchCustomers.length
  ? await count(a.from("customer_searches").select("id", { count: "exact", head: true }).in("customer_id", scratchCustomers.map((c) => c.id)), "scratch searches")
  : 0;

const state = {
  at: new Date().toISOString(),
  brett: await agentState((q) => q.eq("levrid", 1), "Brett"),
  trainingAgent: await agentState((q) => q.eq("email", "training@levrauto.com"), "training agent"),
  persistentTestAdmin: await agentState((q) => q.eq("email", PERSISTENT_ADMIN), "persistent test admin"),
  offLimits,
  leftovers: { agents: scratchAgents.length, logins: scratchLogins.length, customers: scratchCustomers.length, searches: scratchSearches },
  agentsTotal: await count(a.from("agents").select("id", { count: "exact", head: true }), "agents"),
  authUsersTotal: users.length,
};

const i = process.argv.indexOf("--compare");
if (i < 0) { console.log(JSON.stringify(state)); process.exit(0); }
const before = JSON.parse(fs.readFileSync(process.argv[i + 1], "utf8"));
const problems = [];
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
if (!same(before.brett, state.brett)) problems.push(`Brett changed: ${JSON.stringify(before.brett)} -> ${JSON.stringify(state.brett)}`);
if (!same(before.trainingAgent, state.trainingAgent)) problems.push(`training agent changed: ${JSON.stringify(before.trainingAgent)} -> ${JSON.stringify(state.trainingAgent)}`);
const pa = ["role", "in_rotation", "active"];
if (!same(pa.map((k) => before.persistentTestAdmin[k]), pa.map((k) => state.persistentTestAdmin[k]))) problems.push("persistent test admin's role/rotation/active changed");
if (state.persistentTestAdmin.activity !== before.persistentTestAdmin.activity) problems.push(`persistent test admin activity ${before.persistentTestAdmin.activity} -> ${state.persistentTestAdmin.activity} (a test left rows)`);
for (const email of OFF_LIMITS) if (!same(before.offLimits[email], state.offLimits[email])) problems.push(`${email} changed: ${JSON.stringify(before.offLimits[email])} -> ${JSON.stringify(state.offLimits[email])}`);
for (const [k, v] of Object.entries(state.leftovers)) if (v !== 0) problems.push(`leftover scratch ${k}: ${v}`);
if (state.agentsTotal !== before.agentsTotal) problems.push(`agents ${before.agentsTotal} -> ${state.agentsTotal}`);
if (state.authUsersTotal !== before.authUsersTotal) problems.push(`auth users ${before.authUsersTotal} -> ${state.authUsersTotal}`);
console.log(JSON.stringify({ before: { brett: before.brett, leftovers: before.leftovers, agentsTotal: before.agentsTotal, authUsersTotal: before.authUsersTotal }, after: { brett: state.brett, leftovers: state.leftovers, agentsTotal: state.agentsTotal, authUsersTotal: state.authUsersTotal }, problems }, null, 1));
process.exit(problems.length ? 1 : 0);
