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
  getInventoryBlockedQueue,
  combinationLabel,
  type OutreachCombinationPreference,
  type OutreachSelection,
  type OutreachTrimPreference,
} from "@/lib/outreach-queue";
import { ResolveNotificationCallbackButton } from "@/components/resolve-notification-callback-button";
import { LogOfferForm } from "@/components/log-offer-form";
import { MarkSoldButton } from "@/components/mark-sold-button";
import { MarkPurchasedButton } from "@/components/mark-purchased-button";
import { WithdrawAcceptedOfferButton } from "@/components/withdraw-accepted-offer-button";
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
import { getIntakeMakeModelOptions, getIntakeModelYearOptions } from "@/lib/intake-vehicle-options";
import { MODEL_YEAR_INVENTORY_BLOCK_ENABLED } from "@/lib/inventory-block";
import { AGENT_INVENTORY_BLOCK_DESCRIPTION, AGENT_INVENTORY_BLOCK_HEADING } from "@/lib/inventory-block-copy";

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

/**
 * Tester-program rows are FLAGGED, never hidden.
 *
 * Exclusion was the other option and it is the wrong one here: these queues
 * are how an agent resolves a finalization call, a switch request, a
 * cancellation call or a vehicle consultation. Hiding test rows would make
 * every agent-mediated flow untestable, which is most of what a tester
 * program is for -- the tester would request a call and nothing would ever
 * appear for anyone to action.
 *
 * The hazard exclusion would protect against is an agent doing real-world
 * work on a fake row -- phoning a dealer about a search nobody made. A loud
 * badge solves that better than invisibility does, because it leaves the
 * row workable while making it impossible to mistake for real. These pages
 * are agent-only; no customer ever sees this.
 */
function TestBadge({ isTest }: { isTest: boolean }) {
  if (!isTest) return null;
  return (
    <span className="ml-2 rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-300 uppercase">
      Test account
    </span>
  );
}

const SELECTION_CATEGORY_LABELS: Record<string, string> = {
  exterior_color: "Exterior color",
  interior: "Interior",
  seating: "Seating",
  wheels: "Wheels",
  roof: "Roof",
  drivetrain: "Drivetrain",
  feature: "Features",
};

/**
 * Package context and the unconfirmed-price state, shared by the ranked and
 * feature renderers below. Unchanged from the priority-era display: an
 * unconfirmed price is still said out loud rather than rendered blank or as
 * $0, because putting a number in an agent's mouth that nobody researched
 * is the failure this guards against.
 */
function PackageNote({ sel }: { sel: OutreachSelection }) {
  if (sel.packageName) {
    return (
      <p className="mt-0.5 text-xs text-zinc-500">
        Only in the <span className="text-zinc-400">{sel.packageName}</span>
        {" — "}
        {sel.priceUnknown || sel.packagePriceCents == null ? (
          <span className="text-amber-400">price not confirmed</span>
        ) : (
          <span className="text-zinc-400">${(sel.packagePriceCents / 100).toLocaleString()}</span>
        )}
        {sel.packageContents && sel.packageContents.length > 0 && (
          <> — includes {sel.packageContents.join(", ")}</>
        )}
      </p>
    );
  }
  if (sel.priceUnknown) {
    return <p className="mt-0.5 text-xs text-amber-400">price not confirmed</p>;
  }
  return null;
}

/**
 * The real conflict the ranked-trim-union redesign makes possible
 * (2026-09-16): an answer can now be valid without being buildable on the
 * customer's #1-ranked TRIM specifically -- it only has to be buildable on
 * SOME ranked trim. An agent working the #1 trim first (the normal case)
 * needs to know when THIS answer isn't actually one of them, or they'll
 * search for a combination that doesn't exist. Same amber tone as the
 * existing "price not confirmed" convention, computed from
 * `availableOnTrims` (written at save time, see that column's own
 * migration comment) against the #1 ranked trim's own label -- never
 * re-derived live, so this can't disagree with what the customer actually
 * saw on Review.
 */
