"use client";

import { useState } from "react";
import { MAKES, MAKES_AND_MODELS, COLORS, OPTIONS } from "@/lib/vehicle-data";
import { finalizeUndecidedSearch } from "@/lib/outreach-actions";

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

// Agent-side form for the one-combined-call path (UX review #3) -- a
// customer paid with no make/model picked yet, so this form sets the
// vehicle AND finalizes trim/color/options together in one submission,
// mirroring AgentFinalizeSearchForm's flat-form styling. Trim is always
// freeform text here (no dropdown) -- nothing's synced for this make/model
// until this action runs, so there's no listings data to build options
// from yet.
export function AgentUndecidedFinalizeForm({ searchId }: { searchId: string }) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!make || !model) {
      setError("Make and model are both required.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await finalizeUndecidedSearch(searchId, { make, model, trim, colors, requiredOptions: options });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Failed to finalize.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
        Finalized — {make} {model} saved, and the customer&apos;s 24h edit window is now open.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-zinc-400 uppercase">Make</label>
          <select
            value={make}
            onChange={(e) => {
              setMake(e.target.value);
              setModel("");
            }}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Select make</option>
            {MAKES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-400 uppercase">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={!make}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            <option value="">{make ? "Select model" : "Choose a make first"}</option>
            {(make ? MAKES_AND_MODELS[make] : []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-zinc-400 uppercase">Trim</label>
        <input
          type="text"
          value={trim}
          onChange={(e) => setTrim(e.target.value)}
          placeholder={make && model ? `Type a trim for this ${make} ${model}` : "Type a trim"}
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-zinc-400 uppercase">Colors</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {COLORS.map((color) => {
            const active = colors.includes(color);
            return (
              <button
                key={color}
                type="button"
                onClick={() => setColors(toggleInArray(colors, color))}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                    : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25"
                }`}
              >
                {color}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-zinc-400 uppercase">Must-have options</label>
        <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const active = options.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => setOptions(toggleInArray(options, option))}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-500/10 text-white"
                    : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {saving ? "Saving…" : "Save vehicle & finalize"}
        </button>
      </div>
    </div>
  );
}
