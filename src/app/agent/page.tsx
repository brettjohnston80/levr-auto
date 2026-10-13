import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAgentAccount } from "@/lib/agent-accounts";
import { AgentSigninForm } from "@/components/agent-signin-form";

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
    <div className="flex min-h-screen items-start justify-center bg-zinc-100 px-4 pt-16 sm:pt-24">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">LEVR Auto · Agent</p>
        <h1 className="mt-1 mb-6 text-xl font-semibold text-zinc-900">Agent sign-in</h1>
        <AgentSigninForm initialStep={initialStep} />
      </div>
    </div>
  );
}
