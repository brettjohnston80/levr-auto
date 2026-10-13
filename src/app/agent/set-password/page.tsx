import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgentCard } from "@/components/agent-card";
import { SetPasswordForm } from "@/components/agent-setup-forms";
import { cameFromSetupLink, currentAgentLogin } from "@/lib/agent-session";
import { PASSWORD_REQUIREMENTS } from "@/lib/password-rules";

export const metadata: Metadata = { title: "LEVR Auto agent sign-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Reached only from an invite or reset link used in the last 30 minutes. */
export default async function AgentSetPasswordPage() {
  const login = await currentAgentLogin();
  if (!login || !(await cameFromSetupLink(login.supabase))) redirect("/agent");
  return (
    <AgentCard heading="Set your password">
      <SetPasswordForm requirements={PASSWORD_REQUIREMENTS} />
    </AgentCard>
  );
}
