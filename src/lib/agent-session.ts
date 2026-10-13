import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { isAgentAccount } from "./agent-accounts";

/**
 * The signed-in agent login, if any (Phase 1, Chunks 1b/1c). Checks, on the
 * server: a verified session (getUser), the agent flag in app_metadata, and an
 * ACTIVE agents row linked to this login. Says nothing about two-factor; the
 * caller decides what level it needs. Chunk 1d builds the every-page checks on
 * top of this.
 */
export interface AgentLogin {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  agent: { id: string; name: string; email: string; levrid: number | null; role: string };
}

export async function currentAgentLogin(): Promise<AgentLogin | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAgentAccount(user)) return null;
  const admin = createAdminClient();
  const { data: agent } = await admin
    .from("agents")
    .select("id, name, email, levrid, role")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!agent) return null;
  return { supabase, user, agent };
}

export async function verifiedTotpFactorId(
  supabase: AgentLogin["supabase"],
): Promise<string | null> {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp?.find((f) => f.status === "verified")?.id ?? null;
}

/** Set-password links are good for this long after the link was used. */
export const SET_PASSWORD_WINDOW_MINUTES = 30;

/**
 * True when this session came from one of our one-time links (invite or
 * password reset) within the last SET_PASSWORD_WINDOW_MINUTES. Setting a
 * password needs this, so a password alone (without the authenticator code)
 * can never be used to change the password.
 */
export async function cameFromSetupLink(supabase: AgentLogin["supabase"]): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const methods = data?.currentAuthenticationMethods ?? [];
  const cutoff = Date.now() / 1000 - SET_PASSWORD_WINDOW_MINUTES * 60;
  return methods.some(
    (m) =>
      typeof m === "object" &&
      (m.method === "recovery" || m.method === "otp" || m.method === "invite") &&
      m.timestamp >= cutoff,
  );
}
