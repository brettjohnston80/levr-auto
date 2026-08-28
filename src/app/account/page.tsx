import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth-actions";
import { getCustomerDashboard, type DashboardSearch } from "@/lib/customer-dashboard";
import { OfferResponseButtons } from "@/components/offer-response-buttons";
import { AddonRemovalButton } from "@/components/addon-removal-button";
import { FinancingCaptureForm } from "@/components/financing-capture-form";
import { DeliveryPreferenceForm } from "@/components/delivery-preference-form";
import { ServiceAgreementSigning } from "@/components/service-agreement-signing";
import { FinalizeEditForm } from "@/components/finalize-edit-form";
import { AccountFaqSection } from "@/components/account-faq-section";
import { AccountSettingsForm } from "@/components/account-settings-form";
import { SwitchChoice } from "@/components/switch-choice";
import { ExtendSearchButton } from "@/components/extend-search-button";
import { AutoRenewToggle } from "@/components/auto-renew-toggle";
import { AutoRenewOffLink } from "@/components/auto-renew-off-link";
import { CancellationChoice } from "@/components/cancellation-choice";
import { PurchasedCelebration } from "@/components/purchased-celebration";
import { PostDealSurveyPrompt } from "@/components/post-deal-survey-prompt";
import { RESUME_WINDOW_DAYS } from "@/lib/vehicle-data";
import { effectiveDeadline, REMINDER_WINDOW_DAYS } from "@/lib/day60-extension";

export const metadata: Metadata = {
  title: "Your Account — LEVR Auto",
};

export const dynamic = "force-dynamic";

// awaiting_finalization has two very different real meanings depending on
// paid_at: "just paid, ready to finalize" (the common case) vs. "checkout
// was started but abandoned/never completed" (paid_at still null -- intake
// creates this row before the customer ever reaches Stripe). The unpaid
// case used SEARCH_STATUS_COPY's normal "Payment received..." text before
// this fix, which was wrong, plus a live "Finalize this search" link that
// dead-ended at /finalize's own paid_at guard. See getStatusCopy below,
// which branches on paidAt before falling back to this table.
const SEARCH_STATUS_COPY: Record<string, string> = {
  awaiting_finalization: "Payment received — finalize trim, color, and options to start your search.",
  pending_refinement:
    "Finalized — you're in the 24-hour window to change trim, color, or options before dealer outreach begins.",
  searching: "Actively searching — we'll show new offers here as they come in.",
  // Defensive fallback only -- a real paused row always has paused_at set
  // (day60-extension.ts's pauseOverdueSearches sets both together), so
  // getStatusCopy branches to getPausedStatusCopy's countdown/expired copy
  // before this is ever actually shown.
  paused: "Search paused.",
  closed: "Search closed.",
  switched: "Superseded by a newer search.",
  cancelled: "This search was cancelled. To search again, start a new $699 search from the homepage.",
  // Defensive fallback only -- SearchCard renders PurchasedCelebration
  // instead of this text for a purchased search, never falls through here.
  purchased: "This search is complete — you purchased your vehicle.",
};

const UNPAID_AWAITING_FINALIZATION_COPY =
  "Checkout wasn't completed — this search hasn't been paid for, so it hasn't started.";

const PAUSED_EXPIRED_COPY = "This search has ended. To continue, you'll need to start a new search.";

// Locked copy from the finalized Day-60 paused-state policy (CLAUDE.md,
// 2026-08-15) -- deliberately no hint of the hidden agent bypass (Pass 3)
// anywhere in either branch, expired or not. withinWindow gates whether
// ExtendSearchButton renders -- matches createExtensionCheckoutSession's
// own eligibility gate (RESUME_WINDOW_DAYS after paused_at), so the button
// never appears somewhere the RPC would just reject it.
function getPausedResumeInfo(pausedAt: string | null): { copy: string; withinWindow: boolean } {
  if (!pausedAt) {
    return { copy: SEARCH_STATUS_COPY.paused, withinWindow: false };
  }

  const resumeWindowEnds = new Date(pausedAt);
  resumeWindowEnds.setUTCDate(resumeWindowEnds.getUTCDate() + RESUME_WINDOW_DAYS);
  const msRemaining = resumeWindowEnds.getTime() - Date.now();

  if (msRemaining <= 0) {
    return { copy: PAUSED_EXPIRED_COPY, withinWindow: false };
  }

  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  return {
    copy: `Your search is paused. You have ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left to resume it by extending — after that, you'll need to start a new search.`,
    withinWindow: true,
  };
}

