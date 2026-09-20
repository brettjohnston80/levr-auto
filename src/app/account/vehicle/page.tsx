import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVehicleDetails } from "@/lib/customer-dashboard";
import { getFinalizeChoiceData } from "@/lib/finalize-choice-data";
import { FinalizeChoice } from "@/components/finalize-choice";
import { Section } from "@/components/trim-detail-modal";
import { GetStartedButton } from "@/components/get-started-button";

export const metadata: Metadata = {
  title: "Your Car — LEVR Auto",
};

export const dynamic = "force-dynamic";

// A superseded/withdrawn/admin-closed search describes nothing real to
// look at anymore -- deliberately NOT including "purchased" here, since
// that search's vehicle is exactly what a customer would want this tab to
// keep showing (their permanent record of what they bought).
const TERMINAL_STATUSES = ["switched", "cancelled", "closed"];

function ExcludedNames({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p className="mt-2 text-xs text-amber-300">
      <span className="font-semibold">Excluded:</span>{" "}
      <span className="text-amber-200/80">{names.join(", ")}</span>
    </p>
  );
}

export default async function VehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ searchId?: string }>;
}) {
  const { searchId: requestedSearchId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();

  // paid_at required here, not just a non-terminal status -- an unpaid
  // awaiting_finalization row (abandoned checkout) has nothing to show;
  // that state already has its own messaging on /account.
  const { data: candidateSearches } = await admin
    .from("customer_searches")
    .select("id, make, model, search_status")
    .eq("customer_id", user.id)
    .not("paid_at", "is", null)
    .order("created_at", { ascending: false });

  const nonTerminal = (candidateSearches ?? []).filter(
    (s) => !TERMINAL_STATUSES.includes(s.search_status as string),
  );

  // No bounce to /account -- this tab is meant to be a stable, revisitable
  // destination (that's the whole point of it existing separately from the
  // old one-time /finalize gate), so a customer with nothing active yet
  // sees that explained right here, once, rather than landing somewhere
  // else with a message tacked on.
  if (nonTerminal.length === 0) {
    return (
      <section className="bg-zinc-950 py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h1 className="text-2xl font-semibold text-white">No active search yet</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Once you start a search, this is where you&apos;ll come back to see your vehicle
            details.
          </p>
          <GetStartedButton className="mt-8 inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400">
            Get Started
          </GetStartedButton>
          <div className="mt-6">
            <Link href="/account" className="text-sm text-zinc-400 hover:text-white">
              ← Back to your account
            </Link>
          </div>
        </div>
      </section>
    );
  }

  let targetId: string | null = null;
  if (requestedSearchId && nonTerminal.some((s) => s.id === requestedSearchId)) {
    targetId = requestedSearchId;
  } else if (nonTerminal.length === 1) {
    targetId = nonTerminal[0].id as string;
  }

  // More than one candidate and none specified -- a real but rare case
  // (flat-fee/one-vehicle-at-a-time means this is normally exactly one).
  // A simple chooser rather than guessing which one the customer means.
  if (!targetId) {
    return (
      <section className="bg-zinc-950 py-24">
        <div className="mx-auto max-w-2xl px-6">
          <h1 className="text-2xl font-semibold text-white">Which search?</h1>
          <p className="mt-2 text-sm text-zinc-400">
            You have more than one active search right now.
          </p>
          <ul className="mt-6 space-y-2">
            {nonTerminal.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/account/vehicle?searchId=${s.id}`}
                  className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition-colors hover:border-white/25"
                >
                  {s.make} {s.model}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/account" className="mt-8 inline-block text-sm text-zinc-400 hover:text-white">
            ← Back to your account
          </Link>
        </div>
      </section>
    );
  }

  const { data: search } = await supabase
    .from("customer_searches")
    .select("id, make, model, model_year, trim, search_status, call_requested_at")
    .eq("id", targetId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (!search) {
    redirect("/account");
  }

  if (search.search_status === "awaiting_finalization") {
    const { trimOptions, configuratorQuestions, makeModelOptions, modelYearOptions, inventoryBlock } =
      await getFinalizeChoiceData(search);

    return (
      <section className="bg-zinc-950 py-24">
        <div className="mx-auto max-w-2xl px-6">
          <FinalizeChoice
            searchId={search.id}
            make={search.make}
            model={search.model}
            callAlreadyRequested={!!search.call_requested_at}
            trimOptions={trimOptions}
            configuratorQuestions={configuratorQuestions}
            makeModelOptions={makeModelOptions}
            modelYear={(search.model_year as number | null) ?? null}
            modelYearOptions={modelYearOptions}
            inventoryBlock={inventoryBlock}
          />
        </div>
      </section>
    );
  }

  // Finalized (or further along) -- full read-only spec view. Real prices/
  // package contents, the same ChoiceRow/Section rendering trim-detail-
  // modal.tsx already uses while ranking, fed the customer's own ranked
  // selections instead of a trim's full unfiltered option list.
  const details = await getVehicleDetails(search.id, user.id);
  if (!details) {
    redirect("/account");
  }

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-2xl px-6">
        <Link href="/account" className="text-sm text-zinc-400 hover:text-white">
          ← Back to your account
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-white">
          {details.make} {details.model}
          {details.trim ? <span className="text-zinc-400"> — {details.trim}</span> : null}
        </h1>

        {details.rankedTrims.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Trim — search order
            </p>
            <ol className="mt-2 space-y-1 text-sm text-zinc-300">
              {details.rankedTrims.map((t) => (
                <li key={`${t.trim}::${t.modelYear ?? ""}`}>
                  <span className="text-zinc-500">{t.rankPosition}.</span> {t.trim}
                  {t.modelYear != null ? ` ${t.modelYear}` : ""}
                </li>
              ))}
            </ol>
            {details.excludedTrims.length > 0 && (
              <ExcludedNames names={details.excludedTrims.map((t) => t.trim)} />
            )}
          </div>
        )}

        <div>
          <Section title="Exterior colors" choices={details.exteriorColor.ranked} />
          <ExcludedNames names={details.exteriorColor.excludedNames} />
          <Section title="Interior" choices={details.interior.ranked} />
          <ExcludedNames names={details.interior.excludedNames} />
          <Section title="Features" choices={details.feature.ranked} />
          <ExcludedNames names={details.feature.excludedNames} />
        </div>

        {details.rankedTrims.length === 0 &&
          details.exteriorColor.ranked.length === 0 &&
          details.interior.ranked.length === 0 &&
          details.feature.ranked.length === 0 && (
            <p className="mt-6 text-sm text-zinc-500">
              No specific preferences on file — any trim, color, or option is fine.
            </p>
          )}
      </div>
    </section>
  );
}