function TopRankConflictNote({ sel, topTrimLabel }: { sel: OutreachSelection; topTrimLabel: string | null }) {
  if (!topTrimLabel || sel.excluded) return null;
  if (!sel.availableOnTrims || sel.availableOnTrims.length === 0) return null;
  if (sel.availableOnTrims.includes(topTrimLabel)) return null;
  return (
    <p className="mt-0.5 text-xs text-amber-400">
      ⚠ not available on {topTrimLabel} (top trim) — available on {sel.availableOnTrims.join(", ")}
    </p>
  );
}

/**
 * An explicit refusal. Deliberately loud and deliberately NOT just an
 * absence from the ranked list.
 *
 * "Excluded: black" is an INSTRUCTION -- an agent who offers it has done
 * the one thing the customer asked them not to. An option the customer
 * simply did not rank carries no such weight; it is merely unremarkable.
 * Rendering an exclusion by omission would flatten those two into the same
 * thing, so exclusions get their own block with their own marker.
 */
function ExcludedBlock({ items }: { items: { id: string; label: string }[] }) {
  if (items.length === 0) return null;
  return (
    <p className="mt-1 text-xs text-amber-300">
      <span className="font-semibold">✕ Excluded:</span>{" "}
      <span className="text-amber-200/80">{items.map((i) => i.label).join(", ")}</span>
    </p>
  );
}

/**
 * A customer's configurator answers, read-only.
 *
 * Ranked categories render as a numbered list in the customer's own order,
 * because the order IS the answer -- #1 is what to chase first, and an
 * agent scanning the card needs that without reading prose. Features are
 * one of these categories too (2026-09-18, features-become-ranked-packages)
 * -- the rankable ITEM is the package label (e.g. "Cold Weather Package"),
 * not an individual feature name, exactly like every other ranked
 * category, so the generic block below renders it with zero special-casing.
 * `questionKind` is retired for this purpose: every row is `'ranked'` now
 * (see `search_option_selections_question_kind_check`), so the old
 * `questionKind === "feature"` filter this replaced always matched zero
 * rows post-redesign -- category is what actually distinguishes a feature
 * row, same as it always has for every other category here.
 *
 * Renders nothing at all when there are no answers, which is the case for
 * every make without configurator data -- `Colors:` above stays the
 * authoritative line there, and this section simply does not appear rather
 * than showing an empty shell.
 */
