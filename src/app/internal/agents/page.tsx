import type { Metadata } from "next";
import { hasRole, requireAgent } from "@/lib/agent-auth";
import { getTeam } from "@/lib/agent-team";
import { TEAM_COPY } from "@/lib/agent-team-copy";
import { AddAgentForm } from "@/components/add-agent-form";
import { TeamList } from "@/components/team-list";

export const metadata: Metadata = {
  title: "Add an agent — LEVR Auto Internal",
};

export const dynamic = "force-dynamic";

// Chunk 1g: plain internal styling for now; restyled with the Phase 3 shell.
export default async function AgentsPage() {
  const agent = await requireAgent({ minRole: "lead" });
  const team = await getTeam(agent);

  return (
    <section className="min-h-screen bg-zinc-950 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h1 className="text-2xl font-semibold text-white">{TEAM_COPY.pageTitle}</h1>
        <div className="mt-6 max-w-xl">
          <AddAgentForm canAddLeads={hasRole(agent, "admin")} />
        </div>

        <div className="mt-14">
          <h2 className="text-lg font-semibold text-white">
            {TEAM_COPY.agentsHeading} <span className="text-sm font-normal text-zinc-500">({team.length})</span>
          </h2>
          <div className="mt-4">
            <TeamList members={team} />
          </div>
        </div>
      </div>
    </section>
  );
}
