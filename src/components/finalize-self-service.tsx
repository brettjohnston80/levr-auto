"use client";

import { useState } from "react";
import { COLORS, OPTIONS } from "@/lib/vehicle-data";
import { finalizeSelfService } from "@/lib/finalize-actions";
import type { TrimOption } from "@/lib/finalize-trims";
import type {
  ConfiguratorQuestions,
  ConfiguratorSelection,
  TrimPreference,
} from "@/lib/configurator-matching";
import {
  FeatureQuestion,
  RankedQuestion,
  SelectionSummary,
} from "@/components/configurator-questions";
import { RankingQuestion } from "@/components/ranking-question";

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
  modelYear,
}: {
  searchId: string;
  make: string;
  model: string;
  trimOptions: TrimOption[];
  configuratorQuestions: Record<string, ConfiguratorQuestions>;
  /**
   * The search's committed model year. When set, trimOptions have already
   * been filtered to it server-side, so every option shares this year.
   * Null on searches predating the required year.
   */
  modelYear: number | null;
}) {
  const [step, setStep] = useState<Step>("trim");
  // Trim is RANKED now, like every other category. Ids are TrimOption.id
  // (trim+year), not trim names, because two options can share a name
  // across model years and they are genuinely different cars.
  const [rankedTrimIds, setRankedTrimIds] = useState<string[]>([]);
  const [excludedTrimIds, setExcludedTrimIds] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [selections, setSelections] = useState<ConfiguratorSelection[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const trimById = new Map(trimOptions.map((o) => [o.id, o]));
  const topTrimId = rankedTrimIds[0] ?? null;
  const effectiveTrim = (topTrimId && trimById.get(topTrimId)?.trim) || "";

  // ⚠ ONLY THE #1 RANKED TRIM DRIVES THE QUESTIONS, and that is the whole
  // reason ranking trim is safe. The rest of the list is the agent's
  // fallback SEARCH ORDER, not a second set of answers -- a colour only
  // means something against one specific build, so asking about several at
  // once would produce answers no single car could satisfy. An empty list
  // or a typed custom trim resolves to null: neither identifies one
  // researched build.
  const questions: ConfiguratorQuestions | null =
    (topTrimId && configuratorQuestions[topTrimId]) || null;

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
   * Minimum engagement, exterior colour / interior / seating only
   * (2026-09-15). Leaving one of these three completely untouched -- no
   * option ranked, none excluded -- is no longer a valid way to continue;
   * trim and features are deliberately excluded (trim's "any trim is
   * fine" and features' "none of these" are both real, meaningful
   * answers on their own). A category is only ever a step in `steps` when
   * it genuinely offered more than one real choice, so a suppressed
   * category (e.g. seating on the 217 of 243 trims with only one layout)
   * never reaches this check at all -- there is nothing here scoping it
   * to "shown" separately from that.
   *
   * The predicate is deliberately simple: RankedQuestion only ever adds a
   * row to `selections` for an option the customer ranked or excluded, so
   * "any row in this category" and "engaged with this category" are the
   * same fact by construction (see configurator-questions.tsx).
   */
  const REQUIRES_ENGAGEMENT: Partial<Record<Step, ConfiguratorSelection["category"]>> = {
    exteriorColor: "exterior_color",
    interior: "interior",
    seating: "seating",
  };
  const requiredCategory = REQUIRES_ENGAGEMENT[step];
  const categoryEngaged = requiredCategory
    ? selections.some((s) => s.category === requiredCategory)
    : true;

  /**
   * Changing trim discards configurator answers, and that is correct
   * rather than unfortunate: a colour or package belongs to one specific
   * build, so carrying "Wind Chill Pearl, ranked #1" across to a trim that
   * cannot be built in it would produce an answer the customer never gave.
   * The generic colours/options are free-text preferences about the model,
   * not one build, so they legitimately survive.
   *
   * THE RESET IS KEYED TO THE RESOLVED BUILD, NOT THE SELECTED OPTION, and
   * that distinction starts mattering now that trim is itself a ranked
   * list. Two trim options can resolve to the same researched build, and
   * reordering the list is going to change the selected option constantly
   * once step 6 lands -- wiping answers on every such change would make
   * the ranking UI feel like it silently eats work. Answers are only
   * invalidated when the build they describe genuinely changes.
   */
  function handleTrimRanking(nextRanked: string[], nextExcluded: string[]) {
    // THE RESET IS KEYED TO THE RESOLVED BUILD OF #1, NOT TO THE LIST.
    // Reordering ranks 2+, excluding a trim, or undoing an exclusion all
    // leave the #1 build untouched and must NOT discard colour answers --
    // that is most of what this screen's dragging does, and wiping on
    // every change would make the UI feel like it eats work. Only a
    // genuine change of the build those answers describe invalidates them.
    const nextBuild =
      (nextRanked[0] && configuratorQuestions[nextRanked[0]]?.configuratorTrimId) || null;
    const currentBuild = questions?.configuratorTrimId ?? null;
    if (nextBuild !== currentBuild) setSelections([]);
    setRankedTrimIds(nextRanked);
    setExcludedTrimIds(nextExcluded);
  }


  /**
   * The customer's trim ranking, as the write path wants it.
   *
   * Ranks become 1..n in list order; exclusions carry a null rank. The #1
   * entry is what decides the legacy `trim` column and which configurator
   * build the colour/feature answers get validated against, server-side --
   * see writeTrimPreferences. Ranking nothing is a legitimate answer and
   * yields an empty list, i.e. "any trim is fine".
   */
  function buildTrimPreferences(): TrimPreference[] {
    const toPref = (id: string, rankPosition: number | null): TrimPreference | null => {
      const opt = trimById.get(id);
      if (!opt) return null;
      return {
        trim: opt.trim,
        modelYear: opt.year ?? null,
        rankPosition,
        excluded: rankPosition === null,
        configuratorTrimId: configuratorQuestions[id]?.configuratorTrimId ?? null,
      };
    };
    return [
      ...rankedTrimIds.map((id, i) => toPref(id, i + 1)),
      ...excludedTrimIds.map((id) => toPref(id, null)),
    ].filter(Boolean) as TrimPreference[];
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    // The legacy columns are now DERIVED SERVER-SIDE from the rows that
    // actually get stored (see writeConfiguratorSelections), so the rich
    // path no longer computes a parallel colours list here that could
    // drift out of rank order or quietly include an excluded colour. The
    // generic path still sends its own, because it has no ranked rows to
    // derive anything from.
    const result = await finalizeSelfService(searchId, {
      trim: effectiveTrim,
      colors,
      requiredOptions: options,
      selections,
      trimPreferences: buildTrimPreferences(),
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
          {trimOptions.length > 0 ? (
            <RankingQuestion
              title={`Which ${make} ${model} trim?`}
              subtitle="Rank them in the order you'd like us to search — we'll work down your list. Mark anything you'd exclude, and leave the rest alone."
              items={trimOptions.map((opt) => ({
                id: opt.id,
                label: opt.trim,
                // Year is shown only when it distinguishes something. With a
                // committed year every option is that year, so the suffix is
                // redundant and dropped. Without one (a search predating the
                // required year) a trim spanning two model years would
                // otherwise render as two identical-looking rows.
                sublabel: modelYear == null && opt.year != null ? String(opt.year) : null,
                detail: (
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {formatCents(opt.minPriceCents)}
                    {opt.maxPriceCents && opt.maxPriceCents !== opt.minPriceCents
                      ? `–${formatCents(opt.maxPriceCents)}`
                      : ""}
                    {" · "}
                    {opt.count} available nationwide
                  </span>
                ),
              }))}
              ranked={rankedTrimIds}
              excluded={excludedTrimIds}
              onChange={handleTrimRanking}
            />
          ) : (
            /*
              No synced inventory for this make/model yet. There is nothing
              real to rank, and NO free-text box: a trim the customer types
              is not an inventory option, cannot be ranked against one, and
              was only ever reaching the legacy trim column as an
              unvalidated string. Leaving it open is the honest answer --
              the agent sources across trims and the customer still gets a
              24h window to narrow it once inventory lands.
            */
            <>
              <h2 className="text-xl font-semibold text-white">
                Which {make} {model} trim?
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                We haven&apos;t synced live inventory for this one yet, so there&apos;s nothing to
                rank here. We&apos;ll search every trim — you can narrow it down later from your
                account.
              </p>
            </>
          )}

          {/* Ranking nothing is a legitimate answer -- "any trim" -- so
              Next is never blocked on having built a list. */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              {rankedTrimIds.length === 0 && trimOptions.length > 0
                ? "Don't rank any, and we'll treat every trim as fine."
                : ""}
            </p>
            <button
              type="button"
              onClick={goNext}
              className="shrink-0 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === "exteriorColor" && questions && (
        <RankedQuestion
          title="What color?"
          subtitle={`These are the colors a ${effectiveTrim} can actually be built in. Rank the ones you'd like, or let us know if there's one you'd exclude.`}
          choices={questions.exteriorColor}
          category="exterior_color"
          selections={selections}
          onChange={setSelections}
        />
      )}

      {step === "interior" && questions && (
        <RankedQuestion
          title="Interior?"
          subtitle={"Rank the ones you'd like, or let us know if there's one you'd exclude."}
          choices={questions.interior}
          category="interior"
          selections={selections}
          onChange={setSelections}
        />
      )}

      {step === "seating" && questions && (
        <RankedQuestion
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
        <div className="mt-6">
          {requiredCategory && !categoryEngaged && (
            <p className="mb-3 text-xs text-amber-400">
              Rank at least one, or exclude one, to continue.
            </p>
          )}
          <div className="flex justify-between">
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
              disabled={!categoryEngaged}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {index === steps.length - 2 ? "Review" : "Next"}
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
