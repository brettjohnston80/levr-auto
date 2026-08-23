"use client";

import { useState } from "react";
import { confirmAliasAsNewDealership, mergeAliasIntoDealership } from "@/lib/dealership-actions";
import { DealershipSearchPicker } from "@/components/dealership-search-picker";
import type { UnconfirmedAlias } from "@/lib/dealership-queue";

type RowMode = "idle" | "confirm-new" | "merge";

function UnconfirmedAliasRow({ alias }: { alias: UnconfirmedAlias }) {
  const [mode, setMode] = useState<RowMode>("idle");
  const [name, setName] = useState(alias.dealerName);
  const [city, setCity] = useState(alias.dealerCity ?? "");
  const [state, setState] = useState(alias.dealerState ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const location = [alias.dealerCity, alias.dealerState].filter(Boolean).join(", ") || "No city/state on file";

  // Matches AdminLifecycleAction's convention elsewhere in this codebase:
  // show a static confirmation locally rather than trying to move the row
  // out of this list live -- the queue reflects reality again on next load.
  if (done) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div>
          <p className="text-sm text-white">{alias.dealerName}</p>
          <p className="text-xs text-zinc-500">{location}</p>
        </div>
        <span className="text-xs text-emerald-400">Confirmed</span>
      </div>
    );
  }

  async function handleConfirmNew() {
    setSubmitting(true);
    setError(null);
    const result = await confirmAliasAsNewDealership(alias.id, name, city, state);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
  }

  async function handleMerge(dealershipId: string) {
    setSubmitting(true);
    setError(null);
    const result = await mergeAliasIntoDealership(alias.id, dealershipId);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{alias.dealerName}</p>
          <p className="text-xs text-zinc-500">{location}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-zinc-400">
            {alias.listingCount} listing{alias.listingCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => setMode(mode === "confirm-new" ? "idle" : "confirm-new")}
            className="rounded border border-white/15 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5"
          >
            Confirm as new
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "merge" ? "idle" : "merge")}
            className="rounded border border-white/15 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5"
          >
            Merge into existing
          </button>
        </div>
      </div>

      {mode === "confirm-new" && (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Canonical dealership name"
              className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State"
              className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMode("idle")} className="text-xs text-zinc-500 hover:text-zinc-300">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmNew}
              disabled={submitting || name.trim() === ""}
              className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {submitting ? "Creating…" : "Create dealership"}
            </button>
          </div>
        </div>
      )}

      {mode === "merge" && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <DealershipSearchPicker onPick={(d) => handleMerge(d.id)} disabled={submitting} />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function UnconfirmedAliasQueue({ aliases }: { aliases: UnconfirmedAlias[] }) {
  if (aliases.length === 0) {
    return <p className="text-sm text-zinc-500">No unconfirmed dealer identities right now.</p>;
  }

  return (
    <div className="space-y-2">
      {aliases.map((alias) => (
        <UnconfirmedAliasRow key={alias.id} alias={alias} />
      ))}
    </div>
  );
}
