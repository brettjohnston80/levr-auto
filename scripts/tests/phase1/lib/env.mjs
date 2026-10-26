// Environment for the Phase 1 end-to-end tests. Nothing secret lives in these
// files: values are read at runtime from the repo's .env.local (git-ignored)
// and the process environment, and are never printed.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadProtected, guardedFetch } from "./protect.mjs";

/** The repo (worktree) root: scripts/tests/phase1/lib -> four levels up. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function loadDotEnv() {
  const file = path.join(ROOT, ".env.local");
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** .env.local, overridden by anything set in the process environment. */
export const env = { ...loadDotEnv(), ...process.env };

/** The branch dev server these tests drive (never Brett's :3000). */
export const PORT = Number(env.PHASE1_TEST_PORT || 3100);
export const BASE = `http://localhost:${PORT}`;

const requireFromRoot = createRequire(path.join(ROOT, "package.json"));
const { createClient } = requireFromRoot("@supabase/supabase-js");

function rawAdminClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Brett's ids and emails, loaded once per process with an unguarded client (reads only).
let protectedValues = null;
const getProtected = () => (protectedValues ??= loadProtected(rawAdminClient()));

/**
 * Service-role client (bypasses RLS), for setup, checks and cleanup. Every write it sends that
 * names Brett's account is refused (lib/protect.mjs); reads are allowed.
 */
export function adminClient() {
  rawAdminClient();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: guardedFetch(getProtected) },
  });
}



export const db = adminClient();
