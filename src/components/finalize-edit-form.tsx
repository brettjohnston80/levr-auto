"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VehicleEditControl } from "@/components/vehicle-edit-control";
import { formatRemaining } from "@/lib/edit-window";
import type { MakeModelOptions, ModelYearOptions } from "@/lib/intake-vehicle-options";


// The 24h window after finalization on /account: countdown, a summary of
// the current answers, and "Make changes", which opens the full finalize
// flow pre-filled in Your Car (2026-10-10). It used to expand into a flat
// generic trim/colour/options form here; that form couldn't express ranked
// or configurator answers and silently cleared a Toyota/Honda customer's
// detailed choices on save, so it's gone. updateFinalizedSearch never
// touches finalized_at, so the countdown keeps running through edits.
export function FinalizeEditForm({
  searchId,
  finalizedAt,
  initialTrim,
  initialColors,
  initialRequiredOptions,
  make,
  model,
  makeModelOptions,
  modelYear,
  modelYearOptions,
  solidifiedAt,
}: {
  searchId: string;
  finalizedAt: string;
  initialTrim: string | null;
  initialColors: string[];
  initialRequiredOptions: string[];
  make: string | null;
  model: string | null;
  /** Empty for an undecided search, which has no vehicle to correct yet. */
  makeModelOptions: MakeModelOptions;
  /** customer_searches.model_year; null only on searches predating 2026-09-14. */
  modelYear: number | null;
  modelYearOptions: ModelYearOptions;
  /** Non-null means the search has started -- vehicle changes go paid. */
  solidifiedAt: string | null;
}) {
  const deadline = new Date(finalizedAt).getTime() + 24 * 60 * 60 * 1000;
  // Lazy initializer (not a synchronous setState-in-effect) -- this still
  // only ever reads Date.now() on the client, since the whole component is
  // "use client" and the countdown text is never part of the server-rendered
  // HTML that gets diffed during hydration.
  const [now, setNow] = useState<number>(() => Date.now());
  const trim = initialTrim ?? "";
  const colors = initialColors;
  const options = initialRequiredOptions;

  // Ticks the countdown forward every minute -- the initial value already
  // comes from the lazy useState initializer above, so this effect only
  // subscribes to the timer, it doesn't set state synchronously on mount.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = deadline - now;
  const windowOpen = remainingMs > 0;

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase">Trim, color &amp; options</p>
        {remainingMs != null && (
          <span className={`text-xs font-medium ${windowOpen ? "text-emerald-400" : "text-zinc-500"}`}>
            {formatRemaining(remainingMs)}
          </span>
        )}
      </div>

      <div className="mt-2 text-sm text-zinc-300">
          <p>
            <span className="text-zinc-500">Trim:</span> {trim || "No preference"}
          </p>
          <p className="mt-1">
            <span className="text-zinc-500">Colors:</span>{" "}
            {colors.length > 0 ? colors.join(", ") : "No preference"}
          </p>
          <p className="mt-1">
            <span className="text-zinc-500">Options:</span>{" "}
            {options.length > 0 ? options.join(", ") : "None specified"}
          </p>
          {windowOpen && (
            <Link
              href={`/account/vehicle?searchId=${searchId}&edit=1`}
              className="mt-3 inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Make changes
            </Link>
          )}
          {/*
            Make/model correction, same control and same server action as
            /finalize -- one implementation across both surfaces.

            GATED ON solidified_at, NOT ON THE COUNTDOWN ABOVE, and the
            difference is real rather than pedantic. Solidification is an
            HOURLY cron, so for up to an hour after finalized_at + 24h the
            countdown reads "Window closed" while solidified_at is still
            null -- and updateSearchVehicle would happily accept the change
            throughout, because the search genuinely has not started. Gating
            on the countdown would hide a control the server still honours,
            and would leave that hour with the free control gone and the
            paid switch box not yet shown. This condition is the exact
            complement of canSwitch's on /account.
          */}
          {!solidifiedAt && make && model && Object.keys(makeModelOptions).length > 0 && (
            <VehicleEditControl
              searchId={searchId}
              make={make}
              model={model}
              modelYear={modelYear}
              makeModelOptions={makeModelOptions}
              modelYearOptions={modelYearOptions}
            />
          )}
        </div>
    </div>
  );
}