const UNDECIDED_PAID_COPY =
  "We're finding the right vehicle for you — your agent will reach out soon to talk through what you're looking for.";

function getStatusCopy(search: DashboardSearch): string {
  if (search.paidAt && !search.make) {
    return UNDECIDED_PAID_COPY;
  }
  if (search.searchStatus === "awaiting_finalization" && !search.paidAt) {
    return UNPAID_AWAITING_FINALIZATION_COPY;
  }
  if (search.searchStatus === "paused") {
    return getPausedResumeInfo(search.pausedAt).copy;
  }
  return SEARCH_STATUS_COPY[search.searchStatus] ?? "";
}

// Reminder banner -- locked copy from CLAUDE.md (2026-08-15), never actually
// built until now (confirmed via grep before this pass: no prior
// implementation existed). Shown only within REMINDER_WINDOW_DAYS of a
// still-searching row's deadline -- matches the "banner-only" extend scope
// recommendation, not a general "extend anytime" action on every search.
function getReminderBannerCopy(search: DashboardSearch): string | null {
  if (search.searchStatus !== "searching" || !search.solidifiedAt) {
    return null;
  }

  const deadline = effectiveDeadline({
    solidified_at: search.solidifiedAt,
    search_deadline_at: search.searchDeadlineAt,
  });
  const msRemaining = deadline.getTime() - Date.now();
  const windowMs = REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  if (msRemaining <= 0 || msRemaining > windowMs) {
    return null;
  }

  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

  // auto_renew_enabled branches this banner's copy entirely (spec,
  // 2026-08-17), same window/trigger as the email above -- the customer
  // doesn't need to be asked to act, just told the charge is coming and
  // where to turn it off.
  if (search.autoRenewEnabled) {
    return `Auto-renew is on — your card will be charged $100 in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} to keep this search active.`;
  }

  return `Your search pauses in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} unless extended. Extend now to keep us actively searching for 30 more days.`;
}

// The raw search_status badge (below) says "awaiting finalization" even when
// paid_at is null, which visually contradicts getStatusCopy's accurate body
// text for that same unpaid case ("hasn't been paid for, so it hasn't
// started"). This branches the badge the same way.
function getStatusBadge(search: DashboardSearch): string {
  if (search.searchStatus === "awaiting_finalization" && !search.paidAt) {
    return "checkout incomplete";
  }
  return search.searchStatus.replace(/_/g, " ");
}

// Switching only makes sense for a search that's actually live and paid --
// not an abandoned/unpaid row (nothing to switch away from yet), not a
// still-undecided row (nothing to switch away from either -- no make/model
// exists yet, see the "not sure yet" intake path), and not one that's
// already switched, closed, cancelled, or purchased.
function canSwitch(search: DashboardSearch): boolean {
  return (
    search.paidAt !== null &&
    search.make !== null &&
    !["switched", "closed", "cancelled", "purchased"].includes(search.searchStatus)
  );
}

// Cancellable at any of these active/pending stages, per Brett's confirmed
// policy (2026-08-17) -- deliberately not gated on how far along the search
// is (e.g. an accepted offer with deposit/financing/e-sign in motion is
// still cancellable). Same allow-list this codebase already prefers over a
// block-list for defensive reasons (see getOverdueFollowUpQueue's comment)
// -- fails closed if a new status is ever added without this being revisited.
// 'purchased' added 2026-08-21 -- a customer whose deal was marked
// purchased and then fell through needs the same final cancellation flow,
// not a new one; see cancel_search's matching status-guard extension.
function canCancel(search: DashboardSearch): boolean {
  return (
    search.paidAt !== null &&
    ["awaiting_finalization", "pending_refinement", "searching", "paused", "purchased"].includes(
      search.searchStatus
    )
  );
}

