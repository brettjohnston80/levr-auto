import type { Metadata } from "next";
import { AgentCard } from "@/components/agent-card";
import { ForgotPasswordForm } from "@/components/agent-setup-forms";

export const metadata: Metadata = { title: "LEVR Auto agent sign-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Self-serve password reset (C15). The answer never says whether the address is an agent. */
export default function AgentForgotPasswordPage() {
  return (
    <AgentCard heading="Reset your password">
      <ForgotPasswordForm />
    </AgentCard>
  );
}
