"use client";

import { useState } from "react";
import { COLORS, OPTIONS } from "@/lib/vehicle-data";
import { finalizeSelfService } from "@/lib/finalize-actions";
import type { TrimOption } from "@/lib/finalize-trims";

type Step = "trim" | "color" | "options" | "review";

const STEP_ORDER: Step[] = ["trim", "color", "options", "review"];

function formatCents(cents: number | null): string {
  if (cents == null) return "";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

// The "in-depth, built off Matchmaker" post-payment finalization flow (Step
// 5 of the pending-pivot's "Full flow") -- same step-at-a-time interactive
// pattern as components/matchmaker.tsx, but scoped to the make/model
// already paid for (trim/color/options) rather than open-ended vehicle
// discovery. Trim options come from real synced MarketCheck listings
// (finalize-trims.ts), not mock data.
export function FinalizeSelfService({
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
  const [step, setStep] = useState<Step>("trim");
  const [trim, setTrim] = useState("");
  const [customTrim, setCustomTrim] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const effectiveTrim = trim === "__custom__" ? customTrim : trim;

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    const result = await finalizeSelfService(searchId, {
      trim: effectiveTrim,
      colors,
      requiredOptions: options,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-10 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-zinc-950">
          ✓
        </span>
        <h1 className="mt-6 text-2xl font-semibold text-white">You&apos;re all set.</h1>
        <p className="mt-4 text-sm text-zinc-400">
          You made your decision today. We&apos;ll begin the search tomorrow. If you wake up
          wanting to change something, now&apos;s the time — you have 24 hours to edit this from
          your account.
        </p>
        <a
          href="/account"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          View My Account
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-xl shadow-black/20 sm:p-8">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {STEP_ORDER.map((s, i) => (
          <span key={s} className={`flex items-center gap-2 ${step === s ? "text-emerald-400" : ""}`}>
            {i > 0 && <span className="text-zinc-700">→</span>}
            {s}
          </span>
        ))}
      </div>

      {step === "trim" && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-white">
            Which {make} {model} trim?
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {trimOptions.length > 0
              ? "Based on real current inventory."
              : "No live inventory synced yet — enter a trim, or leave it open."}
          </p>
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => setTrim("")}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                trim === ""
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <span className="font-medium text-white">No preference — any trim</span>
            </button>
            {trimOptions.map((opt) => (
              <button
                key={opt.trim}
                type="button"
                onClick={() => setTrim(opt.trim)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  trim === opt.trim
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-white">{opt.trim}</span>
                  <span className="text-sm text-zinc-400">
                    {formatCents(opt.minPriceCents)}
                    {opt.maxPriceCents && opt.maxPriceCents !== opt.minPriceCents
                      ? `–${formatCents(opt.maxPriceCents)}`
                      : ""}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">{opt.count} currently available nationwide</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTrim("__custom__")}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                trim === "__custom__"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <span className="font-medium text-white">Type a specific trim</span>
            </button>
            {trim === "__custom__" && (
              <input
                type="text"
                value={customTrim}
                onChange={(e) => setCustomTrim(e.target.value)}
                placeholder="e.g. XLE, Sport, Limited"
                className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setStep("color")}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === "color" && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-white">Color preference</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Pick as many as you&apos;re open to — more options means faster offers.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {COLORS.map((color) => {
              const active = colors.includes(color);
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setColors(toggleInArray(colors, color))}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                  }`}
                >
                  {color}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setStep("trim")}
              className="text-sm font-semibold text-zinc-400 hover:text-white"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("options")}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === "options" && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-white">Any must-have options?</h2>
          <p className="mt-2 text-sm text-zinc-400">Optional — leave blank if you&apos;re flexible.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {OPTIONS.map((option) => {
              const active = options.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setOptions(toggleInArray(options, option))}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
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
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setStep("color")}
              className="text-sm font-semibold text-zinc-400 hover:text-white"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("review")}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-white">
            This confirms exactly what we&apos;ll search for
          </h2>
          <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            <p>
              <span className="text-zinc-500">Vehicle:</span> {make} {model}
              {effectiveTrim ? ` — ${effectiveTrim}` : " — any trim"}
            </p>
            <p className="mt-1">
              <span className="text-zinc-500">Colors:</span>{" "}
              {colors.length > 0 ? colors.join(", ") : "No preference"}
            </p>
            <p className="mt-1">
              <span className="text-zinc-500">Options:</span>{" "}
              {options.length > 0 ? options.join(", ") : "None specified"}
            </p>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            You&apos;ll have 24 hours after confirming to change any of this from your account —
            after that, we lock it in and start reaching out to dealers.
          </p>
          {error && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setStep("options")}
              className="text-sm font-semibold text-zinc-400 hover:text-white"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {saving ? "Confirming…" : "Confirm & Start My Search"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