const ADDON_REMOVAL_STATUS_COPY: Record<string, string> = {
  pending: "Removal requested — waiting on the dealer",
  dealer_accepted: "Dealer agreed to remove this",
  dealer_declined: "Dealer declined to remove this",
  dealer_countered: "Dealer countered",
};

const ADDON_REREQUESTABLE_STATUSES = ["none", "dealer_declined", "dealer_countered"];

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, email, first_name, last_name, phone, notify_by_email, notify_by_text, notify_by_agent_callback, communication_frequency"
    )
    .eq("id", user.id)
    .single();

  const searches = await getCustomerDashboard(user.id);

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-2xl px-6">
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-zinc-950">
            ✓
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">Your Dashboard</h1>
          <p className="mt-3 text-zinc-400">
            {[customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || user.email}
          </p>
        </div>

        <AccountSettingsForm
          existing={{
            firstName: customer?.first_name ?? null,
            lastName: customer?.last_name ?? null,
            phone: customer?.phone ?? null,
            notifyByEmail: customer?.notify_by_email ?? true,
            notifyByText: customer?.notify_by_text ?? false,
            notifyByAgentCallback: customer?.notify_by_agent_callback ?? false,
            communicationFrequency: customer?.communication_frequency ?? "real_time",
          }}
        />

        {searches.length === 0 ? (
          <p className="mt-10 text-center text-zinc-400">
            No searches yet. Head back to the homepage to get started.
          </p>
        ) : (
          <div className="mt-10 space-y-6">
            {searches.map((search) => (
              <SearchCard key={search.id} search={search} />
            ))}
          </div>
        )}

        <AccountFaqSection customerEmail={customer?.email ?? user.email ?? ""} />

        <form action={logout} className="mt-10 text-center">
          <button
            type="submit"
            className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Log Out
          </button>
        </form>
      </div>
    </section>
  );
}

