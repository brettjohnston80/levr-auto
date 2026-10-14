// Agent dashboard Phase 1, Chunk 1f: Part A of moving an agent to a new agent-only login.
// Plan: docs/plans/agent-dashboard-phase1-code-plan.md, section 7.7.
//
// Used once on deploy day to move Brett (LEVRID 1) from bjohnston@levrauto.com (a customer
// login) to brett@levrauto.com, BEFORE the deploy, so his old access keeps working until he has
// proven the new login works with two-factor:
//   1. adds a temporary holder row (a test agent: no LEVRID, out of rotation), acting as the
//      persistent test admin (claude-verify-admin@levrauto-test.invalid);
//   2. creates the new agent-only login (no customer record) and links it to the holder, so the
//      setup pages accept it, while the real agent row is not touched;
//   3. writes a one-time setup link (1 hour) to a private file, not to the terminal: agent emails
//      are never sent outside production (Chunk 0), and the link must not land in a chat.
// Part B (after the deploy) is SQL Brett runs: remove the holder and relink_agent_login.
//
// Usage (from the repo root, with my branch dev server running on the --base port):
//   node scripts/agent-cutover-prepare.mjs --new-email brett@levrauto.com --levrid 1 \
//     --base http://localhost:3100
// Rehearsal with stand-ins: --agent-id <uuid> instead of --levrid, and --holder-email /
// --link-file. Running it again for the same new email only writes a fresh link (the old one
// stops working).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith("--") ? [...acc, [v.slice(2), all[i + 1]]] : acc), []),
);
const newEmail = (args["new-email"] ?? "").trim().toLowerCase();
const base = (args.base ?? "http://localhost:3100").replace(/\/+$/, "");
const holderEmail = (args["holder-email"] ?? "brett-cutover-holder@levrauto-test.invalid").toLowerCase();
const linkFile = args["link-file"] ?? path.join(os.homedir(), "Downloads", "levr-agent-setup-link.html");
const TEST_SUFFIX = "@levrauto-test.invalid";
const PERSISTENT_TEST_ADMIN = "claude-verify-admin@levrauto-test.invalid";
if (!newEmail || (!args.levrid && !args["agent-id"])) {
  console.error("Usage: --new-email <address> (--levrid <n> | --agent-id <uuid>) [--base <url>]");
  process.exit(1);
}
if (!holderEmail.endsWith(TEST_SUFFIX)) throw new Error(`The holder must be a test address (${TEST_SUFFIX}).`);

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

// The agent being moved, and the actor for the holder (never the agent being moved).
const target = must(
  args.levrid
    ? await admin.from("agents").select("id, name, email, role, active, levrid, auth_user_id").eq("levrid", Number(args.levrid)).single()
    : await admin.from("agents").select("id, name, email, role, active, levrid, auth_user_id").eq("id", args["agent-id"]).single(),
  "agent to move",
);
if (!target.active) throw new Error("That agent is deactivated.");
const actor = must(await admin.from("agents").select("id").eq("email", PERSISTENT_TEST_ADMIN).single(), "persistent test admin");

// Holder row: reuse if a previous run made it.
let holder = must(await admin.from("agents").select("id, auth_user_id").eq("email", holderEmail).maybeSingle(), "holder lookup");
if (!holder) {
  holder = must(
    await admin.rpc("add_agent", {
      p_actor_agent_id: actor.id,
      p_email: holderEmail,
      p_name: `${target.name} (new login, temporary)`,
      p_role: "agent",
      p_in_rotation: false,
    }),
    "add holder",
  );
}

// New agent-only login: reuse if a previous run made it (and it is linked to the holder).
const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
let login = listed.users.find((u) => (u.email ?? "").toLowerCase() === newEmail);
if (login) {
  if (login.app_metadata?.account_type !== "agent") throw new Error(`${newEmail} already exists and is not an agent-only login.`);
  if (holder.auth_user_id && holder.auth_user_id !== login.id) throw new Error("The holder is linked to a different login.");
} else {
  login = must(
    await admin.auth.admin.createUser({
      email: newEmail,
      email_confirm: true,
      app_metadata: { account_type: "agent", agent_id: target.id },
    }),
    "create login",
  ).user;
}
const { count: customerRows } = await admin.from("customers").select("id", { count: "exact", head: true }).eq("id", login.id);
if (customerRows !== 0) throw new Error("The new login has a customer record; stopping.");
if (!holder.auth_user_id) {
  must(await admin.rpc("link_agent_login", { p_actor_agent_id: actor.id, p_agent_id: holder.id, p_auth_user_id: login.id }), "link holder");
}

// One-time setup link, to a private file.
const gl = must(await admin.auth.admin.generateLink({ type: "recovery", email: newEmail }), "setup link");
const url = `${base}/agent/accept?token_hash=${encodeURIComponent(gl.properties.hashed_token)}&purpose=invite`;
fs.writeFileSync(
  linkFile,
  `<!doctype html><meta charset="utf-8"><title>LEVR agent setup link</title>` +
    `<p style="font:16px -apple-system,Helvetica,Arial">One-time setup link for ${newEmail} (works once, expires in 1 hour):</p>` +
    `<p style="font:16px -apple-system,Helvetica,Arial"><a href="${url}">Open the setup page</a></p>`,
  { mode: 0o600 },
);
fs.chmodSync(linkFile, 0o600);

console.log(JSON.stringify({
  agent_moving: { id: target.id, levrid: target.levrid, current_email: target.email, current_login: target.auth_user_id },
  holder: { id: holder.id, email: holderEmail },
  new_login: { id: login.id, email: newEmail },
  link_file: linkFile,
}, null, 2));
