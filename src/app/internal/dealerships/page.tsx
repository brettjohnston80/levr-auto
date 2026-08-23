import type { Metadata } from "next";
import { requireAgent } from "@/lib/agent-auth";
import { getUnconfirmedAliases, getConfirmedDealerships } from "@/lib/dealership-queue";
import { UnconfirmedAliasQueue } from "@/components/unconfirmed-alias-queue";
import { DealershipsList } from "@/components/dealerships-list";

export const metadata: Metadata = {
  title: "Dealerships — LEVR Auto Internal",
};

export const dynamic = "force-dynamic";

export default async function DealershipsPage() {
  const agent = await requireAgent();
  const [unconfirmed, dealerships] = await Promise.all([getUnconfirmedAliases(), getConfirmedDealerships()]);

  return (
    <section className="min-h-screen bg-zinc-950 py-16">
      <div className="mx-auto max-w-6xl px-6">
        <h1 className="text-2xl font-semibold text-white">Dealerships</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Signed in as {agent.name} ({agent.email})
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Confirm real dealer identities as they show up in synced inventory, then manage each
          dealership&rsquo;s salesperson roster.
        </p>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">
            Unconfirmed dealer identities <span className="text-sm font-normal text-zinc-500">({unconfirmed.length})</span>
          </h2>
          <div className="mt-4">
            <UnconfirmedAliasQueue aliases={unconfirmed} />
          </div>
        </div>

        <div className="mt-14">
          <h2 className="text-lg font-semibold text-white">
            Dealerships <span className="text-sm font-normal text-zinc-500">({dealerships.length})</span>
          </h2>
          <div className="mt-4">
            <DealershipsList dealerships={dealerships} />
          </div>
        </div>
      </div>
    </section>
  );
}
