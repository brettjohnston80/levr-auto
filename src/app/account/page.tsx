import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth-actions";
import { getCustomerDashboard, type DashboardSearch } from "@/lib/customer-dashboard";
import { FinalizeEditForm } from "@/components/finalize-edit-form";
import { AccountFaqSection } from "@/components/account-faq-section";
import { AccountSettingsForm } from "@/components/account-settings-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { SwitchChoice } from "@/components/switch-choice";
import { ExtendSearchButton } from "@/components/extend-search-button";
import { AutoRenewToggle } from "@/components/auto-renew-toggle";
import { AutoRenewOffLink } from "@/components/auto-renew-off-link";
import { CancellationChoice } from "@/components/cancellation-choice";
import { getPausedResumeInfo, getStatusCopy, getStatusBadge } from "@/lib/search-status-copy";
import { formatDate } from "@/lib/dashboard-format";
import {
  getIntakeMakeModelOptions,
  getIntakeModelYearOptions,
  type MakeModelOptions,
  type ModelYearOptions,
} from "@/lib/intake-vehicle-options";
import { effectiveDeadline, REMINDER_WINDOW_DAYS } from "@/lib/day60-extension";

export const metadata: Metadata = {
  title: "Your Account — LEVR Auto",
};

export const dynamic = "force-dynamic";

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

