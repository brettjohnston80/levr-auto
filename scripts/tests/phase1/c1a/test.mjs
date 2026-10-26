import { createAdminClient } from "../lib/admin.mjs";
import { isAgentAccount, createAgentLogin, linkAgentLogin, relinkAgentLogin } from "../gen/real/agent-accounts.mjs";
const a = createAdminClient();
const ts = Date.now(), logins = []; let testAgentId = null, pass = 0, fail = 0;
const ok = (name, cond, detail = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const custCount = async (id) => (await a.from("customers").select("id", { count: "exact", head: true }).eq("id", id)).count;
const { data: brett } = await a.from("agents").select("id, levrid, role, auth_user_id").eq("levrid", 1).single();
const ADMIN_EMAIL = "claude-verify-admin@levrauto-test.invalid";
const runStart = new Date(Date.now() - 1000).toISOString();
const { data: admin } = await a.from("agents").select("id, email, role, levrid, active, in_rotation, auth_user_id").eq("email", ADMIN_EMAIL).maybeSingle();
if (!admin || admin.email !== ADMIN_EMAIL || admin.auth_user_id !== null || admin.levrid !== null || admin.role !== "admin" || !admin.active || admin.in_rotation || admin.id === brett.id) {
  console.log("REFUSING TO RUN: no disposable test admin found", JSON.stringify(admin)); process.exit(1);
}
console.log("TEST ADMIN:", JSON.stringify(admin));
const adminActCount = async () => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", admin.id)).count;
const adminActBefore = await adminActCount();
const actCount = async () => (await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", brett.id)).count;
const brettActBefore = await actCount();
try {
  ok("isAgentAccount agent flag", isAgentAccount({ app_metadata: { account_type: "agent" } }) === true);
  ok("isAgentAccount customer", isAgentAccount({ app_metadata: { provider: "email" } }) === false);
  ok("isAgentAccount null", isAgentAccount(null) === false);
  const l1 = await createAgentLogin(` Claude-Verify-${ts}-A1@levrauto-test.invalid `);
  ok("createAgentLogin #1", l1.ok, l1.ok ? l1.value : l1.error); if (l1.ok) logins.push(l1.value);
  const u1 = l1.ok ? (await a.auth.admin.getUserById(l1.value)).data.user : null;
  ok("  email lowercased/trimmed", u1?.email === `claude-verify-${ts}-a1@levrauto-test.invalid`, u1?.email);
  ok("  app_metadata account_type agent", u1?.app_metadata?.account_type === "agent", JSON.stringify(u1?.app_metadata));
  ok("  0 customer records", (await custCount(l1.value)) === 0);
  const dup = await createAgentLogin(`claude-verify-${ts}-a1@levrauto-test.invalid`);
  ok("createAgentLogin same address refused", !dup.ok, dup.ok ? "created!" : dup.error);
  const l2 = await createAgentLogin(`claude-verify-${ts}-a2@levrauto-test.invalid`);
  ok("createAgentLogin #2", l2.ok); if (l2.ok) logins.push(l2.value);
  const { data: cu } = await a.auth.admin.createUser({ email: `claude-verify-${ts}-c@verify.invalid`, email_confirm: true });
  logins.push(cu.user.id);
  ok("customer login gets 1 customer record", (await custCount(cu.user.id)) === 1);
  const { data: ta, error: taErr } = await a.from("agents").insert({ email: `claude-verify-${ts}@levrauto-test.invalid`, name: "CLAUDE VERIFY TEST AGENT", role: "agent", in_rotation: false }).select("id, levrid, auth_user_id").single();
  if (taErr) throw taErr; testAgentId = ta.id;
  ok("test agent row (no LEVRID, unlinked)", ta.levrid === null && ta.auth_user_id === null);
  const r1 = await linkAgentLogin(testAgentId, testAgentId, l1.value);
  ok("link refused for a non-lead actor", !r1.ok, r1.ok ? "linked!" : r1.error);
  const r2 = await linkAgentLogin(admin.id, testAgentId, cu.user.id);
  ok("link refused for a customer login (by the guard)", !r2.ok && /not an agent-only login/.test(r2.error), r2.ok ? "linked!" : r2.error);
  const r3 = await linkAgentLogin(admin.id, testAgentId, l1.value);
  ok("link agent-only login (admin actor)", r3.ok && r3.value.auth_user_id === l1.value, r3.ok ? `auth_user_id=${r3.value.auth_user_id}` : r3.error);
  const r4 = await linkAgentLogin(admin.id, testAgentId, l2.value);
  ok("second link refused (already has a login)", !r4.ok, r4.ok ? "linked!" : r4.error);
  const r5 = await relinkAgentLogin(testAgentId, testAgentId, l2.value);
  ok("relink refused for a non-admin actor", !r5.ok, r5.ok ? "relinked!" : r5.error);
  const r6 = await relinkAgentLogin(admin.id, testAgentId, cu.user.id);
  ok("relink refused for a customer login (by the guard)", !r6.ok && /not an agent-only login/.test(r6.error), r6.ok ? "relinked!" : r6.error);
  const l3 = await createAgentLogin(`claude-verify-${ts}-a3@verify.invalid`); if (l3.ok) logins.push(l3.value);
  const r6b = await relinkAgentLogin(admin.id, testAgentId, l3.value);
  ok("relink refused: test agent to a non-test address (LEVRID rule)", !r6b.ok && /agents_levrid_required/.test(r6b.error), r6b.ok ? "relinked!" : r6b.error);
  const r7 = await relinkAgentLogin(admin.id, testAgentId, l2.value);
  ok("relink to second agent login", r7.ok && r7.value.auth_user_id === l2.value && r7.value.email === `claude-verify-${ts}-a2@levrauto-test.invalid`, r7.ok ? `email=${r7.value.email}` : r7.error);
  const { data: acts } = await a.from("agent_activity_log").select("id, action, details").eq("agent_id", admin.id).filter("details->>agent_id", "eq", testAgentId).order("created_at");
  ok("activity logged: agent_invited then agent_login_relinked", acts.map(x => x.action).join(",") === "agent_invited,agent_login_relinked", acts.map(x => x.action).join(","));
  const { data: me } = await a.from("agents").select("auth_user_id, levrid, role").eq("id", brett.id).single();
  ok("Brett's agent row unchanged", me.levrid === 1 && me.role === "admin" && me.auth_user_id === brett.auth_user_id, `levrid=${me.levrid} role=${me.role} login unchanged=${me.auth_user_id === brett.auth_user_id}`);
} catch (e) { fail++; console.log("ERROR", e.message ?? e); }
finally {
  if (testAgentId) {
    const { error: e2 } = await a.from("agents").delete().eq("id", testAgentId); if (e2) console.log("CLEANUP agent FAIL", e2.message);
  }
  const { count: adminActs } = await a.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("agent_id", admin.id).gte("created_at", runStart);
  const { error: e1 } = await a.from("agent_activity_log").delete().eq("agent_id", admin.id).gte("created_at", runStart); if (e1) console.log("CLEANUP activity FAIL", e1.message);
  const { count: adminLeft } = await a.from("agents").select("id", { count: "exact", head: true }).eq("id", admin.id).eq("role", "admin").is("auth_user_id", null).eq("in_rotation", false);
  const adminActsLeft = await adminActCount();
  console.log(`CLEANUP: run wrote ${adminActs} test-admin activity rows, deleted; test admin activity before ${adminActBefore} after ${adminActsLeft} | persistent test admin still there, unlinked, out of rotation: ${adminLeft === 1}`);
  if (adminActsLeft !== adminActBefore || adminLeft !== 1) { fail++; console.log("FAIL  persistent test admin not back to its starting state"); }
  for (const id of logins) { const { error } = await a.auth.admin.deleteUser(id); if (error) console.log("CLEANUP login FAIL", id, error.message); }
  let au = 0; for (const id of logins) if ((await a.auth.admin.getUserById(id)).data?.user) au++;
  const { count: cc } = await a.from("customers").select("id", { count: "exact", head: true }).in("id", logins.length ? logins : ["00000000-0000-0000-0000-000000000000"]);
  const { count: ag } = await a.from("agents").select("id", { count: "exact", head: true }).ilike("email", `claude-verify-${ts}%`);
  console.log(`CLEANUP: logins left ${au} | customer rows left ${cc} | test agents left ${ag} | Brett activity rows before ${brettActBefore} after ${await actCount()}`);
  if ((await actCount()) !== brettActBefore) { fail++; console.log("FAIL  Brett's activity count changed"); }
  console.log(`${pass} passed, ${fail} failed`);
}