function ConfiguratorSelections({
  selections,
  trimPreferences,
  combinationPreferences,
}: {
  selections: OutreachSelection[];
  trimPreferences: OutreachTrimPreference[];
  combinationPreferences: OutreachCombinationPreference[];
}) {
  if (selections.length === 0 && trimPreferences.length === 0) return null;

  const rankedCategories = ["exterior_color", "interior", "seating", "feature"];

  const trimLabel = (t: OutreachTrimPreference) =>
    t.modelYear != null ? `${t.trim} ${t.modelYear}` : t.trim;

  const rankedTrims = trimPreferences.filter((t) => !t.excluded);
  const excludedTrims = trimPreferences.filter((t) => t.excluded);
  const topTrim = rankedTrims.find((t) => t.rankPosition === 1);
  const topTrimLabel = topTrim ? trimLabel(topTrim) : null;

  const rankedCombinations = combinationPreferences.filter((c) => !c.excluded);
  const excludedCombinations = combinationPreferences.filter((c) => c.excluded);

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-zinc-300">Customer&apos;s build preferences</h3>

      {trimPreferences.length > 0 && (
        <div className="mt-2">
          {/* Labelled as a search ORDER, not a preference list: this is
              literally the sequence to work down when the top choice is not
              in inventory. */}
          <p className="text-xs font-semibold text-zinc-400 uppercase">Trim — search in this order</p>
          <ol className="mt-1 space-y-0.5 text-sm text-zinc-400">
            {rankedTrims.map((t) => (
              <li key={t.id}>
                <span className="text-zinc-500">{t.rankPosition}.</span>{" "}
                <span className="text-zinc-200">{trimLabel(t)}</span>
                {/* Whether the colour/feature answers below actually
                    describe this trim. Only the #1 trim drives those
                    questions, and only when it resolved to exactly one
                    researched build. */}
                {t.configuratorTrimId ? (
                  <span className="ml-2 text-xs text-emerald-400/80">researched build</span>
                ) : (
                  <span className="ml-2 text-xs text-zinc-600">inventory only</span>
                )}
              </li>
            ))}
          </ol>
          <ExcludedBlock items={excludedTrims.map((t) => ({ id: t.id, label: trimLabel(t) }))} />
        </div>
      )}

      {/* Combination preferences (2026-09-19, Phase 4) -- the customer's
          FINAL refinement once per-category rankings alone no longer pin
          down one exact car, so it renders above the per-category
          breakdown below it: an agent working this card top-to-bottom sees
          the most-refined, most-authoritative search order first, with the
          per-category detail available underneath for anything this list
          doesn't cover. Renders nothing at all -- not even this heading --
          when the customer left the step untouched, exactly like the trim
          block above and the per-category blocks below. */}
      {combinationPreferences.length > 0 && (
        <div className="mt-3">
          {/* Same "search order" framing as Trim above: work down this
              list until a real (trim, colour, interior, seating) tuple is
              actually in inventory. */}
          <p className="text-xs font-semibold text-zinc-400 uppercase">
            Real combinations — search in this order
          </p>
          <ol className="mt-1 space-y-1 text-sm text-zinc-400">
            {rankedCombinations.map((c) => (
              <li key={c.id}>
                <span className="text-zinc-500">{c.rankPosition}.</span>{" "}
                <span className="text-zinc-200">{combinationLabel(c)}</span>
              </li>
            ))}
          </ol>
          <ExcludedBlock
            items={excludedCombinations.map((c) => ({ id: c.id, label: combinationLabel(c) }))}
          />
        </div>
      )}

      {rankedCategories.map((category) => {
        const inCategory = selections.filter((s) => s.category === category);
        if (inCategory.length === 0) return null;
        const ranked = inCategory.filter((s) => !s.excluded);
        const excluded = inCategory.filter((s) => s.excluded);
        return (
          <div key={category} className="mt-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase">
              {SELECTION_CATEGORY_LABELS[category] ?? category}
            </p>
            <ol className="mt-1 space-y-1 text-sm text-zinc-400">
              {ranked.map((sel) => (
                <li key={sel.id}>
                  <span className="text-zinc-500">{sel.rankPosition}.</span>{" "}
                  <span className="text-zinc-200">{sel.selection}</span>
                  <PackageNote sel={sel} />
                  <TopRankConflictNote sel={sel} topTrimLabel={topTrimLabel} />
                </li>
              ))}
            </ol>
            <ExcludedBlock items={excluded.map((s) => ({ id: s.id, label: s.selection }))} />
          </div>
        );
      })}
    </div>
  );
}

const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
  offer_logged: "New offer logged",
  offer_response_recorded: "Offer response recorded",
  deal_progress_update: "Deal progress update",
  search_purchased: "Purchase confirmed",
};

