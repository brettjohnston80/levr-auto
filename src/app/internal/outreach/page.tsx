import type { Metadata } from "next";
import { requireAgent } from "@/lib/agent-auth";
import {
  getOutreachQueue,
  getFinalizationQueue,
  getSwitchCallQueue,
  getOverdueFollowUpQueue,
  getPausedSearchesQueue,
  getCancellationCallQueue,
  getVehicleConsultationQueue,
  getNotificationCallbackQueue,
} from "@/lib/outreach-queue";
import { ResolveNotificationCallbackButton } from "@/components/resolve-notification-callback-button";
import { LogOfferForm } from "@/components/log-offer-form";
import { MarkSoldButton } from "@/components/mark-sold-button";
import { MarkPurchasedButton } from "@/components/mark-purchased-button";
import { AddOfferAddonForm } from "@/components/add-offer-addon-form";
import { ResolveAddonRemovalForm } from "@/components/resolve-addon-removal-form";
import { ConfirmAvailabilityButton } from "@/components/confirm-availability-button";
import { ConfirmDepositForm } from "@/components/confirm-deposit-form";
import { CheckSigningStatusButton } from "@/components/check-signing-status-button";
import { AgentSwitchSearchForm } from "@/components/agent-switch-search-form";
import { AgentFinalizeSearchForm } from "@/components/agent-finalize-search-form";
import { AgentBypassLookup } from "@/components/agent-bypass-lookup";
import { AgentCancellationResolutionForm } from "@/components/agent-cancellation-resolution-form";
import { AgentCancellationLookup } from "@/components/agent-cancellation-lookup";
import { AgentRevertPurchasedLookup } from "@/components/agent-revert-purchased-lookup";
import { AgentUndecidedFinalizeForm } from "@/components/agent-undecided-finalize-form";

export const metadata: Metadata = {
  title: "Outreach Queue — LEVR Auto Internal",
};

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHoursOverdue(paidAt: string): string {
  const hoursSincePaid = Math.floor((Date.now() - new Date(paidAt).getTime()) / (60 * 60 * 1000));
  const hoursOverdue = hoursSincePaid - 48;
  return `${hoursOverdue}h overdue (paid ${formatDate(paidAt)})`;
}

function formatDaysRemaining(daysRemaining: number, pausedAt: string): string {
  if (daysRemaining < 0) {
    return `${Math.abs(daysRemaining)}d overdue (paused ${formatDate(pausedAt)})`;
  }
  return `${daysRemaining}d left to resume (paused ${formatDate(pausedAt)})`;
}

const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
  offer_logged: "New offer logged",
  offer_response_recorded: "Offer response recorded",
  deal_progress_update: "Deal progress update",
  search_purchased: "Purchase confirmed",
};

