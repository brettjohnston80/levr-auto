// Removes leftover throwaway test data from interrupted runs: ONLY claude-verify-<digits>-... addresses.
// Never the persistent test admin (claude-verify-admin@...), testers, the review account, or anything else.
import { createAdminClient } from "./admin.mjs";
const a = createAdminClient(); const RE = /^claude-verify-\d{10,}-[a-z0-9-]+@(levrauto-test|verify)\.invalid$/;
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count; const b0 = await cnt(brett.id);
const { data: agents } = await a.from("agents").select("id, email, levrid").ilike("email", "claude-verify-%");
const victims = agents.filter((x) => RE.test(x.email) && x.levrid === null);
let users = []; for (let page = 1; ; page++) { const { data } = await a.auth.admin.listUsers({ page, perPage: 1000 }); users.push(...data.users); if (data.users.length < 1000) break; }
const loginVictims = users.filter((u) => RE.test(u.email ?? ""));
console.log(`found: ${victims.length} test agents, ${loginVictims.length} test logins`, victims.map((x) => x.email), loginVictims.map((u) => u.email));
const { data: admin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
for (const v of victims) { await a.from("agent_activity_log").delete().eq("agent_id", v.id); await a.from("agent_activity_log").delete().eq("agent_id", admin.id).filter("details->>agent_id", "eq", v.id); await a.from("agents").delete().eq("id", v.id); }
for (const u of loginVictims) { await a.from("customer_searches").delete().eq("customer_id", u.id); await a.auth.admin.deleteUser(u.id); }
const { count: al } = await a.from("agents").select("id", { count: "exact", head: true }).ilike("email", "claude-verify-1%");
let ul = 0; for (const u of loginVictims) if ((await a.auth.admin.getUserById(u.id)).data?.user) ul++;
console.log(`after: test agents ${al} | test logins ${ul} | Brett activity ${b0} -> ${await cnt(brett.id)} | persistent admin activity ${await cnt(admin.id)}`);