export default async function OutreachQueuePage() {
  // Live make/model options for AgentUndecidedFinalizeForm, from the same
  // promoted vehicle dataset intake reads.
  // Years too (2026-09-14), for the switch and undecided-finalize forms --
  // same cached scan, one read.
  const [makeModelOptions, modelYearOptions] = await Promise.all([
    getIntakeMakeModelOptions(),
    getIntakeModelYearOptions(),
  ]);
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
    inventoryBlockedQueue,
  ] = await Promise.all([
    getOutreachQueue(),
    getFinalizationQueue(),
    getSwitchCallQueue(),
    getOverdueFollowUpQueue(),
    getPausedSearchesQueue(),
    getCancellationCallQueue(),
    getVehicleConsultationQueue(),
    getNotificationCallbackQueue(),
    getInventoryBlockedQueue(),
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
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}<TestBadge isTest={search.isTest} /></span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Paid {formatDate(search.paidAt)}</p>
                  <AgentUndecidedFinalizeForm
                    searchId={search.id}
                    makeModelOptions={makeModelOptions}
                    modelYearOptions={modelYearOptions}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zero-inventory block (Step 5). Not rendered at all while the
            switch is off, so the page is exactly as it was before Step 5. */}
        {MODEL_YEAR_INVENTORY_BLOCK_ENABLED && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-white">
              {AGENT_INVENTORY_BLOCK_HEADING} ({inventoryBlockedQueue.length})
            </h2>
            <p className="mt-1 text-sm text-zinc-400">{AGENT_INVENTORY_BLOCK_DESCRIPTION}</p>
            {inventoryBlockedQueue.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">No paid searches are blocked on inventory.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {inventoryBlockedQueue.map((search) => (
                  <div key={search.id} className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-base font-semibold text-white">
                        {search.modelYear ?? "Year not set"} {search.make} {search.model}
                      </h3>
                      <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}<TestBadge isTest={search.isTest} /></span>
                    </div>
                    <p className="mt-1 text-sm text-amber-300">
                      {search.block.kind === "year"
                        ? `No ${search.block.committedYear} listings synced — inventory exists for ${search.block.otherYears.join(" and ")}`
                        : "No listings synced for this model in any year"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Paid {formatDate(search.paidAt)}
                      {search.callRequestedAt ? ` · call requested ${formatDate(search.callRequestedAt)}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

        <div id="finalization-calls" className="mt-10">
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
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}<TestBadge isTest={search.isTest} /></span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Requested {formatDate(search.callRequestedAt)}
                  </p>
                  <AgentFinalizeSearchForm
                    searchId={search.id}
                    make={search.make}
                    model={search.model}
                    trimOptions={search.trimOptions}
                    modelYear={search.modelYear}
                    modelYearOptions={modelYearOptions}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div id="switch-calls" className="mt-10">
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
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}<TestBadge isTest={search.isTest} /></span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Requested {formatDate(search.switchCallRequestedAt)}
                  </p>
                  <AgentSwitchSearchForm
                    searchId={search.id}
                    makeModelOptions={makeModelOptions}
                    modelYearOptions={modelYearOptions}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div id="cancellation-calls" className="mt-10">
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
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}<TestBadge isTest={search.isTest} /></span>
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
                    <span className="text-sm text-zinc-400">{item.customerEmail ?? "unknown customer"}<TestBadge isTest={item.isTest} /></span>
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
                    <span className="text-sm text-zinc-400">{item.customerEmail ?? "unknown customer"}<TestBadge isTest={item.isTest} /></span>
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
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}<TestBadge isTest={search.isTest} /></span>
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
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}<TestBadge isTest={search.isTest} /></span>
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
                    <span className="text-sm text-zinc-400">{search.customerEmail ?? "unknown customer"}<TestBadge isTest={search.isTest} /></span>
                  </div>
                  {search.colors.length > 0 && (
                    <p className="mt-1 text-sm text-zinc-500">Colors: {search.colors.join(", ")}</p>
                  )}
                  {search.zip && <p className="text-sm text-zinc-500">Zip: {search.zip}</p>}

                  {/* Sits above the dealer list on purpose: it describes
                      WHAT to look for, which an agent needs before working
                      through who might have it. */}
                  <ConfiguratorSelections
                    selections={search.selections}
                    trimPreferences={search.trimPreferences}
                    combinationPreferences={search.combinationPreferences}
                  />

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
                            {offer.status === "withdrawn" && offer.withdrawnAt && (
                              <p className="ml-4 text-xs text-amber-400">
                                Released {new Date(offer.withdrawnAt).toLocaleDateString()}
                                {offer.withdrawnByAgentName ? ` by ${offer.withdrawnByAgentName}` : ""}
                                {offer.withdrawalReason ? ` — ${offer.withdrawalReason}` : ""}
                              </p>
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

                                <div className="mt-2 text-xs text-zinc-400">
                                  Deal fell through? <WithdrawAcceptedOfferButton offerId={offer.id} />
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <LogOfferForm searchId={search.id} listings={search.listings} />
                  <AgentSwitchSearchForm
                    searchId={search.id}
                    makeModelOptions={makeModelOptions}
                    modelYearOptions={modelYearOptions}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
