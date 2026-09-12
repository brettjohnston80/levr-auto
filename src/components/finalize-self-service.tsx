"use client";

import { useState } from "react";
import { COLORS, OPTIONS } from "@/lib/vehicle-data";
import { finalizeSelfService } from "@/lib/finalize-actions";
import type { TrimOption } from "@/lib/finalize-trims";
import type {
  ConfiguratorQuestions,
  ConfiguratorSelection,
} from "@/lib/configurator-matching";
import {
  FeatureQuestion,
  PreferenceQuestion,
  SelectionSummary,
} from "@/components/configurator-questions";

type Step =
  | "trim"
  | "color"
  | "options"
  | "exteriorColor"
  | "interior"
  | "seating"
  | "features"
  | "review";

const STEP_LABELS: Record<Step, string> = {
  trim: "trim",
  color: "color",
  options: "options",
  exteriorColor: "color",
  interior: "interior",
  seating: "seating",
  features: "features",
  review: "review",
};

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
//
// TWO PATHS THROUGH THE SAME COMPONENT (step 7 of 9). When the chosen trim
// resolves to exactly one researched configurator build, the generic
// colour/options steps are replaced by real questions about that specific
// car -- the colours it can actually be built in, at their real prices,
// with package contents spelled out. When it does not resolve -- no live
// batch, a make with no configurator data, or an ambiguous trim -- the
// flow is byte-for-byte what it has always been. The fallback is the
// common case by a wide margin and is never degraded to make room for the
// rich one.
export function FinalizeSelfService({
  searchId,
  make,
  model,
  trimOptions,
  configuratorQuestions,
}: {
  searchId: string;
  make: string;
  model: string;
  trimOptions: TrimOption[];
  configuratorQuestions: Record<string, ConfiguratorQuestions>;
}) {
  const [step, setStep] = useState<Step>("trim");
  const [trim, setTrim] = useState("");
  // Which OPTION is selected, distinct from the trim string that gets
  // saved. Needed because trim options are now split by model year, so two
  // options can share a trim name -- selecting one must not highlight both.
  // `trim` remains exactly what is persisted; the schema is unchanged.
  const [selectedTrimId, setSelectedTrimId] = useState<string | null>(null);
  const [customTrim, setCustomTrim] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [selections, setSelections] = useState<ConfiguratorSelection[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const effectiveTrim = trim === "__custom__" ? customTrim : trim;

  // Rich questions apply only to the trim currently selected. "No
  // preference" and a typed custom trim both correctly resolve to null --
  // neither identifies a single researched build.
  const questions: ConfiguratorQuestions | null =
    (selectedTrimId && configuratorQuestions[selectedTrimId]) || null;

  const steps: Step[] = ["trim"];
  if (questions) {
    if (questions.exteriorColor.length > 0) steps.push("exteriorColor");
    if (questions.interior.length > 0) steps.push("interior");
    if (questions.seating.length > 0) steps.push("seating");
    if (questions.features.length > 0) steps.push("features");
  } else {
    steps.push("color", "options");
  }
  steps.push("review");

  const index = Math.max(0, steps.indexOf(step));
  const goNext = () => setStep(steps[Math.min(index + 1, steps.length - 1)]);
  const goBack = () => setStep(steps[Math.max(index - 1, 0)]);

  /**
   * Changing trim discards configurator answers, and that is correct
   * rather than unfortunate: a colour or package belongs to one specific
   * build, so carrying "Wind Chill Pearl, must have" across to a trim that
   * cannot be built in it would produce an answer the customer never gave.
   * The generic colours/options are free-text preferences about the model,
   * not one build, so they legitimately survive.
   */
  function chooseTrim(nextTrim: string, nextTrimId: string | null) {
    if (nextTrimId !== selectedTrimId) setSelections([]);
    setTrim(nextTrim);
    setSelectedTrimId(nextTrimId);
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    // The legacy columns keep being written from whichever path ran, so
    // every existing reader -- /account, both agent forms, the outreach
    // queue -- carries on working with no awareness of configurator data.
    const richColors = selections
      .filter((s) => s.category === "exterior_color")
      .map((s) => s.selection);
    const richOptions = selections.filter((s) => s.category === "feature").map((s) => s.selection);
    const result = await finalizeSelfService(searchId, {
      trim: effectiveTrim,
      colors: questions ? richColors : colors,
      requiredOptions: questions ? richOptions : options,
      configuratorTrimId: questions?.configuratorTrimId ?? null,
      selections,
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
        {steps.map((s, i) => (
          <span key={s} className={`flex items-center gap-2 ${step === s ? "text-emerald-400" : ""}`}>
            {i > 0 && <span className="text-zinc-700">→</span>}
            {STEP_LABELS[s]}
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
              onClick={() => chooseTrim("", null)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                selectedTrimId === null && trim === ""
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <span className="font-medium text-white">No preference — any trim</span>
            </button>
            {trimOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => chooseTrim(opt.trim, opt.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selectedTrimId === opt.id
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-white">
                    {opt.trim}
                    {/* Year shown only when known. Without it, a trim that
                        spans two model years would render as two visually
                        identical rows. */}
                    {opt.year != null && (
                      <span className="ml-2 font-normal text-zinc-500">{opt.year}</span>
                    )}
                  </span>
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
              onClick={() => chooseTrim("__custom__", null)}
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
              onClick={goNext}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === "exteriorColor" && questions && (
        <PreferenceQuestion
          title="What color?"
          subtitle={`These are the colors a ${trim} can actually be built in. Tell us how much each one matters — your agent negotiates accordingly.`}
          choices={questions.exteriorColor}
          category="exterior_color"
          selections={selections}
          onChange={setSelections}
        />
      )}

      {step === "interior" && questions && (
        <PreferenceQuestion
          title="Interior?"
          subtitle="Pick any you'd be happy with, and how strongly you feel about them."
          choices={questions.interior}
          category="interior"
          selections={selections}
          onChange={setSelections}
        />
      )}

      {step === "seating" && questions && (
        <PreferenceQuestion
          title="Seating layout?"
          subtitle="This trim offers more than one configuration."
          choices={questions.seating}
          category="seating"
          selections={selections}
          onChange={setSelections}
        />
      )}

      {step === "features" && questions && (
        <FeatureQuestion
          choices={questions.features}
          selections={selections}
          onChange={setSelections}
        />
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
        </div>
      )}

      {step !== "trim" && step !== "review" && (
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={goBack}
            className="text-sm font-semibold text-zinc-400 hover:text-white"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            {index === steps.length - 2 ? "Review" : "Next"}
          </button>
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
            {questions ? (
              selections.length > 0 ? (
                <SelectionSummary selections={selections} />
              ) : (
                <p className="mt-1 text-zinc-500">No color or feature preferences — flexible.</p>
              )
            ) : (
              <>
                <p className="mt-1">
                  <span className="text-zinc-500">Colors:</span>{" "}
                  {colors.length > 0 ? colors.join(", ") : "No preference"}
                </p>
                <p className="mt-1">
                  <span className="text-zinc-500">Options:</span>{" "}
                  {options.length > 0 ? options.join(", ") : "None specified"}
                </p>
              </>
            )}
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
              onClick={goBack}
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
