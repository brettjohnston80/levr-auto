import type { Metadata } from "next";
import { requireAgent } from "@/lib/agent-auth";
import { getOutreachQueue } from "@/lib/outreach-queue";
import { LogOfferForm } from "@/components/log-offer-form";

export const metadata: Metadata = {
  title: "Outreach Queue — LEVR Auto Internal",
};

export const dynamic = "force-dynamic";

export default async function OutreachQueuePage() {
  const agent = await requireAgent();
  const queue = await getOutreachQueue();

  return (
    <section className="min-h-screen bg-zinc-950 py-16">
      <div className="mx-auto max-w-5xl px-6">
        <h1 className="text-2xl font-semibold text-white">Outreach Queue</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Signed in as {agent.name} ({agent.email})
        </p>

        {queue.length === 0 ? (
          <p className="mt-10 text-zinc-400">No active searches need outreach right now.</p>
        ) : (
          <div className="mt-8 space-y-8">
            {queue.map((search) => (
              <div key={search.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-white">
                    {search.make} {search.model}
                    {search.trim ? ` — ${search.trim}` : ""}
                  </h2>
                  <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}</span>
                </div>
                {search.colors.length > 0 && (
                  <p className="mt-1 text-sm text-zinc-500">Colors: {search.colors.join(", ")}</p>
                )}
                {search.zip && <p className="text-sm text-zinc-500">Zip: {search.zip}</p>}

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-zinc-300">
                    Matching dealers ({search.dealers.length})
                  </h3>
                  {search.dealers.length === 0 ? (
                    <p className="mt-1 text-sm text-zinc-500">No listings synced yet for this make/model.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                      {search.dealers.map((dealer) => (
                        <li key={dealer.name}>
                          {dealer.name} — {dealer.phone ?? "no phone"} — {dealer.city ?? "?"}, {dealer.state ?? "?"} (
                          {dealer.listingCount} listing{dealer.listingCount === 1 ? "" : "s"})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {search.offers.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-zinc-300">Offers logged ({search.offers.length})</h3>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                      {search.offers.map((offer) => (
                        <li key={offer.id}>
                          {offer.dealerName} — ${(offer.offerPriceCents / 100).toLocaleString()}
                          {offer.isBelowMsrp ? " (below MSRP)" : " (at/above MSRP)"} — {offer.status}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <LogOfferForm searchId={search.id} listings={search.listings} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
