// Chunk 1g follow-up: in_rotation defaults for agents added through the form.
import { ROOT, LOGS } from "../lib/paths.mjs";
import fs from "node:fs";
for (const l of fs.readFileSync((ROOT + "/.env.local"),"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g,""); }
process.env.NODE_ENV = "development";
const { addAgent } = await import("../gen/spy/agent-invite.mjs");
const { captured } = await import("./spy-admin.mjs");
const { createAdminClient } = await import("../lib/admin.mjs");
const a = createAdminClient();
let pass = 0, fail = 0; const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const { data: padmin } = await a.from("agents").select("id").eq("email", "claude-verify-admin@levrauto-test.invalid").single();
const { data: brett } = await a.from("agents").select("id").eq("levrid", 1).single();
const cnt = async (id) => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", id)).count;
const counter0 = (await a.from("agent_levrid_counter").select("last_value").single()).data.last_value;
const agents0 = (await a.from("agents").select("id", { count: "exact", head: true })).count;
const b0 = await cnt(brett.id), ad0 = await cnt(padmin.id);
const ts = Date.now(), runStart = new Date(Date.now() - 2000).toISOString();

// 1. App layer: what the real addAgent sends to add_agent (captured, nothing written).
for (const [email, role, want] of [
  [`claude-verify-${ts}-real-agent@levrauto.com`, "agent", null],
  [`claude-verify-${ts}-real-lead@levrauto.com`, "lead", null],
  [`claude-verify-${ts}-real-admin@levrauto.com`, "admin", null],
  [`claude-verify-${ts}-test@levrauto-test.invalid`, "agent", false],
]) {
  captured.length = 0;
  await addAgent({ actorAgentId: padmin.id, name: "CLAUDE VERIFY ROTATION", email, role });
  const args = captured[0];
  ok(`form sends p_in_rotation=${want} for a ${email.endsWith("@levrauto.com") ? "real" : "test"} ${role}`, args && args.p_in_rotation === want && args.p_role === role, JSON.stringify(args && { p_role: args.p_role, p_in_rotation: args.p_in_rotation }));
}
ok("app layer wrote nothing (agents count, LEVRID counter unchanged)",
  (await a.from("agents").select("id", { count: "exact", head: true })).count === agents0 &&
  (await a.from("agent_levrid_counter").select("last_value").single()).data.last_value === counter0);

// 2. Database layer: what add_agent does with p_in_rotation = null (what real addresses get).
//    Test-domain addresses so no LEVRID is spent; rows deleted straight after.
const made = [];
try {
  for (const [role, want] of [["agent", true], ["lead", false], ["admin", false]]) {
    const { data, error } = await a.rpc("add_agent", { p_actor_agent_id: padmin.id, p_email: `claude-verify-${ts}-db-${role}@levrauto-test.invalid`, p_name: "CLAUDE VERIFY ROTATION", p_role: role, p_in_rotation: null });
    if (data?.id) made.push(data.id);
    ok(`add_agent with no rotation given: ${role} → in_rotation ${want}`, !error && data.in_rotation === want && data.role === role, error?.message ?? JSON.stringify({ role: data.role, in_rotation: data.in_rotation }));
  }
} finally {
  await a.from("agent_activity_log").delete().eq("agent_id", padmin.id).gte("created_at", runStart);
  for (const id of made) await a.from("agents").delete().eq("id", id);
  const left = (await a.from("agents").select("id", { count: "exact", head: true }).ilike("email", `claude-verify-${ts}%`)).count;
  const counter1 = (await a.from("agent_levrid_counter").select("last_value").single()).data.last_value;
  const b1 = await cnt(brett.id), ad1 = await cnt(padmin.id);
  console.log(`CLEANUP: test agents ${left} | LEVRID counter ${counter0} -> ${counter1} | test admin activity ${ad0} -> ${ad1} | Brett activity ${b0} -> ${b1}`);
  if (left || counter1 !== counter0 || b1 !== b0 || ad1 !== ad0) { fail++; console.log("FAIL  cleanup not back to zero"); }
  console.log(`${pass} passed, ${fail} failed`);
}
