import type { Metadata } from "next";
import Link from "next/link";
import { AgentCard } from "@/components/agent-card";
import { AcceptForm, AgentError } from "@/components/agent-setup-forms";
import {
  ACCEPT_COPY,
  AGENT_LINK_INVALID,
  AGENT_LINK_INVALID_INVITE_HINT,
  AGENT_LINK_INVALID_RESET_LINK,
} from "@/lib/agent-setup-copy";

export const metadata: Metadata = { title: "LEVR Auto agent sign-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Landing page for agent invite and reset links. Nothing happens until the
 * agent clicks Continue, so an inbox scanner fetching the link can't use it up.
 */
export default async function AgentAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; purpose?: string }>;
}) {
  const { token_hash, purpose } = await searchParams;
  const kind = purpose === "reset" ? "reset" : "invite";
  const copy = ACCEPT_COPY[kind];
  const invalidHint =
    kind === "reset" ? (
      <Link href="/agent/forgot-password" className="underline">
        {AGENT_LINK_INVALID_RESET_LINK}
      </Link>
    ) : (
      AGENT_LINK_INVALID_INVITE_HINT
    );
  return (
    <AgentCard heading={copy.heading}>
      {token_hash ? (
        <AcceptForm tokenHash={token_hash} body={copy.body} invalidHint={invalidHint} />
      ) : (
        <div className="space-y-4">
          <AgentError message={AGENT_LINK_INVALID} />
          <p className="text-sm text-zinc-600">{invalidHint}</p>
        </div>
      )}
    </AgentCard>
  );
}