export default async function OutreachQueuePage() {
  const agent = await requireAgent();
  const [
    queue,
    finalizationQueue,
    switchCallQueue,
    overdueFollowUpQueue,
    pausedSearchesQueue,
    cancellationCallQueue,
    vehicleConsultationQueue,
    notificationCallbackQueue,
  ] = await Promise.all([
    getOutreachQueue(),
    getFinalizationQueue(),
    getSwitchCallQueue(),
    getOverdueFollowUpQueue(),
    getPausedSearchesQueue(),
    getCancellationCallQueue(),
    getVehicleConsultationQueue(),
    getNotificationCallbackQueue(),
  ]);

  const callbackRequests = notificationCallbackQueue.filter((e) => e.reason === "callback_requested");
  const undeliverableFlags = notificationCallbackQueue.filter((e) => e.reason === "no_deliverable_channel");

  return (
    <section className="min-h-screen bg-zinc-950 py-16">
      <div className="mx-auto max-w-5xl px-6">
        <h1 className="text-2xl font-semibold text-white">Outreach Queue</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Signed in as {agent.name} ({agent.email})
        </p>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">
            Vehicle consultation needed ({vehicleConsultationQueue.length})
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            These customers paid without picking a make/model yet — nothing else can happen for them
            until this call takes place.
          </p>
          {vehicleConsultationQueue.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No customers waiting on a vehicle consultation.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {vehicleConsultationQueue.map((search) => (
                <div key={search.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-white">Vehicle not yet chosen</h3>
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Paid {formatDate(search.paidAt)}</p>
                  <AgentUndecidedFinalizeForm searchId={search.id} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">Grant extension bypass</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Case-by-case only — waives the $100 extension fee without Stripe, works on any search regardless of
            status. Logged, never referenced in customer-facing text.
          </p>
          <div className="mt-4">
            <AgentBypassLookup />
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">Resolve a cancellation</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Look up a customer to cancel a search and issue a refund (full, partial, or none) against
            any of their payments — not just for calls already in the queue below.
          </p>
          <div className="mt-4">
            <AgentCancellationLookup />
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">Revert a purchased search</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Puts a search back to searching if a deal marked purchased falls through. Deposit/availability
            confirmations already on file are kept, not cleared. Logged, reason required.
          </p>
          <div className="mt-4">
            <AgentRevertPurchasedLookup />
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">
            Finalization calls requested ({finalizationQueue.length})
          </h2>
          {finalizationQueue.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No customers waiting on a finalization call.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {finalizationQueue.map((search) => (
                <div key={search.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-white">
                      {search.make} {search.model}
                    </h3>
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Requested {formatDate(search.callRequestedAt)}
                  </p>
                  <AgentFinalizeSearchForm
                    searchId={search.id}
                    make={search.make}
                    model={search.model}
                    trimOptions={search.trimOptions}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">
            Switch calls requested ({switchCallQueue.length})
          </h2>
          {switchCallQueue.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No customers waiting on a switch call.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {switchCallQueue.map((search) => (
                <div key={search.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-white">
                      {search.make} {search.model}
                    </h3>
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Requested {formatDate(search.switchCallRequestedAt)}
                  </p>
                  <AgentSwitchSearchForm searchId={search.id} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">
            Cancellation calls requested ({cancellationCallQueue.length})
          </h2>
          {cancellationCallQueue.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No customers waiting on a cancellation call.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {cancellationCallQueue.map((search) => (
                <div key={search.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-white">
                      {search.make} {search.model}
                    </h3>
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Requested {formatDate(search.cancellationCallRequestedAt)}
                  </p>
                  <AgentCancellationResolutionForm searchId={search.id} customerId={search.customerId} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">
            Customer callbacks requested ({callbackRequests.length})
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            This customer has &ldquo;a personal agent calls me&rdquo; enabled for account notifications.
          </p>
          {callbackRequests.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No customer callbacks requested.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {callbackRequests.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-white">
                      {NOTIFICATION_EVENT_LABELS[item.eventType] ?? item.eventType}
                      {item.make && item.model ? ` — ${item.make} ${item.model}` : ""}
                    </h3>
                    <span className="text-sm text-zinc-400">{item.customerEmail ?? "unknown customer"}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(item.createdAt)}</p>
                  <ResolveNotificationCallbackButton eventId={item.id} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">
            Notification undeliverable ({undeliverableFlags.length})
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            This customer has only &ldquo;text message&rdquo; enabled for account notifications — there&apos;s no
            SMS provider yet, so nothing actually reached them. Not a callback request; worth a proactive
            check-in.
          </p>
          {undeliverableFlags.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No undeliverable notifications.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {undeliverableFlags.map((item) => (
                <div key={item.id} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-white">
                      {NOTIFICATION_EVENT_LABELS[item.eventType] ?? item.eventType}
                      {item.make && item.model ? ` — ${item.make} ${item.model}` : ""}
                    </h3>
                    <span className="text-sm text-zinc-400">{item.customerEmail ?? "unknown customer"}</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-400">{formatDate(item.createdAt)}</p>
                  <ResolveNotificationCallbackButton eventId={item.id} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">
            Overdue follow-ups ({overdueFollowUpQueue.length})
          </h2>
          {overdueFollowUpQueue.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No paid searches are overdue for follow-up.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {overdueFollowUpQueue.map((search) => (
                <div key={search.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-white">
                      {search.make} {search.model}
                    </h3>
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-400">{formatHoursOverdue(search.paidAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white">
            Paused searches ({pausedSearchesQueue.length})
          </h2>
          {pausedSearchesQueue.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No searches are currently paused.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {pausedSearchesQueue.map((search) => (
                <div key={search.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-white">
                      {search.make} {search.model}
                    </h3>
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-400">
                    {formatDaysRemaining(search.daysRemaining, search.pausedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white">Active searches ({queue.length})</h2>

          {queue.length === 0 ? (
            <p className="mt-3 text-zinc-400">No active searches need outreach right now.</p>
          ) : (
            <div className="mt-4 space-y-8">
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
                                  {offer.dealProgress?.deliveryMethod === "pickup"
                                    ? "Pickup"
                                    : offer.dealProgress?.deliveryMethod === "delivery"
                                    ? "Delivery"
                                    : "Delivery preference not yet selected"}
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

                                <div className="mt-2 text-xs text-zinc-400">
                                  Deal closed? <MarkPurchasedButton searchId={search.id} offerId={offer.id} />
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
      </div>
    </section>
  );
}
