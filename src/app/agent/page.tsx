import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAgentAccount } from "@/lib/agent-accounts";
import { AgentSigninForm } from "@/components/agent-signin-form";
import { AgentCard } from "@/components/agent-card";

export const metadata: Metadata = {
  title: "LEVR Auto agent sign-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Agent sign-in (Phase 1, Chunk 1b). Internal look, no site header or footer
 * (SiteChrome hides them under /agent). Customer sign-in at /login is unchanged.
 */
export default async function AgentSigninPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialStep: "password" | "two_factor" = "password";
  if (user && isAgentAccount(user)) {
    const admin = createAdminClient();
    const { data: agent } = await admin
      .from("agents")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (agent) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") redirect("/internal/outreach");
      if (aal?.nextLevel === "aal2") initialStep = "two_factor";
      else redirect("/agent/enroll");
    }
  }

  return (
    <AgentCard heading="Agent sign-in">
      <AgentSigninForm initialStep={initialStep} />
    </AgentCard>
  );
}
