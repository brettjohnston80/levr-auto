"use client";

import { useEffect, useState } from "react";
import { COLORS, OPTIONS } from "@/lib/vehicle-data";
import { updateFinalizedSearch } from "@/lib/finalize-actions";

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Window closed";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m left to edit`;
  return `${minutes}m left to edit`;
}

// Self-edit UI for the 24h window after finalization (Step 7a). Deliberately
// a flat trim/color/options form, not the multi-step Matchmaker-style wizard
// used at initial finalization (finalize-self-service.tsx) -- this is a
// quick correction tool for someone who already made a considered choice,
// not a fresh discovery flow. Calls updateFinalizedSearch, which never
// touches finalized_at, so the countdown here keeps counting down through
// edits rather than resetting.
export function FinalizeEditForm({
  searchId,
  finalizedAt,
  initialTrim,
  initialColors,
  initialRequiredOptions,
}: {
  searchId: string;
  finalizedAt: string;
  initialTrim: string | null;
  initialColors: string[];
  initialRequiredOptions: string[];
}) {
  const deadline = new Date(finalizedAt).getTime() + 24 * 60 * 60 * 1000;
  // Lazy initializer (not a synchronous setState-in-effect) -- this still
  // only ever reads Date.now() on the client, since the whole component is
  // "use client" and the countdown text is never part of the server-rendered
  // HTML that gets diffed during hydration.
  const [now, setNow] = useState<number>(() => Date.now());
  const [editing, setEditing] = useState(false);
  const [trim, setTrim] = useState(initialTrim ?? "");
  const [colors, setColors] = useState<string[]>(initialColors);
  const [options, setOptions] = useState<string[]>(initialRequiredOptions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Ticks the countdown forward every minute -- the initial value already
  // comes from the lazy useState initializer above, so this effect only
  // subscribes to the timer, it doesn't set state synchronously on mount.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = deadline - now;
  const windowOpen = remainingMs > 0;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateFinalizedSearch(searchId, {
      trim,
      colors,
      requiredOptions: options,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    setSavedAt(Date.now());
  }

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

      {!editing ? (
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
          {savedAt && <p className="mt-2 text-xs text-emerald-400">Changes saved.</p>}
          {windowOpen && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-3 rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
            >
              Edit
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase">Trim</label>
            <input
              type="text"
              value={trim}
              onChange={(e) => setTrim(e.target.value)}
              placeholder="e.g. XLE, Sport, Limited — or leave blank for no preference"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase">Colors</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {COLORS.map((color) => {
                const active = colors.includes(color);
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setColors(toggleInArray(colors, color))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
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
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
              {OPTIONS.map((option) => {
                const active = options.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setOptions(toggleInArray(options, option))}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all ${
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
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setTrim(initialTrim ?? "");
                setColors(initialColors);
                setOptions(initialRequiredOptions);
                setError(null);
              }}
              className="text-sm font-semibold text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
