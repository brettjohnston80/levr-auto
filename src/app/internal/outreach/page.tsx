import type { Metadata } from "next";
import { requireAgent } from "@/lib/agent-auth";
import { getOutreachQueue } from "@/lib/outreach-queue";
import { LogOfferForm } from "@/components/log-offer-form";
import { MarkSoldButton } from "@/components/mark-sold-button";
import { AddOfferAddonForm } from "@/components/add-offer-addon-form";
import { ResolveAddonRemovalForm } from "@/components/resolve-addon-removal-form";
import { ConfirmAvailabilityButton } from "@/components/confirm-availability-button";
import { ConfirmDepositForm } from "@/components/confirm-deposit-form";
import { CheckSigningStatusButton } from "@/components/check-signing-status-button";
import { AgentSwitchSearchForm } from "@/components/agent-switch-search-form";

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
                    <ul className="mt-2 space-y-3 text-sm text-zinc-400">
                      {search.offers.map((offer) => (
                        <li key={offer.id}>
                          {offer.dealerName} — ${(offer.offerPriceCents / 100).toLocaleString()}
                          {offer.isBelowMsrp ? " (below MSRP)" : " (at/above MSRP)"} — {offer.status}
                          {offer.vehicleSoldAt ? (
                            <span className="ml-2 text-amber-400">sold to another buyer</span>
                          ) : (
                            offer.isBelowMsrp && <MarkSoldButton offerId={offer.id} />
                          )}

                          {offer.addons.length > 0 && (
                            <ul className="mt-1 ml-4 space-y-1 border-l border-white/10 pl-3">
                              {offer.addons.map((addon) => (
                                <li key={addon.id}>
                                  <div>
                                    {addon.description} — ${(addon.amountCents / 100).toLocaleString()}
                                    {addon.removalStatus !== "none" && (
                                      <span className="ml-2 text-zinc-500">[{addon.removalStatus.replace(/_/g, " ")}]</span>
                                    )}
                                  </div>
                                  {addon.dealerResponse && (
                                    <p className="text-xs text-zinc-500">&ldquo;{addon.dealerResponse}&rdquo;</p>
                                  )}
                                  {addon.removalStatus === "pending" && (
                                    <ResolveAddonRemovalForm addonId={addon.id} />
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="ml-4">
                            <AddOfferAddonForm offerId={offer.id} />
                          </div>

                          {offer.status === "customer_accepted" && (
                            <div className="mt-3 ml-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
                              <p className="text-xs font-semibold text-emerald-400 uppercase">
                                Accepted — closing this deal
                              </p>

                              <div className="mt-2">
                                {offer.dealProgress?.availabilityReconfirmedAt ? (
                                  <span className="text-xs text-zinc-400">
                                    Availability confirmed{" "}
                                    {new Date(offer.dealProgress.availabilityReconfirmedAt).toLocaleDateString()}
                                  </span>
                                ) : (
                                  <ConfirmAvailabilityButton offerId={offer.id} />
                                )}
                              </div>

                              <div className="mt-2">
                                {offer.dealProgress?.depositConfirmedAt ? (
                                  <span className="text-xs text-zinc-400">
                                    Deposit confirmed: $
                                    {((offer.dealProgress.depositAmountCents ?? 0) / 100).toLocaleString()} on{" "}
                                    {new Date(offer.dealProgress.depositConfirmedAt).toLocaleDateString()}
                                  </span>
                                ) : (
                                  <ConfirmDepositForm offerId={offer.id} />
                                )}
                              </div>

                              <div className="mt-2 text-xs text-zinc-400">
                                {offer.dealProgress?.financingChoice === "own" ? (
                                  <>
                                    Bringing own financing
                                    {offer.dealProgress.financingProofUrl && (
                                      <>
                                        {" — "}
                                        <a
                                          href={offer.dealProgress.financingProofUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-emerald-400 underline"
                                        >
                                          view proof
                                        </a>
                                      </>
                                    )}
                                  </>
                                ) : offer.dealProgress?.financingChoice === "help" ? (
                                  <>
                                    Wants financing help — income {offer.dealProgress.financingIncomeRange ?? "?"},
                                    down payment $
                                    {offer.dealProgress.financingDownPaymentCents != null
                                      ? (offer.dealProgress.financingDownPaymentCents / 100).toLocaleString()
                                      : "?"}
                                    , term {offer.dealProgress.financingDesiredTermMonths ?? "?"} months
                                  </>
                                ) : (
                                  "Financing not yet submitted"
                                )}
                              </div>

                              <div className="mt-2 text-xs text-zinc-400">
                                {offer.serviceAgreementSignedAt ? (
                                  `Service agreement signed ${new Date(offer.serviceAgreementSignedAt).toLocaleDateString()}`
                                ) : (
                                  <>
                                    Service agreement not yet signed
                                    <CheckSigningStatusButton offerId={offer.id} />
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <LogOfferForm searchId={search.id} listings={search.listings} />
                <AgentSwitchSearchForm searchId={search.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