// Switching only makes sense for a search that's actually live and paid --
// not an abandoned/unpaid row (nothing to switch away from yet), not a
// still-undecided row (nothing to switch away from either -- no make/model
// exists yet, see the "not sure yet" intake path), and not one that's
// already switched, closed, cancelled, or purchased.
function canSwitch(search: DashboardSearch): boolean {
  return (
    search.paidAt !== null &&
    search.make !== null &&
    // NOT YET SOLIDIFIED MEANS THE CHANGE IS STILL FREE, so offering the
    // $100 switch here would be selling something the customer can have
    // for nothing -- they would have no way to tell the two apart, and the
    // paid box is the more prominent of the two. While solidified_at is
    // null the vehicle is corrected in place by updateSearchVehicle: on
    // /finalize via the choice screen, and on /account via the edit form's
    // own "Change make, model, or year" control, which is gated on exactly the
    // negation of this. An awaiting_finalization search shows no switch box
    // and no inline control here either -- its free route is the "Finalize
    // this search" link straight to /finalize.
    search.solidifiedAt !== null &&
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

// Full detail (every ranked color/interior/package, real prices/contents)
// now lives in exactly one place -- /account/vehicle, built off
// getVehicleDetails. This is the compact replacement for the inline
// SelectionSummary block this card used to render in full (2026-09-19):
// a one-line digest plus a link into that page, rather than a second copy
// of the same detail.
function buildCompactSelectionSummary(search: DashboardSearch): string {
  const parts: string[] = [`Trim: ${search.trim || "No preference"}`];

  const colorsRanked = search.configuratorSelections.filter(
    (s) => s.category === "exterior_color" && !s.excluded,
  ).length;
  if (colorsRanked > 0) {
    parts.push(`${colorsRanked} color${colorsRanked === 1 ? "" : "s"} ranked`);
  }

  const packageNames = new Set(
    search.configuratorSelections
      .filter((s) => !s.excluded && s.packageName)
      .map((s) => s.packageName as string),
  );
  if (packageNames.size > 0) {
    parts.push(`${packageNames.size} package${packageNames.size === 1 ? "" : "s"} selected`);
  }

  return parts.join(" · ");
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
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

  // Only fetched when a search is actually in its edit window -- this
  // paginates the whole live vehicle dataset, and /account is force-dynamic,
  // so every dashboard load would otherwise pay for it whether or not any
  // search can use it.
  // Years ride on the same cached scan as make/models, so needing both
  // still costs one read -- and still only when a search can use it.
  // Widened 2026-09-14: the switch form now offers real dataset dropdowns
  // too, so a switchable search needs the options just as an editable one
  // does. Still skipped entirely when no search can use them.
  const [makeModelOptions, modelYearOptions]: [MakeModelOptions, ModelYearOptions] =
    searches.some(
      (s) =>
        (s.searchStatus === "pending_refinement" && s.finalizedAt && s.make && s.model) ||
        canSwitch(s),
    )
      ? await Promise.all([getIntakeMakeModelOptions(), getIntakeModelYearOptions()])
      : [{}, {}];

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

        {message && (
          <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-zinc-300">
            {message}
          </p>
        )}

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

        <ChangePasswordForm />

        {searches.length === 0 ? (
          <p className="mt-10 text-center text-zinc-400">
            No searches yet. Head back to the homepage to get started.
          </p>
        ) : (
          <div className="mt-10 space-y-6">
            {searches.map((search) => (
              <SearchCard
                key={search.id}
                search={search}
                makeModelOptions={makeModelOptions}
                modelYearOptions={modelYearOptions}
              />
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

function SearchCard({
  search,
  makeModelOptions,
  modelYearOptions,
}: {
  search: DashboardSearch;
  makeModelOptions: MakeModelOptions;
  modelYearOptions: ModelYearOptions;
}) {
  const reminderBannerCopy = getReminderBannerCopy(search);
  const pausedInfo = search.searchStatus === "paused" ? getPausedResumeInfo(search.pausedAt) : null;
  // Matches deriveSearchTimeline's own gate (search-timeline.ts) -- there's
  // nothing to show under "Your Deal" until a search has actually started
  // (solidified) or is a permanent purchased record, so the teaser below
  // stays hidden until then rather than linking to an empty page.
  const hasDeal = search.solidifiedAt !== null || search.searchStatus === "purchased";

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
          make={search.make}
          model={search.model}
          makeModelOptions={makeModelOptions}
          modelYear={search.modelYear}
          modelYearOptions={modelYearOptions}
          solidifiedAt={search.solidifiedAt}
        />
      )}

      {/*
        Compact summary + link, not the full detail (2026-09-19). Every
        ranked color/interior/package, with real prices and contents, now
        lives in exactly one place -- /account/vehicle -- so it isn't
        duplicated (and can't drift) here. This one-line digest is just
        enough to tell the customer something was chosen and where to see
        the rest. Read-only on purpose, same as before.
      */}
      {search.searchStatus !== "pending_refinement" && search.configuratorSelections.length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <p className="text-sm text-zinc-300">{buildCompactSelectionSummary(search)}</p>
          <Link
            href={`/account/vehicle?searchId=${search.id}`}
            className="mt-1 inline-block text-sm text-emerald-400 underline hover:text-emerald-300"
          >
            View full details →
          </Link>
        </div>
      )}

      {canSwitch(search) && search.make && search.model && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <SwitchChoice
            searchId={search.id}
            make={search.make}
            model={search.model}
            switchCallAlreadyRequested={!!search.switchCallRequestedAt}
            makeModelOptions={makeModelOptions}
            modelYearOptions={modelYearOptions}
          />
        </div>
      )}

      {/*
        Compact teaser + link (2026-09-22) -- the status timeline, full
        offers list (photo cards, savings/best-value, accept/decline,
        add-ons, the post-acceptance panel), and the purchased-celebration
        flow all moved to /account/deal ("Your Deal"). Same convention as
        the vehicle-selection summary above: a one-line digest here, full
        detail on its own page, never duplicated so the two can't disagree
        on offer count/status.
      */}
      {hasDeal && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <Link
            href={`/account/deal?searchId=${search.id}`}
            className="text-sm text-emerald-400 underline hover:text-emerald-300"
          >
            {search.searchStatus === "purchased"
              ? "Purchased"
              : search.offers.length === 0
                ? "No offers yet"
                : `${search.offers.length} offer${search.offers.length === 1 ? "" : "s"}`}
            {" — view your deal →"}
          </Link>
        </div>
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