function SearchCard({ search }: { search: DashboardSearch }) {
  const reminderBannerCopy = getReminderBannerCopy(search);
  const pausedInfo = search.searchStatus === "paused" ? getPausedResumeInfo(search.pausedAt) : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">
          {search.make && search.model
            ? `${search.make} ${search.model}${search.trim ? ` — ${search.trim}` : ""}`
            : "Finding your vehicle"}
        </h2>
        <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
          {getStatusBadge(search)}
        </span>
      </div>
      {search.colors.length > 0 && (
        <p className="mt-1 text-sm text-zinc-500">Colors: {search.colors.join(", ")}</p>
      )}

      {search.searchStatus === "purchased" && search.make && search.model ? (
        <>
          <PurchasedCelebration make={search.make} model={search.model} trim={search.trim} />
          {search.survey && <PostDealSurveyPrompt survey={search.survey} />}
        </>
      ) : (
        <>
      <p className="mt-3 text-sm text-zinc-400">{getStatusCopy(search)}</p>

      {reminderBannerCopy && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-300">{reminderBannerCopy}</p>
          {search.autoRenewEnabled ? (
            <AutoRenewOffLink searchId={search.id} />
          ) : (
            <ExtendSearchButton searchId={search.id} showAutoRenewOption />
          )}
        </div>
      )}

      {pausedInfo?.withinWindow && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <ExtendSearchButton searchId={search.id} showAutoRenewOption={!search.autoRenewEnabled} />
        </div>
      )}

      {search.autoRenewEnabled && ["searching", "paused"].includes(search.searchStatus) && (
        <AutoRenewToggle searchId={search.id} />
      )}

      {search.searchStatus === "awaiting_finalization" && !search.paidAt && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <Link href="/" className="text-sm text-emerald-400 underline hover:text-emerald-300">
            Head back to the homepage to try again
          </Link>
        </div>
      )}

      {search.searchStatus === "awaiting_finalization" && search.paidAt && search.make && (
        <div className="mt-4 border-t border-white/5 pt-4">
          {search.callRequestedAt ? (
            <p className="text-sm text-zinc-400">
              You asked to schedule a call on {formatDate(search.callRequestedAt)} — an agent will
              reach out to finalize the details.
            </p>
          ) : (
            <Link
              href={`/finalize/${search.id}`}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              Finalize this search
            </Link>
          )}
        </div>
      )}

      {search.searchStatus === "pending_refinement" && search.finalizedAt && (
        <FinalizeEditForm
          searchId={search.id}
          finalizedAt={search.finalizedAt}
          initialTrim={search.trim}
          initialColors={search.colors}
          initialRequiredOptions={search.requiredOptions}
        />
      )}

      {canSwitch(search) && search.make && search.model && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <SwitchChoice
            searchId={search.id}
            make={search.make}
            model={search.model}
            switchCallAlreadyRequested={!!search.switchCallRequestedAt}
          />
        </div>
      )}

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-zinc-300">
          {search.offers.length > 0 ? `Offers (${search.offers.length})` : "No offers yet"}
        </h3>
        {search.offers.length > 0 && (
          <ul className="mt-3 space-y-3">
            {search.offers.map((offer) => (
              <li key={offer.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-white">{offer.dealerName}</span>
                  {offer.isBelowMsrp && (
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                      Below Total SRP
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  Offer: <span className="text-white">{formatCents(offer.offerPriceCents)}</span> — Total
                  Suggested Retail Price: {formatCents(offer.msrpCents)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Delivered {formatDate(offer.deliveredAt)} — status: {offer.status.replace(/_/g, " ")}
                  {offer.customerRespondedAt && ` on ${formatDate(offer.customerRespondedAt)}`}
                </p>
                {offer.offerSheetUrl && (
                  <a
                    href={offer.offerSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-emerald-400 underline hover:text-emerald-300"
                  >
                    View offer sheet (PDF)
                  </a>
                )}
                {offer.status === "pending" && <OfferResponseButtons offerId={offer.id} />}

                {offer.addons.length > 0 && (
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <p className="text-xs font-semibold text-zinc-400 uppercase">Add-ons</p>
                    <ul className="mt-2 space-y-2">
                      {offer.addons.map((addon) => (
                        <li key={addon.id} className="text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-zinc-300">
                              {addon.description} — {formatCents(addon.amountCents)}
                            </span>
                            {ADDON_REREQUESTABLE_STATUSES.includes(addon.removalStatus) ? (
                              <AddonRemovalButton addonId={addon.id} />
                            ) : (
                              <span className="text-xs text-zinc-500">
                                {ADDON_REMOVAL_STATUS_COPY[addon.removalStatus] ?? addon.removalStatus}
                              </span>
                            )}
                          </div>
                          {addon.dealerResponse && (
                            <p className="mt-1 text-xs text-zinc-500">&ldquo;{addon.dealerResponse}&rdquo;</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {offer.status === "customer_accepted" && (
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <p className="text-xs font-semibold text-emerald-400 uppercase">
                      Congratulations — next steps
                    </p>

                    <p className="mt-2 text-xs text-zinc-400">
                      {offer.dealProgress?.availabilityReconfirmedAt
                        ? `Dealer confirmed availability on ${formatDate(offer.dealProgress.availabilityReconfirmedAt)}.`
                        : "Waiting on the dealer to reconfirm the vehicle is still available."}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {offer.dealProgress?.depositConfirmedAt
                        ? `Deposit confirmed: ${formatCents(offer.dealProgress.depositAmountCents ?? 0)} on ${formatDate(offer.dealProgress.depositConfirmedAt)}.`
                        : "A refundable deposit is paid directly to the dealer to reserve the car — we'll show it here once the dealer confirms they've received it."}
                    </p>

                    <FinancingCaptureForm offerId={offer.id} existing={offer.dealProgress} />

                    <DeliveryPreferenceForm offerId={offer.id} existing={offer.dealProgress} />

                    <ServiceAgreementSigning
                      offerId={offer.id}
                      initiallySigned={!!offer.serviceAgreementSignedAt}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
        </>
      )}

      {canCancel(search) && (
        <CancellationChoice
          searchId={search.id}
          cancellationCallAlreadyRequested={!!search.cancellationCallRequestedAt}
        />
      )}
    </div>
  );
}
