import type { Metadata } from "next";
import { getAuthorizedAgent } from "@/lib/agent-auth";
import { AgentHeader } from "@/components/agent-header";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Agent dashboard pages (Phase 1, Chunk 1d): the agent header instead of the
 * marketing header and footer. Each page still runs requireAgent() itself,
 * which sends anyone who isn't a signed-in, two-factor-verified, active agent
 * to /agent; this layout only shows the header when that check passes.
 */
export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const agent = await getAuthorizedAgent();
  return (
    <>
      {agent && <AgentHeader agent={agent} />}
      {children}
    </>
  );
}
