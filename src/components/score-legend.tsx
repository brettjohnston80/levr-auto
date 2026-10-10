"use client";

import { useEffect, useRef, useState } from "react";
import type { VehicleType } from "@/lib/matchmaker-data";
import { INDICATOR_CLASSES } from "@/lib/matchmaker-dimension-indicators";
import { scoreLegendLines } from "@/lib/matchmaker-explain";

const LEVELS = ["gold", "green", "yellow", "red", "gray"] as const;

// What the score labels mean (Cruz's tester feedback #6, 2026-10-10): an
// info button that opens a short legend in place. Shared by the results
// list and the vehicle detail view so the two can't describe the labels
// differently.
export function ScoreLegendButton({ types, align = "left" }: { types: (VehicleType | "")[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const lines = scoreLegendLines(types);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="What the score labels mean"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 7.25V11.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.9" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <span
          role="dialog"
          className={`absolute top-8 z-30 w-72 rounded-2xl border border-white/10 bg-zinc-900 p-4 text-left shadow-2xl shadow-black/60 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <span className="flex flex-col gap-2.5">
            {lines.map((line, i) => (
              <span key={line.label} className="flex flex-col gap-1 text-xs leading-relaxed text-zinc-300 normal-case">
                <span
                  className={`self-start rounded-full px-2.5 py-0.5 font-semibold tracking-normal ${INDICATOR_CLASSES[LEVELS[i]]}`}
                >
                  {line.label}
                </span>
                <span className="font-normal tracking-normal">{line.text.charAt(0).toUpperCase() + line.text.slice(1)}</span>
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
