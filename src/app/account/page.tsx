import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth-actions";
import { getCustomerDashboard, type DashboardSearch } from "@/lib/customer-dashboard";
import { OfferResponseButtons } from "@/components/offer-response-buttons";
import { SwitchSearchForm } from "@/components/switch-search-form";
import { AddonRemovalButton } from "@/components/addon-removal-button";

export const metadata: Metadata = {
  title: "Your Account — LEVR Auto",
};

export const dynamic = "force-dynamic";

const SEARCH_STATUS_COPY: Record<string, string> = {
  pending_refinement:
    "Finalizing your search — dealer outreach begins after your 24-hour refinement window.",
  searching: "Actively searching — we'll show new offers here as they come in.",
  paused: "Search paused.",
  closed: "Search closed.",
  switched: "Superseded by a newer search.",
};

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
    .select("id, email, full_name")
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
          <p className="mt-3 text-zinc-400">{customer?.full_name ?? user.email}</p>
        </div>

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
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">
          {search.make} {search.model}
          {search.trim ? ` — ${search.trim}` : ""}
        </h2>
        <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
          {search.searchStatus.replace(/_/g, " ")}
        </span>
      </div>
      {search.colors.length > 0 && (
        <p className="mt-1 text-sm text-zinc-500">Colors: {search.colors.join(", ")}</p>
      )}
      <p className="mt-3 text-sm text-zinc-400">{SEARCH_STATUS_COPY[search.searchStatus] ?? ""}</p>

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
                      Below MSRP
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  Offer: <span className="text-white">{formatCents(offer.offerPriceCents)}</span> — MSRP:{" "}
                  {formatCents(offer.msrpCents)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Delivered {formatDate(offer.deliveredAt)} — status: {offer.status.replace(/_/g, " ")}
                  {offer.customerRespondedAt && ` on ${formatDate(offer.customerRespondedAt)}`}
                </p>
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
              </li>
            ))}
          </ul>
        )}
      </div>

      {search.searchStatus !== "switched" && search.searchStatus !== "closed" && (
        <SwitchSearchForm searchId={search.id} />
      )}
    </div>
  );
}
