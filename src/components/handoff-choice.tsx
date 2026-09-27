"use client";

import { HANDOFF_OPTIONS, type HandoffMethod } from "@/lib/pickup-travel";

/** The two pickup/delivery pills. Pure control; callers decide what a pick does. */
export function HandoffChoice({
  value,
  onChange,
  disabled = false,
}: {
  value: HandoffMethod | null;
  onChange: (value: HandoffMethod) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {HANDOFF_OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              selected ? "bg-emerald-500 text-zinc-950" : "border border-white/15 text-zinc-300 hover:bg-white/5"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
