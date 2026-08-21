import type { Metadata } from "next";
import { requireAgent } from "@/lib/agent-auth";
import { getAdminSearches } from "@/lib/admin-actions";
import { AdminSearchesTable } from "@/components/admin-searches-table";

export const metadata: Metadata = {
  title: "Admin — LEVR Auto Internal",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const agent = await requireAgent();
  const searches = await getAdminSearches();

  return (
    <section className="min-h-screen bg-zinc-950 py-16">
      <div className="mx-auto max-w-6xl px-6">
        <h1 className="text-2xl font-semibold text-white">Admin</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Signed in as {agent.name} ({agent.email})
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Every customer search. Pause/Resume here are manual overrides, separate from the Day-60
          extension flow — deadlines are untouched by either action.
        </p>

        <div className="mt-8">
          <AdminSearchesTable searches={searches} />
        </div>
      </div>
    </section>
  );
}
