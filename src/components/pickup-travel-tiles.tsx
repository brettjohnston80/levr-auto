"use client";

import { PICKUP_TRAVEL_OPTIONS } from "@/lib/pickup-travel";

/**
 * The seven pickup-range choices as single-select tiles. Shared by intake,
 * the Your Deal prompt/change control and the agent consultation form, so
 * the options can never differ between them. Nothing is pre-selected unless
 * the caller passes a value -- a default would be an answer nobody gave.
 *
 * `name` also renders a hidden input, for callers that submit FormData
 * (a styled button isn't a form control on its own).
 */
export function PickupTravelTiles({
  value,
  onChange,
  disabled = false,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PICKUP_TRAVEL_OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors disabled:opacity-50 ${
              selected
                ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
                : "border-white/10 bg-zinc-950/60 text-zinc-300 hover:border-white/25"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
