"use client";

import { useState } from "react";
import { COLORS, OPTIONS } from "@/lib/vehicle-data";
import { finalizeSearchByAgent } from "@/lib/outreach-actions";
import type { TrimOption } from "@/lib/finalize-trims";

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function formatCents(cents: number | null): string {
  if (cents == null) return "";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

// Agent-side form for recording the outcome of a finalization call (Step 4's
// "manual for now" call path) -- a single flat form rather than the
// customer-facing step-by-step wizard (finalize-self-service.tsx), since an
// agent is transcribing a decision the customer already made on the phone,
// not walking them through discovery. Submits via finalizeSearchByAgent,
// which has the same effect as the customer's own self-service finalize.
export function AgentFinalizeSearchForm({
  searchId,
  make,
  model,
  trimOptions,
}: {
  searchId: string;
  make: string;
  model: string;
  trimOptions: TrimOption[];
}) {
  const [trim, setTrim] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const result = await finalizeSearchByAgent(searchId, { trim, colors, requiredOptions: options });
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
        Finalized — the customer&apos;s 24h edit window is now open.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <div>
        <label className="text-xs font-semibold text-zinc-400 uppercase">Trim</label>
        <select
          value={trim}
          onChange={(e) => setTrim(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="">No preference — any trim</option>
          {trimOptions.map((opt) => (
            <option key={opt.trim} value={opt.trim}>
              {opt.trim} ({formatCents(opt.minPriceCents)}
              {opt.maxPriceCents && opt.maxPriceCents !== opt.minPriceCents
                ? `–${formatCents(opt.maxPriceCents)}`
                : ""}
              )
            </option>
          ))}
        </select>
        {trimOptions.length === 0 && (
          <input
            type="text"
            value={trim}
            onChange={(e) => setTrim(e.target.value)}
            placeholder={`Type a trim for this ${make} ${model}`}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        )}
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
          {saving ? "Saving…" : "Finalize on customer's behalf"}
        </button>
      </div>
    </div>
  );
}
