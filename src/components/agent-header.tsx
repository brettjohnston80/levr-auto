import Link from "next/link";
import { agentSignOut } from "@/lib/agent-signin-actions";
import { SubmitButton } from "@/components/submit-button";
import type { Agent } from "@/lib/agent-auth";

/** The signed-in agent header on /internal pages (plan section 3.6; restyled with the Phase 3 shell). */
export function AgentHeader({ agent }: { agent: Agent }) {
  return (
    <header className="border-b border-white/10 bg-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/internal/outreach" className="text-sm font-semibold tracking-wide text-white">
          LEVR Auto · Agent
        </Link>
        <div className="flex items-center gap-3 text-sm text-zinc-300">
          <span>
            {agent.name}
            {agent.levrid !== null && ` (LEVRID ${agent.levrid})`}
          </span>
          <form action={agentSignOut}>
            <SubmitButton
              pendingLabel="Signing out…"
              className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
            >
              Sign out
            </SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}
