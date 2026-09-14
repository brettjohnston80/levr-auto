"use client";

import { useState } from "react";
import { updateSearchVehicle } from "@/lib/finalize-actions";
import type { MakeModelOptions } from "@/lib/intake-vehicle-options";

/**
 * "That's not the car I meant" -- correcting make/model on the finalize
 * screen, free, before the search has started.
 *
 * Deliberately collapsed behind a link rather than shown as an open form.
 * The overwhelmingly common case is that the vehicle is right (they just
 * paid for it), and putting two prominent selects above the trim picker
 * would invite second-guessing at exactly the moment the flow wants
 * momentum. It needs to be findable, not loud.
 *
 * This is NOT the switch flow and must never be confused with it -- see
 * updateSearchVehicle. It is only ever rendered on /finalize, which is
 * only reachable while the search is still awaiting finalization; the
 * server action re-checks that independently rather than trusting the
 * page's own gate.
 */
export function VehicleEditControl({
  searchId,
  make,
  model,
  makeModelOptions,
}: {
  searchId: string;
  make: string;
  model: string;
  makeModelOptions: MakeModelOptions;
}) {
  const [open, setOpen] = useState(false);
  const [nextMake, setNextMake] = useState(make);
  const [nextModel, setNextModel] = useState(model);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makes = Object.keys(makeModelOptions).sort();
  const models = makeModelOptions[nextMake] ?? [];
  const unchanged = nextMake === make && nextModel === model;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateSearchVehicle(searchId, nextMake, nextModel);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // A full reload, not a router.refresh(): every downstream prop on this
    // page -- trim options, configurator questions, the whole rich/generic
    // branch -- is derived from make/model on the server, and any
    // in-memory selection state still in the tree belongs to the old
    // vehicle. Starting clean is the honest outcome of changing the car.
    window.location.reload();
  }

  if (!open) {
    return (
      <p className="mt-6 text-center text-sm text-zinc-500">
        Not the right vehicle?{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-medium text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
        >
          Change make or model
        </button>
      </p>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold text-white">Change make or model</h3>
      <p className="mt-1.5 text-sm text-zinc-400">
        Your search hasn&apos;t started yet, so this is free and won&apos;t use your free switch.
        Changing it clears any trim, color, or option choices you&apos;ve made.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Make</span>
          <select
            value={nextMake}
            onChange={(e) => {
              setNextMake(e.target.value);
              // The old model almost never exists under a new make, and
              // leaving it selected would post a pair the server rejects.
              setNextModel(makeModelOptions[e.target.value]?.[0] ?? "");
            }}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          >
            {makes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Model</span>
          <select
            value={nextModel}
            onChange={(e) => setNextModel(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || unchanged || !nextModel}
          className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {saving ? "Saving…" : "Save vehicle"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setNextMake(make);
            setNextModel(model);
            setError(null);
          }}
          className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-white/30"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
