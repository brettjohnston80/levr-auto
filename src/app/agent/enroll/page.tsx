import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgentCard } from "@/components/agent-card";
import { AgentEnrollSetup } from "@/components/agent-enroll-setup";
import { currentAgentLogin, verifiedTotpFactorId } from "@/lib/agent-session";

export const metadata: Metadata = { title: "LEVR Auto agent sign-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Turn on two-factor sign-in. Every agent must finish this before reaching
 * anything else (enforced on every agent page in Chunk 1d). The authenticator
 * itself is started once, from the browser (AgentEnrollSetup), because a page
 * render can happen more than once per visit.
 */
export default async function AgentEnrollPage() {
  const login = await currentAgentLogin();
  if (!login) redirect("/agent");
  if (await verifiedTotpFactorId(login.supabase)) redirect("/agent");
  return (
    <AgentCard heading="Turn on two-factor sign-in">
      <p className="text-sm text-zinc-700">
        Scan this code with an authenticator app (such as Google Authenticator, 1Password or Authy), then enter the
        6-digit code it shows.
      </p>
      <AgentEnrollSetup />
    </AgentCard>
  );
}
