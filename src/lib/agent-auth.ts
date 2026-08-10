import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";

export interface Agent {
  id: string;
  name: string;
  email: string;
}

/**
 * Reuses the existing customer-facing Supabase Auth session rather than a
 * separate agent login system — a signed-in user only counts as an agent if
 * their email matches an active row in `agents`, which has no client-facing
 * RLS policy, so this always reads via the admin client.
 */
export async function getAuthorizedAgent(): Promise<Agent | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const admin = createAdminClient();
  const { data: agent } = await admin
    .from("agents")
    .select("id, name, email")
    .eq("email", user.email)
    .eq("active", true)
    .maybeSingle();

  return agent;
}

/** For Server Components — redirects rather than returning null. */
export async function requireAgent(): Promise<Agent> {
  const agent = await getAuthorizedAgent();
  if (agent) {
    return agent;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/" : "/login");
}
