"use client";

import { useState, type FormEvent } from "react";
import { switchCustomerSearch } from "@/lib/switch-actions";
import { BYPASS_REASON_CATEGORIES } from "@/lib/agent-bypass-reasons";
import type { MakeModelOptions, ModelYearOptions } from "@/lib/intake-vehicle-options";
import { soleYearForModel, yearsForModel } from "@/lib/model-year-select";

const selectClass =
  "mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40";

export function AgentSwitchSearchForm({
  searchId,
  makeModelOptions,
  modelYearOptions,
}: {
  searchId: string;
  /**
   * Same live dataset intake reads. Replaces two free-text boxes that
   * nothing validated -- an agent typo used to become a search for a car
   * that does not exist. The server re-checks make, model and year.
   */
  makeModelOptions: MakeModelOptions;
  modelYearOptions: ModelYearOptions;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newMake, setNewMake] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newYear, setNewYear] = useState("");
  const [reasonCategory, setReasonCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makes = Object.keys(makeModelOptions).sort((a, b) => a.localeCompare(b));
  const models = makeModelOptions[newMake] ?? [];
  const years = yearsForModel(modelYearOptions, newMake, newModel);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("old_search_id", searchId);
    formData.set("new_make", newMake);
    formData.set("new_model", newModel);
    formData.set("new_model_year", newYear);
    formData.set("reason_category", reasonCategory);
    formData.set("notes", notes);

    const res = await switchCustomerSearch(formData);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    // On success, revalidatePath refreshes the page — the switched search
    // drops out of this queue (no longer search_status = 'searching').
    setExpanded(false);
    setNewMake("");
    setNewModel("");
    setNewYear("");
    setReasonCategory("");
    setNotes("");
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-4 text-sm text-zinc-400 underline hover:text-white"
      >
        Switch this customer to a different make/model
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-zinc-500">
        Use this after the customer requests a change (phone/email). This starts a new search and closes
        out the current one.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-zinc-400">New make *</label>
          <select
            required
            value={newMake}
            onChange={(e) => {
              setNewMake(e.target.value);
              setNewModel("");
              setNewYear("");
            }}
            className={selectClass}
          >
            <option value="">Select make</option>
            {makes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-400">New model *</label>
          <select
            required
            value={newModel}
            disabled={!newMake}
            onChange={(e) => {
              setNewModel(e.target.value);
              setNewYear(soleYearForModel(modelYearOptions, newMake, e.target.value));
            }}
            className={selectClass}
          >
            <option value="">{newMake ? "Select model" : "Choose a make first"}</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-400">New model year *</label>
          <select
            required
            value={newYear}
            disabled={!newModel}
            onChange={(e) => setNewYear(e.target.value)}
            className={selectClass}
          >
            <option value="">{newModel ? "Select year" : "Choose a model first"}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-zinc-400">Reason *</label>
        <select
          required
          value={reasonCategory}
          onChange={(e) => setReasonCategory(e.target.value)}
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        >
          <option value="" disabled>
            Select a reason…
          </option>
          {BYPASS_REASON_CATEGORIES.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-zinc-400">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
        >
          {submitting ? "Switching…" : "Confirm switch"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
