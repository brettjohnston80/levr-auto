"use client";

import { useState } from "react";
import { updateSearchVehicle } from "@/lib/finalize-actions";
import type { MakeModelOptions, ModelYearOptions } from "@/lib/intake-vehicle-options";
import { soleYearForModel, yearsForModel } from "@/lib/model-year-select";

/**
 * "That's not the car I meant" -- correcting make/model/year on the
 * finalize screen, free, before the search has started.
 *
 * Deliberately collapsed behind a link rather than shown as an open form.
 * The overwhelmingly common case is that the vehicle is right (they just
 * paid for it), and putting prominent selects above the trim picker would
 * invite second-guessing at exactly the moment the flow wants momentum. It
 * needs to be findable, not loud.
 *
 * This is NOT the switch flow and must never be confused with it -- see
 * updateSearchVehicle. It is only ever rendered on /finalize, which is
 * only reachable while the search is still awaiting finalization; the
 * server action re-checks that independently rather than trusting the
 * page's own gate.
 *
 * Model year behaves exactly as at intake: a make/model offered in one
 * year pre-selects it, two or more years require a real choice. A search
 * created before year was required (model_year null) starts on that
 * pre-selection or blank, so saving here is also how such a search gets a
 * committed year.
 */
export function VehicleEditControl({
  searchId,
  make,
  model,
  modelYear,
  makeModelOptions,
  modelYearOptions,
  defaultOpen = false,
}: {
  searchId: string;
  make: string;
  model: string;
  modelYear: number | null;
  makeModelOptions: MakeModelOptions;
  modelYearOptions: ModelYearOptions;
  /**
   * Open on arrival rather than collapsed behind a link. Used by the
   * zero-inventory block, where changing the vehicle is the ONLY way
   * forward, so hiding it behind a link would read as a dead end.
   */
  defaultOpen?: boolean;
}) {
  const yearsFor = (mk: string, md: string) => yearsForModel(modelYearOptions, mk, md);
  const soleYear = (mk: string, md: string) => soleYearForModel(modelYearOptions, mk, md);
  const committedYear = modelYear != null ? String(modelYear) : "";
  const initialYear = committedYear || soleYear(make, model);

  const [open, setOpen] = useState(defaultOpen);
  const [nextMake, setNextMake] = useState(make);
  const [nextModel, setNextModel] = useState(model);
  const [nextYear, setNextYear] = useState(initialYear);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makes = Object.keys(makeModelOptions).sort();
  const models = makeModelOptions[nextMake] ?? [];
  const years = yearsFor(nextMake, nextModel);
  const unchanged = nextMake === make && nextModel === model && nextYear === committedYear;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateSearchVehicle(
      searchId,
      nextMake,
      nextModel,
      nextYear ? Number(nextYear) : null,
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // A full reload, not a router.refresh(): every downstream prop on this
    // page -- trim options, configurator questions, the whole rich/generic
    // branch -- is derived from the vehicle on the server, and any
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
          Change make, model, or year
        </button>
      </p>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold text-white">Change make, model, or year</h3>
      <p className="mt-1.5 text-sm text-zinc-400">
        Your search hasn&apos;t started yet, so this is free and won&apos;t use your free switch.
        Changing it clears any trim, color, or option choices you&apos;ve made.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Make</span>
          <select
            value={nextMake}
            onChange={(e) => {
              const firstModel = makeModelOptions[e.target.value]?.[0] ?? "";
              setNextMake(e.target.value);
              // The old model almost never exists under a new make, and
              // leaving it selected would post a pair the server rejects.
              setNextModel(firstModel);
              setNextYear(soleYear(e.target.value, firstModel));
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
            onChange={(e) => {
              setNextModel(e.target.value);
              // A year is only meaningful for the model it was chosen
              // under; a different model restarts the choice.
              setNextYear(soleYear(nextMake, e.target.value));
            }}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Model year
          </span>
          <select
            value={nextYear}
            onChange={(e) => setNextYear(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Select year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
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
          disabled={saving || unchanged || !nextModel || !nextYear}
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
            setNextYear(initialYear);
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
