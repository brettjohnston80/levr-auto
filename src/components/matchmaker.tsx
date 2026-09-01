"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GetStartedButton } from "@/components/get-started-button";
import { VehicleDetailModal } from "@/components/vehicle-detail-modal";
import { PriceRangeSlider } from "@/components/price-range-slider";
import {
  ALL_PRIORITIES,
  FAMILY_SIZES,
  LARGE_CAPACITY_VEHICLE_TYPES,
  POWERTRAINS,
  PRICE_SLIDER_MIN,
  PRICE_SLIDER_MAX,
  PRIORITY_HINTS_BY_USE_CASE,
  RATINGS_DISCLAIMER,
  TOWING_PAYLOAD_VEHICLE_TYPES,
  USE_CASES_BY_VEHICLE_TYPE,
  VEHICLE_TYPES,
  applyUseCaseHint,
  defaultPriorityOrder,
  formatPriceRange,
  retargetPriorityOrderForVehicleType,
  type Answers,
  type Powertrain,
  type PriceRangeValue,
  type VehicleType,
} from "@/lib/matchmaker-data";
import { formatPriceEstimate, fuelTypeToPowertrain, type MatchmakerVehicle } from "@/lib/matchmaker-vehicle-display";
import {
  getAllVariantsForModel,
  getMakesForBodyStyle,
  getMatchedVehicles,
  getModelsForMakeAndBodyStyle,
  getModelYearsForMakeAndModel,
  pickHighestScoringVariant,
  segmentByPowertrain,
  groupByModel,
  type MatchedVehicle,
  type ModelGroup,
} from "@/lib/matchmaker-scoring";
import {
  comparisonRowOrder,
  dimensionIndicator,
  dimensionDataPoint,
  personalizedDimensionOrder,
  INDICATOR_CLASSES,
  INDICATOR_LEVEL_LABEL,
} from "@/lib/matchmaker-dimension-indicators";

const EMPTY_ANSWERS: Answers = {
  vehicleType: "",
  useCase: "",
  familySize: "",
  powertrain: "",
  priceRange: null,
  priorities: defaultPriorityOrder(""),
};

type Step = {
  id: keyof Answers;
  kind: "select" | "range" | "rank";
  title: string;
  subtitle?: string;
  options?: string[];
};

const STEPS: Step[] = [
  {
    id: "vehicleType",
    kind: "select",
    title: "What type of vehicle are you looking for?",
    subtitle: "Pick the body style that fits how you get around.",
    options: VEHICLE_TYPES,
  },
  {
    id: "useCase",
    kind: "select",
    title: "What will you mainly use it for?",
    subtitle: "We'll weigh capability and comfort based on this.",
    // options are computed per vehicle type at render time — see stepForRender in Matchmaker()
  },
  {
    id: "familySize",
    kind: "select",
    title: "How many people usually ride along?",
    subtitle: "Helps us gauge how much seating and cargo room you need.",
    // options are computed per vehicle type at render time — see stepForRender in Matchmaker()
  },
  {
    id: "powertrain",
    kind: "select",
    title: "Any preference on powertrain?",
    subtitle: "Gas, diesel, hybrid, or fully electric.",
    options: POWERTRAINS,
  },
  {
    id: "priceRange",
    kind: "range",
    title: "What's your target price range?",
    subtitle: "Drag both ends to set your range — or leave it wide open.",
  },
  {
    id: "priorities",
    kind: "rank",
    title: "What matters most to you?",
    subtitle: "Drag to reorder — most important at the top.",
  },
];

const POWERTRAIN_COLOR: Record<Powertrain | "", string> = {
  "": "text-zinc-600",
  Gas: "text-zinc-400",
  Diesel: "text-orange-400",
  Hybrid: "text-sky-400",
  Electric: "text-emerald-400",
};

const FAMILY_SCALE: Record<string, number> = {
  "": 1,
  "1-2": 0.85,
  "3-5": 1.05,
  "6+": 1.2,
};

// Buckets the range's midpoint against the same dollar breakpoints the old
// PRICE_RANGES buckets used ($30k/$45k/$60k/$80k) -- reuses those existing,
// still-meaningful thresholds as pure numbers now that there's no discrete
// label to key off. Null (step not yet reached) shows nothing, same as the
// old "" key showing "".
function priceTierForRange(range: PriceRangeValue | null): string {
  if (!range) return "";
  const mid = (Math.min(range.min, PRICE_SLIDER_MAX) + Math.min(range.max, PRICE_SLIDER_MAX)) / 2;
  if (mid < 30000) return "$";
  if (mid < 45000) return "$$";
  if (mid < 60000) return "$$$";
  if (mid < 80000) return "$$$$";
  return "$$$$$";
}

const BODY_PATHS: Record<VehicleType, string> = {
  Sedan: "M10 78 L10 70 Q10 66 14 65 L46 58 L70 34 Q78 26 92 26 L150 26 Q163 26 172 35 L192 58 L226 65 Q230 66 230 70 L230 78 Z",
  Truck: "M10 78 L10 68 Q10 64 14 64 L40 64 L40 34 Q40 26 50 26 L110 26 Q120 26 126 34 L140 64 L226 64 Q230 64 230 70 L230 78 Z",
  SUV: "M10 78 L10 66 Q10 58 18 55 L36 40 Q44 28 60 28 L182 28 Q198 28 206 40 L222 55 Q230 58 230 66 L230 78 Z",
  Hatchback: "M10 78 L10 70 Q10 66 14 65 L46 58 L70 34 Q78 26 92 26 L145 26 Q160 26 168 38 L178 58 L226 62 Q230 63 230 70 L230 78 Z",
  Coupe: "M10 78 L10 72 Q10 69 13 68 L60 62 L92 32 Q100 25 112 25 L150 25 Q160 25 166 33 L184 58 L226 66 Q230 67 230 72 L230 78 Z",
  Convertible: "M10 78 L10 72 Q10 69 13 68 L50 64 L70 50 Q76 45 84 45 L160 45 Q168 45 174 50 L196 64 L226 68 Q230 69 230 72 L230 78 Z",
  Minivan: "M10 78 L10 58 Q10 46 22 42 L38 30 Q48 24 62 24 L184 24 Q196 24 204 32 L220 46 Q230 50 230 62 L230 78 Z",
  "Cargo Van": "M14 78 L14 30 Q14 24 20 24 L222 24 Q228 24 228 30 L228 78 Z",
  // Same front-end language as Sedan/Hatchback (hood + rising windshield),
  // but the roofline stays flat much further back before a short, steep
  // liftgate drop at the rear -- the defining silhouette difference for a
  // wagon vs. a sedan (short trunk) or hatchback (shorter flat roof).
  Wagon: "M10 78 L10 70 Q10 66 14 65 L46 58 L70 34 Q78 26 92 26 L196 26 Q210 26 216 38 L224 58 L228 62 Q230 64 230 70 L230 78 Z",
};

function VehicleBody({ d, className, cargoSeam }: { d: string; className?: string; cargoSeam?: boolean }) {
  return (
    <svg viewBox="0 0 240 110" className={className} fill="currentColor">
      <path d={d} />
      {cargoSeam && (
        <line x1="188" y1="28" x2="188" y2="78" stroke="black" strokeOpacity="0.35" strokeWidth="2" />
      )}
      <circle cx="62" cy="82" r="14" />
      <circle cx="178" cy="82" r="14" />
    </svg>
  );
}

function DefaultSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 110" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6">
      <path d="M10 78 L10 68 Q10 60 18 56 L40 44 L64 30 Q74 24 86 24 L156 24 Q168 24 178 32 L204 50 L226 58 Q230 60 230 66 L230 78 Z" />
      <circle cx="62" cy="82" r="14" />
      <circle cx="178" cy="82" r="14" />
    </svg>
  );
}

function SilhouetteIcon({ vehicleType, className }: { vehicleType: VehicleType | ""; className?: string }) {
  if (!vehicleType) return <DefaultSilhouette className={className} />;
  return (
    <VehicleBody
      d={BODY_PATHS[vehicleType]}
      className={className}
      cargoSeam={vehicleType === "Cargo Van"}
    />
  );
}

function BackArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M8.5 2.5L3 7l5.5 4.5M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DragHandleIcon() {
  return (
    <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor">
      <circle cx="4" cy="4" r="1.6" />
      <circle cx="10" cy="4" r="1.6" />
      <circle cx="4" cy="10" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="4" cy="16" r="1.6" />
      <circle cx="10" cy="16" r="1.6" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 8.5L7 4.5L11 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <path d="M8 1.5l1.9 4.2 4.6.5-3.4 3.2.9 4.6L8 11.8l-4 2.2.9-4.6-3.4-3.2 4.6-.5L8 1.5z" strokeLinejoin="round" />
    </svg>
  );
}

function PriorityRanker({ order, onChange }: { order: string[]; onChange: (next: string[]) => void }) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDragEnter(index: number) {
    setDragOverIndex(index);
    if (dragIndex === null || dragIndex === index) return;
    const next = [...order];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setDragIndex(index);
    onChange(next);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <ol className="space-y-2">
      {order.map((label, index) => {
        const priority = ALL_PRIORITIES.find((p) => p.label === label);
        if (!priority) return null;
        return (
          <li
            key={label}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={handleDragEnd}
            className={`flex cursor-grab items-center gap-3 rounded-2xl border px-4 py-3 transition-colors active:cursor-grabbing ${
              dragOverIndex === index
                ? "border-emerald-500/60 bg-emerald-500/[0.06]"
                : "border-white/10 bg-white/[0.02]"
            }`}
          >
            <span className="shrink-0 text-zinc-600">
              <DragHandleIcon />
            </span>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{priority.label}</div>
              <div className="text-xs text-zinc-500">{priority.clarifier}</div>
            </div>
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                aria-label={`Move ${priority.label} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded p-1 text-zinc-500 transition-colors hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500"
              >
                <ChevronUpIcon />
              </button>
              <button
                type="button"
                aria-label={`Move ${priority.label} down`}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                className="rounded p-1 text-zinc-500 transition-colors hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500"
              >
                <ChevronDownIcon />
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function BuildingVisual({ answers, currentStepId }: { answers: Answers; currentStepId: keyof Answers }) {
  const colorClass = POWERTRAIN_COLOR[answers.powertrain];
  const scale = FAMILY_SCALE[answers.familySize] ?? 1;
  const priceTier = priceTierForRange(answers.priceRange);

  const allChips: { label: string; value: string; stepId: keyof Answers }[] = [
    { label: "Type", value: answers.vehicleType, stepId: "vehicleType" },
    { label: "Use", value: answers.useCase, stepId: "useCase" },
    { label: "Riders", value: answers.familySize, stepId: "familySize" },
    { label: "Powertrain", value: answers.powertrain, stepId: "powertrain" },
    { label: "Budget", value: answers.priceRange ? formatPriceRange(answers.priceRange) : "", stepId: "priceRange" },
  ];
  const chips = allChips.filter((chip) => chip.value);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-xl shadow-black/20">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-400 uppercase">
        Placeholder visual — real artwork coming soon
      </span>

      <div className="relative mt-8 flex h-40 items-center justify-center">
        {priceTier && (
          <span className="absolute top-0 right-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-zinc-300">
            {priceTier}
          </span>
        )}
        <div
          className={`transition-all duration-300 ease-out ${colorClass}`}
          style={{ transform: `scale(${scale})` }}
        >
          <SilhouetteIcon vehicleType={answers.vehicleType} className="h-24 w-52" />
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-zinc-500">
        {chips.length === 0
          ? "Answer the first question to start building your match."
          : "Shape swaps with vehicle type, color with powertrain, size with passengers — building live as you answer."}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {chips.map((chip) => (
          <span
            key={chip.stepId}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              chip.stepId === currentStepId
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-zinc-300"
            }`}
          >
            <span className="text-zinc-500">{chip.label}:</span> {chip.value}
          </span>
        ))}
      </div>
    </div>
  );
}

// Compact pill-button field for the post-questionnaire answer panel --
// same active/inactive styling language as QuestionPanel's "select" step,
// just smaller, so all six answers can sit visibly on screen at once.
function CompactSelectField({
  label,
  options,
  value,
  onSelect,
  emptyMessage,
}: {
  label: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <h4 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">{label}</h4>
      {options.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">{emptyMessage ?? "No options yet."}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.map((option) => {
            const active = value === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelect(option)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                    : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25 hover:bg-white/[0.05]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Live-editable panel shown alongside results once the questionnaire is
// done (item #10) -- reuses PriorityRanker as-is for the drag-to-rank UI
// rather than rebuilding it, and the same pill styling as QuestionPanel's
// select steps, just compact enough to show all six answers at once.
//
// Main Use is deliberately NOT editable here (2026-09-02, Brett's request)
// -- it's a one-time answer from the initial 6-question quiz; the only way
// to change it is Start Over (a fresh search), not a live edit alongside
// results. Every other field (Vehicle Type, Riders, Powertrain, Price
// Range, Priorities) stays live-editable as before. answers.useCase itself
// is untouched by this -- still read by scoring/hard-filters and still
// shown as a read-only chip in ResultsList's answer-summary row, just no
// longer has an edit control here.
function AnswerPanel({
  answers,
  onFieldChange,
  onPriceRangeChange,
  onReorderPriorities,
  onStartOver,
}: {
  answers: Answers;
  onFieldChange: (id: keyof Answers, value: string) => void;
  onPriceRangeChange: (range: PriceRangeValue) => void;
  onReorderPriorities: (order: string[]) => void;
  onStartOver: () => void;
}) {
  const allowSixPlus = answers.vehicleType ? LARGE_CAPACITY_VEHICLE_TYPES.includes(answers.vehicleType) : false;
  const familySizeOptions = FAMILY_SIZES.filter((size) => size !== "6+" || allowSixPlus);

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-xl shadow-black/20">
      <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Your answers</h3>
      <p className="mt-1 text-xs text-zinc-500">Change anything below — the list updates live.</p>

      <CompactSelectField
        label="Vehicle type"
        options={VEHICLE_TYPES}
        value={answers.vehicleType}
        onSelect={(v) => onFieldChange("vehicleType", v)}
      />
      <CompactSelectField
        label="Riders"
        options={familySizeOptions}
        value={answers.familySize}
        onSelect={(v) => onFieldChange("familySize", v)}
      />
      <CompactSelectField
        label="Powertrain"
        options={POWERTRAINS}
        value={answers.powertrain}
        onSelect={(v) => onFieldChange("powertrain", v)}
      />
      <div className="mt-4">
        <h4 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Price range</h4>
        <div className="mt-3">
          <PriceRangeSlider value={answers.priceRange} onChange={onPriceRangeChange} />
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Priorities</h4>
        <p className="mt-1 text-xs text-zinc-500">Drag to reorder — most important at the top.</p>
        <div className="mt-3">
          <PriorityRanker order={answers.priorities} onChange={onReorderPriorities} />
        </div>
      </div>

      <button
        type="button"
        onClick={onStartOver}
        className="mt-6 w-full rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/10"
      >
        Start Over
      </button>
    </div>
  );
}

function QuestionPanel({
  step,
  stepIndex,
  totalSteps,
  value,
  rankedValues,
  priceRangeValue,
  onSelect,
  onPriceRangeChange,
  onReorderPriorities,
  onBack,
  onContinue,
}: {
  step: Step;
  stepIndex: number;
  totalSteps: number;
  value: string;
  rankedValues: string[];
  priceRangeValue: PriceRangeValue | null;
  onSelect: (value: string) => void;
  onPriceRangeChange: (range: PriceRangeValue) => void;
  onReorderPriorities: (order: string[]) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-xl shadow-black/20 sm:p-8">
      <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        <span>
          Question {stepIndex + 1} of {totalSteps}
        </span>
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-zinc-400 normal-case transition-colors hover:text-white"
          >
            <BackArrow /> Back
          </button>
        )}
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {step.title}
      </h2>
      {step.subtitle && <p className="mt-2 text-sm text-zinc-400">{step.subtitle}</p>}

      {step.kind === "select" && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {step.options?.map((option) => {
            const active = value === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelect(option)}
                className={`rounded-2xl border px-5 py-4 text-left text-sm font-semibold transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                    : "border-white/10 bg-white/[0.02] text-zinc-200 hover:border-white/25 hover:bg-white/[0.05]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      {step.kind === "range" && (
        <div className="mt-8">
          <PriceRangeSlider value={priceRangeValue} onChange={onPriceRangeChange} />
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={onContinue}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step.kind === "rank" && (
        <div className="mt-8">
          <PriorityRanker order={rankedValues} onChange={onReorderPriorities} />
          <div className="mt-6 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-xs text-zinc-500">Drag the grip, or use the arrows, to reorder.</p>
            <button
              type="button"
              onClick={onContinue}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Full always-visible ranking-indicator list (Step H3, replacing the
// Step E compact dot/abbreviation row entirely -- approved 2026-09-02,
// see data/matchmaker-full-indicator-list-plan-2026-09-02.md). No more
// compact/expandable toggle: every card shows all `limit` top-ranked
// priorities as their own row, each with a real per-dimension data point
// (dimensionDataPoint()) alongside the same colored Excellent/Good/Below
// average/No data pill the detail modal already uses (INDICATOR_CLASSES/
// INDICATOR_LEVEL_LABEL) -- reused verbatim rather than inventing a
// second visual language for the same 4 levels. Never infer color from
// the score alone -- gray (no data) always wins regardless of the
// numeric value, per dimensionIndicator's own contract.
//
// Shared by the card's list (sliced to top 5) and the detail modal's
// full breakdown (Step F) -- both read the same personalizedDimensionOrder
// and dimensionDataPoint, so they can't silently drift on ordering or
// wording.
function DimensionDetailList({
  vehicle,
  priorities,
  limit,
}: {
  vehicle: MatchmakerVehicle;
  priorities: string[];
  limit: number;
}) {
  const order = personalizedDimensionOrder(vehicle.bodyStyle, priorities).slice(0, limit);
  return (
    <ul className="mt-3 space-y-1.5">
      {order.map((label) => {
        const score = vehicle.scores[label] ?? 0;
        const hasData = vehicle.hasData[label] ?? false;
        const level = dimensionIndicator(score, hasData);
        const dataPoint = dimensionDataPoint(vehicle, label, level);
        return (
          <li key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-300">{label}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-zinc-500">{dataPoint}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${INDICATOR_CLASSES[level]}`}
              >
                {INDICATOR_LEVEL_LABEL[level]}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// One card per MODEL (make + model), not per trim row -- results-card
// redesign approved 2026-09-02 (see
// data/matchmaker-duplicate-investigation-and-grouping-plan-2026-09-02.md,
// Part 2). Price/rationale/badges/action buttons always operate on
// whichever trim is currently "active" within the card: group.headline
// (the highest scorer) by default, or whatever the customer picked from
// the trim selector.
//
// Dismiss stays PER-TRIM (Brett's original correction, 2026-09-02),
// keyed by the active trim's own id. The wrinkle this creates: dismissing
// the currently-active trim needs the card to fall back to whichever
// non-dismissed trim now scores highest, not keep showing (or hide
// behind) a trim that's gone. Handled without any extra effect/reset
// logic -- see `activeVariant` below -- because dismissed vehicles are
// filtered OUT of the raw list *before* groupByModel runs (in
// Matchmaker()), so `group` itself, `group.headline`, and `group.variants`
// here are already the correct post-dismiss values on every render; a
// group with zero non-dismissed variants simply never gets built, so a
// fully-dismissed model's card disappears with no special-casing.
//
// Flag is now GROUP-level, not per-trim (Step B of the approved
// comparison-view plan, 2026-09-02, superseding the original per-trim
// design) -- flagging attaches to the make/model the card represents, not
// whichever trim happened to be toggled active at the time. `flagKey`
// and `isFlagged` are both computed by the caller (ResultsList) and
// passed straight through as props, rather than derived here from
// `activeVariant.id` -- this is also what fixes a real quirk the old
// per-trim design had: previously, switching the card's trim toggle to a
// different (unflagged-looking) trim made the emerald highlight vanish
// even though the group itself was still flagged and still sorted to the
// top. Now the whole card's flagged-ness is independent of which trim is
// currently displayed.
function ModelGroupCard({
  group,
  flagKey,
  isFlagged,
  compareLimitReached,
  position,
  priorities,
  onDismiss,
  onToggleFlag,
  onOpenInfo,
}: {
  group: ModelGroup;
  // Qualified group identity for flagging -- `${group.key}::primary` or
  // `${group.key}::alt:${powertrain}`, built by modelGroupFlagKey() below
  // and passed down by ResultsList. Qualified by segment (not just raw
  // group.key) because a single model can legitimately produce two
  // separate ModelGroup objects sharing the same key -- e.g. a Tucson
  // sold as both Gas (primary) and Hybrid (an alternative-powertrain
  // card) -- and without the qualifier, flagging one would silently flag
  // the other, visually distinct card too.
  flagKey: string;
  isFlagged: boolean;
  // Step C (approved plan) -- true once FLAG_CAP is already reached.
  // Only disables the button for a card that ISN'T already flagged (an
  // already-flagged card must always stay clickable, so the customer can
  // still unflag it even at cap -- cap only blocks NEW flags).
  compareLimitReached: boolean;
  // 1-based rank within the primary results list (2026-09-02, Brett's
  // request) -- undefined for "Other powertrains worth a look" cards,
  // which stay unnumbered per instruction. Reflects the group's CURRENT
  // position in the already-dismiss-filtered, already-sorted list passed
  // down from ResultsList, so it recomputes for free on every dismiss --
  // no separate "was this slot backfilled" tracking needed, same principle
  // as the per-trim headline recompute above.
  position?: number;
  priorities: string[];
  onDismiss: (id: string) => void;
  onToggleFlag: (candidate: FlaggedGroup) => void;
  onOpenInfo: (id: string) => void;
}) {
  const [searchClicked, setSearchClicked] = useState(false);
  // Sticky manual trim selection -- null until the customer picks
  // something from the selector. Recomputed as a plain fallback on every
  // render rather than tracked via an effect: if the manually-picked id
  // is no longer present in group.variants (dismissed, most commonly),
  // this falls straight back to group.headline with no stale reference.
  const [manualTrimId, setManualTrimId] = useState<string | null>(null);
  const activeVariant =
    group.variants.find((v) => v.id === manualTrimId) ?? group.headline;

  const priceEstimate = formatPriceEstimate(activeVariant.trueStartingPriceCents);

  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl border p-6 shadow-xl shadow-black/20 transition-colors sm:flex-row sm:items-start sm:justify-between ${
        isFlagged
          ? "border-emerald-500/40 bg-emerald-500/[0.06]"
          : "border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3 sm:block">
          <div className="flex items-center gap-2.5">
            {position !== undefined && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                {position}
              </span>
            )}
            <h3 className="text-lg font-semibold text-white">
              {group.make} {group.model}
            </h3>
          </div>
          <span className="shrink-0 text-sm font-semibold text-emerald-400 sm:hidden">
            {priceEstimate}
          </span>
        </div>

        {/* Trim/drivetrain list -- only shown when there's more than one
            variant to choose between (a single-trim group has nothing to
            toggle). Replaced the native <select> with clickable list
            items (2026-09-02, Brett's request) -- same underlying
            mechanic (one active trim at a time, driving price/rationale/
            indicator display and which vehicle "More info" opens), same
            per-item info (trim -- drivetrain -- price) as the dropdown
            options it replaces, just a different control. No
            special-casing by trim count -- real per-model trim counts
            range from 2 to 31 (Ram ProMaster), and that card is expected
            to render tall as a result, per instruction. Trim + drivetrain
            always both shown (not conditionally), since 38 of 308 real
            model groups have at least one repeated trim label where
            drivetrain is the only disambiguator (e.g. Alfa Romeo Giulia
            Base AWD vs. RWD). */}
        {group.variants.length > 1 ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {group.variants.map((v) => {
              const active = v.id === activeVariant.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setManualTrimId(v.id)}
                  aria-pressed={active}
                  className={`rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                    active
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:bg-white/[0.05] hover:text-zinc-200"
                  }`}
                >
                  {v.trim} — {v.drivetrain ?? "—"} — {formatPriceEstimate(v.trueStartingPriceCents)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">
            {activeVariant.trim}
            {activeVariant.drivetrain ? ` · ${activeVariant.drivetrain}` : ""}
          </p>
        )}

        {/* Body-style/fuel-type badges removed (2026-09-02, Brett's
            request) -- body style is always redundant (a hard filter,
            every result matches it). Fuel type is normally redundant
            here too, but is NOT redundant on "Other powertrains worth a
            look" cards specifically, since those intentionally show a
            different powertrain than what was searched for -- flagged
            explicitly, proceeding with full removal per instruction. If
            that turns out to lose a signal worth having back, it's only
            needed on the alternatives section, not here. */}
        {/* The old single-line auto-generated rationale sentence (e.g.
            "Tows up to 8,400 lbs.") was removed here (2026-09-02) --
            redundant with the always-visible indicator list below, which
            already surfaces the same kind of data point per dimension
            with added color context. buildRationale() itself was deleted
            from matchmaker-vehicle-display.ts, confirmed via grep to have
            no other callers. */}
        <DimensionDetailList vehicle={activeVariant} priorities={priorities} limit={5} />
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-52">
        <span className="hidden text-right text-sm font-semibold text-emerald-400 sm:block">
          {priceEstimate}
        </span>
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          <button
            type="button"
            onClick={() => onDismiss(activeVariant.id)}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            Not interested
          </button>
          <button
            type="button"
            onClick={() => onOpenInfo(activeVariant.id)}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-sky-400/40 hover:text-sky-300"
          >
            More info
          </button>
          <button
            type="button"
            onClick={() =>
              onToggleFlag({ flagKey, make: group.make, model: group.model, trimId: activeVariant.id })
            }
            // Step C (approved plan, cap-UI approach (a)) -- disabled
            // proactively once at cap, rather than staying clickable and
            // showing a message after the fact. `disabled` blocks the
            // click from ever firing (no need to also guard inside
            // onClick), and only applies when this specific card ISN'T
            // already flagged -- an already-flagged card must stay
            // clickable so the customer can still unflag it at cap.
            disabled={!isFlagged && compareLimitReached}
            aria-pressed={isFlagged}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/15 disabled:hover:text-zinc-300 ${
              isFlagged
                ? "border-amber-400 bg-amber-400/10 text-amber-300"
                : "border-white/15 text-zinc-300 hover:border-amber-400/40 hover:text-amber-300"
            }`}
          >
            <StarIcon filled={isFlagged} />
            {isFlagged ? "Flagged" : compareLimitReached ? "Compare limit reached" : "Flag"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setSearchClicked(true)}
          className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          Start My Search
        </button>
        {searchClicked && (
          <p className="text-center text-xs text-zinc-500">
            Placeholder — this will kick off your real search once the intake filter connects.
          </p>
        )}
      </div>
    </div>
  );
}

// Persistent results pane (item #10) -- dismissed/flagged state and the
// live fit-sorted list live in Matchmaker() now, since the AnswerPanel
// sitting alongside this needs to trigger the same re-sort on every edit.
// No "Start Over" here anymore -- that moved into AnswerPanel, secondary to
// editing individual fields directly.
type AlternativeCard = { powertrain: Powertrain; label: string; group: ModelGroup };

// Comparison view (Step B, approved plan 2026-09-02, see
// data/matchmaker-comparison-view-plan-2026-09-02.md) -- one flagged
// MODEL GROUP, capped at 5 at a time (FLAG_CAP in Matchmaker()). `make`/
// `model` are stored directly (not parsed back out of `flagKey`) so a
// later comparison view can resolve "which model is this" without any
// fragile string-splitting -- a small addition beyond the plan doc's
// literal {flagKey, trimId} shape, made because Step D will need it and
// storing it now costs nothing. `trimId` is only the STARTING point (the
// trim that happened to be active at the moment of flagging) -- not kept
// in sync afterward, per the plan.
type FlaggedGroup = {
  flagKey: string;
  make: string;
  model: string;
  trimId: string;
};

// Qualified flag identity, shared by ResultsList (computing each card's
// own flagKey prop) and Matchmaker()'s sort logic (checking whether a
// just-built group is currently flagged) -- ONE builder, used identically
// by both, so the two can never drift apart on the exact string format.
// Qualified by segment (not just raw ModelGroup.key) because a single
// model can legitimately produce two separate ModelGroup objects sharing
// the same key -- e.g. a Tucson sold as both Gas (primary) and Hybrid (an
// alternative-powertrain card) -- and without the qualifier, flagging one
// would silently flag the other, visually distinct card too.
function modelGroupFlagKey(groupKey: string, segmentTag: string): string {
  return `${groupKey}::${segmentTag}`;
}
const PRIMARY_SEGMENT_TAG = "primary";
function alternativeSegmentTag(powertrain: Powertrain): string {
  return `alt:${powertrain}`;
}

// Maximum flagged models at once (confirmed-design item 2, approved plan).
// Attempting to flag a 6th is blocked with no auto-bump of the oldest --
// see toggleFlag() in Matchmaker().
const FLAG_CAP = 5;

// Primary list is capped at the top 5 by default, with a "Show more" button
// revealing up to 10 total -- a hard cap, not an infinitely-repeating load
// more (2026-09-02, Brett's request). `primary` arrives here already
// dismiss-filtered and flag/score-sorted (Matchmaker()'s
// groupWithDismissAndFlagSort), so slicing to the top N is always "the N
// current best available options" -- when a numbered card is dismissed,
// Matchmaker() recomputes `primary` without it, this component re-renders
// with the new array, and the slice naturally includes whatever was
// previously position 6 (or beyond) with zero extra bookkeeping -- the same
// "recompute from the filtered source on every render" principle as the
// per-trim headline recompute and the model-group backfill above it.
const PRIMARY_INITIAL_COUNT = 5;
const PRIMARY_MAX_COUNT = 10;

function ResultsList({
  answers,
  primary,
  alternatives,
  flaggedKeys,
  compareLimitReached,
  onDismiss,
  onToggleFlag,
  onOpenInfo,
  onRestoreAll,
  anyDismissed,
}: {
  answers: Answers;
  primary: ModelGroup[];
  alternatives: AlternativeCard[];
  // Just the flagKeys, not the full FlaggedGroup[] -- ResultsList only
  // ever needs a yes/no "is this card flagged" check per card, never the
  // stored make/model/trimId, so a Set<string> keeps this component (and
  // ModelGroupCard below it) from needing to know the FlaggedGroup shape
  // at all.
  flaggedKeys: Set<string>;
  compareLimitReached: boolean;
  onDismiss: (id: string) => void;
  onToggleFlag: (candidate: FlaggedGroup) => void;
  onOpenInfo: (id: string) => void;
  onRestoreAll: () => void;
  anyDismissed: boolean;
}) {
  // Local, not lifted to Matchmaker() -- ResultsList only unmounts (and
  // this resets) on Start Over (the `done` ternary in Matchmaker()), which
  // is the right moment for a fresh 5/10 view; editing an answer alongside
  // the list re-renders this same component instance, so an already-
  // expanded view intentionally stays expanded rather than jarringly
  // re-collapsing.
  const [showMore, setShowMore] = useState(false);
  const visibleCount = showMore ? PRIMARY_MAX_COUNT : PRIMARY_INITIAL_COUNT;
  const displayedPrimary = primary.slice(0, visibleCount);
  const remainingToReveal = Math.min(primary.length, PRIMARY_MAX_COUNT) - PRIMARY_INITIAL_COUNT;
  const canShowMore = !showMore && remainingToReveal > 0;

  const answerChips = [
    answers.vehicleType,
    answers.useCase,
    answers.familySize,
    answers.powertrain,
    answers.priceRange ? formatPriceRange(answers.priceRange) : "",
  ].filter(Boolean);

  const hasAnyResults = primary.length > 0 || alternatives.length > 0;

  return (
    <div>
      <div>
        {/* PROPOSED customer-facing copy, pending explicit sign-off -- see
            build notes. "Mock" was accurate for the old hand-curated/
            derived-heuristic dataset; this is real researched vehicle
            data now, just not live dealer inventory yet. */}
        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium tracking-wide text-emerald-400 uppercase">
          Real vehicle data — not live inventory
        </span>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Here&apos;s what we&apos;d search for
        </h2>
        <p className="mt-3 text-lg text-zinc-400">
          Dismiss what doesn&apos;t fit, flag what does — this narrows the list live.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Sorted by how well each vehicle matches what matters most to you. Edit any answer
          alongside the list to re-sort instantly.
        </p>
        <p className="mt-1 text-xs text-zinc-500">{RATINGS_DISCLAIMER}</p>
        {answerChips.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {answerChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-300"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>

      {hasAnyResults ? (
        <>
          {primary.length > 0 && (
            <div className="mt-8 flex flex-col gap-4">
              {displayedPrimary.map((group, index) => {
                const flagKey = modelGroupFlagKey(group.key, PRIMARY_SEGMENT_TAG);
                return (
                  <ModelGroupCard
                    key={group.key}
                    group={group}
                    flagKey={flagKey}
                    isFlagged={flaggedKeys.has(flagKey)}
                    compareLimitReached={compareLimitReached}
                    position={index + 1}
                    priorities={answers.priorities}
                    onDismiss={onDismiss}
                    onToggleFlag={onToggleFlag}
                    onOpenInfo={onOpenInfo}
                  />
                );
              })}
              {canShowMore && (
                <button
                  type="button"
                  onClick={() => setShowMore(true)}
                  className="self-center rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Show {remainingToReveal} more
                </button>
              )}
            </div>
          )}

          {alternatives.length > 0 && (
            <div className="mt-10">
              <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                Other powertrains worth a look
              </h3>
              <div className="mt-4 flex flex-col gap-6">
                {alternatives.map((alt) => {
                  const flagKey = modelGroupFlagKey(alt.group.key, alternativeSegmentTag(alt.powertrain));
                  return (
                    <div key={alt.powertrain}>
                      <p className="mb-2 text-xs font-semibold tracking-wide text-emerald-400 uppercase">
                        {alt.label}
                      </p>
                      <ModelGroupCard
                        group={alt.group}
                        flagKey={flagKey}
                        isFlagged={flaggedKeys.has(flagKey)}
                        compareLimitReached={compareLimitReached}
                        priorities={answers.priorities}
                        onDismiss={onDismiss}
                        onToggleFlag={onToggleFlag}
                        onOpenInfo={onOpenInfo}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : anyDismissed ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <p className="text-lg font-semibold text-white">You dismissed everything.</p>
          <p className="mt-2 text-sm text-zinc-400">Restore the list, or adjust your answers alongside it.</p>
          <button
            type="button"
            onClick={onRestoreAll}
            className="mt-6 rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Restore All
          </button>
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <p className="text-lg font-semibold text-white">No matches for these answers yet.</p>
          <p className="mt-2 text-sm text-zinc-400">
            Try widening your price range or riders — adjust any answer alongside the list.
          </p>
        </div>
      )}

      <div className="mt-10 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center sm:p-10">
        <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {flaggedKeys.size > 0 ? "Found the one (or a few)?" : "See something you like?"}
        </h3>
        <p className="mt-2 text-sm text-zinc-400">
          Get started and we&apos;ll build your real search — make, model, trim, and color.
        </p>
        <GetStartedButton className="mt-6 inline-flex items-center justify-center rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400">
          Get Started
        </GetStartedButton>
      </div>
    </div>
  );
}

// Compare bar (Step C, approved plan) -- a small persistent floating
// trigger, visible once 2+ models are flagged (confirmed-design item 1).
// Deliberately NOT the same sticky-panel pattern removed from AnswerPanel
// earlier in this project -- that was a tall, page-length element that
// caused real problems; this is a small fixed pill in a corner, a
// different risk profile, confirmed with Brett before building.
//
// Portaled to document.body -- found during this step's own verification,
// not assumed up front: a `fixed`-positioned element nested inside
// drive-transition-provider.tsx's will-change-transform wrapper around
// <main> gets a new containing block from that wrapper instead of the
// real viewport, so it renders trapped/off-position rather than pinned to
// the corner. Same root cause already documented and fixed the same way
// for mobile-nav-menu.tsx and VehicleDetailModal.
//
// Opens ComparisonModal on click (Step D) -- the Step C placeholder
// click-note is gone now that there's an actual modal for it to open.
function CompareBar({ count, onClick }: { count: number; onClick: () => void }) {
  return createPortal(
    <div className="fixed right-6 bottom-6 z-40">
      <button
        type="button"
        onClick={onClick}
        className="rounded-full bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-zinc-950 shadow-xl shadow-black/40 transition-colors hover:bg-emerald-400"
      >
        Compare ({count})
      </button>
    </div>,
    document.body,
  );
}

// One dimension isn't universally scored -- Towing & Payload only exists
// for Truck/SUV/Cargo Van (TOWING_PAYLOAD_VEHICLE_TYPES), unlike Resale
// Value, which the scoring pipeline computes for every body style
// regardless of whether it's offered as a rankable priority (confirmed
// against the real dataset, see CLAUDE.md). This is a genuinely different
// case from "applicable but missing data" (hasData === false, rendered as
// the normal gray "No data" pill) -- a Sedan doesn't have a towing spec to
// be missing, the dimension just doesn't apply to it at all. Only this one
// row/dimension combination needs the distinction; every other row is
// scored for every body style.
function isDimensionApplicable(vehicle: MatchmakerVehicle, label: string): boolean {
  if (label === "Towing & Payload") {
    return TOWING_PAYLOAD_VEHICLE_TYPES.includes(vehicle.bodyStyle);
  }
  return true;
}

// Comparison table column -- one per flagged model group, resolved from
// the raw `vehicles` prop (never `matched`), matching Part 2's resolution-
// source decision: a flagged vehicle must stay comparable even after an
// unrelated answer change would otherwise drop it from the answers-
// filtered list. `variants` is the model's FULL trim list across every
// powertrain (getAllVariantsForModel -- same cross-powertrain function
// VehiclePickerFlow uses for "+ Add vehicle"), not scoped to the segment
// the vehicle was originally flagged/added under.
//
// Deliberately changed from a powertrain-scoped derivation (2026-09-01) --
// that made the in-modal trim switcher inconsistent with the "+ Add
// vehicle" picker one column over: picking a PHEV trim during add showed
// every powertrain, but switching trims on an already-added column only
// ever showed that one powertrain again. The old powertrain-scoped
// derivation (matchmaker-scoring.ts's since-deleted getModelVariants) had
// exactly one caller -- this exact spot -- so switching it out was a
// fully isolated change: ModelGroupCard's own trim switcher on the main
// results list never called it, and stays deliberately untouched here.
// It only ever receives `group.variants`, built by groupByModel()/
// segmentByPowertrain() from the answers-driven segmented pipeline --
// powertrain-scoped grouping there is what makes "Other powertrains worth
// a look" meaningful (a Gas Tucson and a Hybrid Tucson are intentionally
// two separate cards), so it stays exactly as it was.
type ComparisonColumn = {
  flagKey: string;
  make: string;
  model: string;
  activeVehicle: MatchmakerVehicle;
  variants: MatchmakerVehicle[];
  // Only show powertrain in each trim row's label when this column's
  // variant set actually spans more than one -- same convention
  // VehiclePickerFlow already uses for the identical reason.
  showPowertrainInLabel: boolean;
};

// ComparisonModal (Step D, approved plan) -- full-screen overlay (same
// opaque-fill convention as mobile-nav-menu.tsx, not VehicleDetailModal's
// translucent backdrop, since a comparison table needs the room), a
// horizontally-scrollable table inside, capped at FLAG_CAP columns so it
// never needs vertical-only fallback logic. Portaled to document.body for
// the same drive-transition-provider.tsx stacking-context reason as
// CompareBar/VehicleDetailModal/mobile-nav-menu.
//
// Trim selection per column is lifted to Matchmaker() (selectedTrimIds),
// not local state here -- so switching a trim mid-comparison survives a
// close/reopen of the modal, same expectation as every other live-editable
// piece of this page.
function ComparisonModal({
  flaggedGroups,
  vehicles,
  priorities,
  selectedTrimIds,
  onSelectTrim,
  onRemove,
  onAddVehicle,
  onClose,
}: {
  flaggedGroups: FlaggedGroup[];
  vehicles: MatchmakerVehicle[];
  priorities: string[];
  selectedTrimIds: Record<string, string>;
  onSelectTrim: (flagKey: string, trimId: string) => void;
  onRemove: (flagKey: string) => void;
  // Step D, approved plan -- available regardless of entry path, since
  // nothing about "+ Add vehicle" is standalone-specific once a
  // comparison already exists.
  onAddVehicle: (vehicle: MatchmakerVehicle) => void;
  onClose: () => void;
}) {
  // Whether the inline VehiclePickerFlow is currently showing in place of
  // the table -- local to the modal, not lifted to Matchmaker(), since
  // nothing outside this modal ever needs to know "is the add-picker
  // open." Reset is implicit: closing/reopening the modal (a full
  // ComparisonModal unmount/remount, since it's only ever rendered while
  // `comparisonOpen` is true) naturally starts this fresh at false.
  const [addingVehicle, setAddingVehicle] = useState(false);

  const columns: ComparisonColumn[] = flaggedGroups
    .map((candidate) => {
      const originVehicle = vehicles.find((v) => v.id === candidate.trimId);
      if (!originVehicle) return null;
      // MY2027 support (2026-09-01): scoped to the origin vehicle's own
      // model year, not every year the model spans -- otherwise a flagged
      // 2026 trim's own switcher would show 2027 trims mixed in the same
      // flat list the instant a second year existed for this model.
      const variants = getAllVariantsForModel(vehicles, candidate.make, candidate.model, originVehicle.modelYear);
      const selectedId = selectedTrimIds[candidate.flagKey] ?? candidate.trimId;
      const activeVehicle = variants.find((v) => v.id === selectedId) ?? originVehicle;
      const showPowertrainInLabel = new Set(variants.map((v) => v.fuelType)).size > 1;
      return {
        flagKey: candidate.flagKey,
        make: candidate.make,
        model: candidate.model,
        activeVehicle,
        variants,
        showPowertrainInLabel,
      };
    })
    .filter((column): column is ComparisonColumn => column !== null);

  const rows = comparisonRowOrder(
    priorities,
    columns.map((column) => column.activeVehicle),
  );

  // Column-width scheme (this task) -- previously every <th>, including
  // the "+ Add vehicle" tile, shared the same min-w-[220px], so the tile
  // claimed an equal share of the table's width alongside real vehicle
  // columns, wasting space especially at 2-3 vehicles. Now the sticky
  // label column and the Add tile both get a small FIXED width, and real
  // vehicle columns split whatever's left evenly -- narrower as more are
  // added, wider with fewer, while the Add tile stays a constant size
  // throughout. This needs `table-layout: fixed` (Tailwind `table-fixed`)
  // plus an explicit `width` on each cell of the table's first row (the
  // <thead> row) -- under fixed layout, only the FIRST row's widths are
  // read; every other row's cells automatically inherit the same column
  // widths with no styling of their own needed, so the <tbody> cells below
  // are untouched.
  const LABEL_COLUMN_WIDTH_PX = 160; // keep in sync with the sticky th's `w-40` below
  const ADD_TILE_COLUMN_WIDTH_PX = 140;
  const showAddTile = columns.length < FLAG_CAP;
  const realColumnWidth = `calc((100% - ${LABEL_COLUMN_WIDTH_PX}px${
    showAddTile ? ` - ${ADD_TILE_COLUMN_WIDTH_PX}px` : ""
  }) / ${columns.length})`;

  // Quick-duplicate shortcuts (MY2027 plan Part 3, this task) -- one per
  // current column, rendered below the "+ Add vehicle" tile, sharing its
  // showAddTile cap gate (once at FLAG_CAP, neither renders -- no separate
  // cap logic needed, addFlaggedGroup's own cap check is still the real
  // source of truth regardless). Bypasses the Body Style -> Make -> Model
  // flow entirely: reuses the exact same auto-select-highest-scoring-trim
  // mechanism VehiclePickerFlow uses for any other add ("Auto-select
  // applies the same as any other add," per the approved plan) and the
  // exact same onAddVehicle path "+ Add vehicle" already uses -- no new
  // state-management function needed, since addFlaggedGroup/
  // addVehicleToComparison already handle a genuine duplicate make/model/
  // year with a guaranteed-unique flagKey.
  //
  // Matches the ORIGINAL column's model year exactly
  // (column.activeVehicle.modelYear), not whichever year the customer
  // might pick from scratch -- safe and unambiguous once Part 1 landed,
  // since every variant in a column's own switcher already shares one
  // year by construction. Priority order for the auto-select is the
  // duplicated vehicle's own body style's neutral default
  // (defaultPriorityOrder), same as every other auto-select in this
  // feature -- ComparisonModal has no "picker body style" state of its
  // own to read, and reusing the active vehicle's real body style is the
  // same source VehiclePickerFlow effectively uses too.
  function duplicateColumn(column: ComparisonColumn) {
    const variants = getAllVariantsForModel(vehicles, column.make, column.model, column.activeVehicle.modelYear);
    const headline = pickHighestScoringVariant(variants, defaultPriorityOrder(column.activeVehicle.bodyStyle));
    onAddVehicle(headline);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950" onClick={onClose}>
      <div
        className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white">Comparing {columns.length} vehicles</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comparison"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6" onClick={(e) => e.stopPropagation()}>
        {addingVehicle ? (
          <div className="mx-auto max-w-2xl">
            <VehiclePickerFlow
              vehicles={vehicles}
              onSelect={(vehicle) => {
                onAddVehicle(vehicle);
                setAddingVehicle(false);
              }}
              onCancel={() => setAddingVehicle(false)}
            />
          </div>
        ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-40 min-w-40 bg-zinc-950" />
                {columns.map((column) => (
                  <th
                    key={column.flagKey}
                    style={{ width: realColumnWidth }}
                    className="min-w-[160px] px-4 pb-4 text-left align-top"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {column.make} {column.model}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-emerald-400">
                          {formatPriceEstimate(column.activeVehicle.trueStartingPriceCents)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(column.flagKey)}
                        aria-label={`Remove ${column.make} ${column.model} from comparison`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <CloseIcon size={12} />
                      </button>
                    </div>

                    {column.variants.length > 1 && (
                      <div className="mt-3 flex flex-col gap-1">
                        {column.variants.map((variant) => {
                          const active = variant.id === column.activeVehicle.id;
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => onSelectTrim(column.flagKey, variant.id)}
                              aria-pressed={active}
                              className={`rounded-lg border px-2 py-1 text-left text-[11px] font-medium transition-colors ${
                                active
                                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                                  : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:bg-white/[0.05] hover:text-zinc-200"
                              }`}
                            >
                              {variant.trim} — {variant.drivetrain ?? "—"}
                              {column.showPowertrainInLabel ? ` — ${variant.fuelType ?? "—"}` : ""}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </th>
                ))}
                {showAddTile && (
                  <th className="w-[140px] px-2 pb-4 align-top">
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setAddingVehicle(true)}
                        className="flex h-[72px] w-full items-center justify-center rounded-2xl border border-dashed border-white/15 text-xs font-semibold text-zinc-400 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/[0.04] hover:text-emerald-300"
                      >
                        + Add vehicle
                      </button>
                      {columns.map((column) => (
                        <button
                          key={`duplicate-${column.flagKey}`}
                          type="button"
                          onClick={() => duplicateColumn(column)}
                          title={`Duplicate ${column.make} ${column.model} (${column.activeVehicle.modelYear})`}
                          className="truncate rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5 text-left text-[11px] font-medium text-zinc-400 transition-colors hover:border-white/25 hover:bg-white/[0.05] hover:text-zinc-200"
                        >
                          Duplicate {column.make} {column.model} ({column.activeVehicle.modelYear})
                        </button>
                      ))}
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((label) => (
                <tr key={label} className="border-t border-white/5">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 w-40 min-w-40 bg-zinc-950 py-3 pr-4 text-left align-top text-xs font-semibold text-zinc-400"
                  >
                    {label}
                  </th>
                  {columns.map((column) => {
                    if (!isDimensionApplicable(column.activeVehicle, label)) {
                      return (
                        <td key={column.flagKey} className="px-4 py-3 align-top text-sm text-zinc-600">
                          —
                        </td>
                      );
                    }
                    const score = column.activeVehicle.scores[label] ?? 0;
                    const hasData = column.activeVehicle.hasData[label] ?? false;
                    const level = dimensionIndicator(score, hasData);
                    const dataPoint = dimensionDataPoint(column.activeVehicle, label, level);
                    return (
                      <td key={column.flagKey} className="px-4 py-3 align-top">
                        <div className="flex flex-col items-start gap-1.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${INDICATOR_CLASSES[level]}`}
                          >
                            {INDICATOR_LEVEL_LABEL[level]}
                          </span>
                          <span className="text-xs text-zinc-500">{dataPoint}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-xs text-zinc-500">{RATINGS_DISCLAIMER}</p>
        </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// --- Standalone Comparison Tool: shared picker flow (Step B, approved
// plan 2026-09-01; Trim step removed as a follow-up, 2026-09-01; model-year
// step added for MY2027 support, 2026-09-01) -----------------------------
//
// Body Style -> Make -> Model -> (Model Year, only when the model has more
// than one), reading directly from the raw `vehicles` prop via the Step A
// derivations -- never `matched`/`answers`, same resolution-source
// principle as the rest of the comparison feature. Shared by both the
// standalone entry point's 2-vehicle bootstrap and ComparisonModal's
// "+ Add vehicle" action (Steps C/D): built once here as a self-contained,
// portal-agnostic content block that only renders its own step content,
// never a modal/portal itself -- each caller decides how to contain it (a
// full page section for the standalone entry, layered inside the
// already-portaled ComparisonModal for "+ Add vehicle").
//
// No separate Trim step (removed as a follow-up, 2026-09-01) -- picking a
// Model (or a Model Year, when that step shows) auto-selects the
// highest-scoring trim for that specific make+model+year
// (pickHighestScoringVariant, matchmaker-scoring.ts) and calls onSelect
// immediately, the same "headline trim" concept ModelGroupCard already
// uses elsewhere. The customer adjusts which specific trim is actually
// shown afterward via the comparison column's own trim switcher
// (getAllVariantsForModel), not during picking -- one fewer click for the
// common case, and it's what makes it possible to pick the same model
// twice (see addFlaggedGroup/directSegmentTag below) and then diverge each
// resulting column to a different trim.
//
// Model Year step (MY2027 support, 2026-09-01): only shown when
// getModelYearsForMakeAndModel finds more than one year for the picked
// make+model -- a single-year model (every real model today) skips it
// entirely, matching the exact behavior that existed before this step was
// added. Not a trim list -- just a "which year" choice, same "auto-select
// the headline trim once the specific make+model+year is known" behavior
// as the plain Model step. Generalized to however many years actually
// exist (`years.map(...)`), not hardcoded to exactly two -- costs nothing
// extra today (there will only ever be two in practice for the foreseeable
// future) and keeps working with no revisit if a third year ever lands.
//
// No Powertrain step either (original approved plan, investigation
// finding 2) -- getAllVariantsForModel (used both for auto-picking here
// and for each comparison column's own trim switcher) spans every
// powertrain a Make+Model+Year has, so there's nothing to pre-select.
//
// Make/Model both use the clickable-list style, not a pill grid --
// confirmed against real data during Step A that several body styles' make
// counts (SUV 33, Sedan 19, Truck/Coupe 11-12) run well past pill-grid
// comfort, and one consistent style across all 9 body styles beats
// switching visual languages depending on which was picked. Body Style
// itself stays a pill grid (9 options, identical to the quiz's own Q1).
// Model Year uses a side-by-side card grid, not the clickable-list style --
// deliberately distinct, since there are only ever a couple of options and
// a full-width list row would look sparse/oversized for a single word
// ("2026").
type PickerStep = "bodyStyle" | "make" | "model" | "modelYear";

export function VehiclePickerFlow({
  vehicles,
  onSelect,
  onCancel,
}: {
  vehicles: MatchmakerVehicle[];
  onSelect: (vehicle: MatchmakerVehicle) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<PickerStep>("bodyStyle");
  const [bodyStyle, setBodyStyle] = useState<VehicleType | "">("");
  const [make, setMake] = useState("");
  // Brought back (MY2027 support, 2026-09-01) -- removed earlier when the
  // Trim step was dropped, since nothing downstream needed to remember
  // "which model" once picking one fired onSelect immediately. The new
  // Model Year step needs it: pickModelYear has to know which model it's
  // disambiguating.
  const [model, setModel] = useState("");

  const makes = useMemo(
    () => (bodyStyle ? getMakesForBodyStyle(vehicles, bodyStyle) : []),
    [vehicles, bodyStyle],
  );
  const models = useMemo(
    () => (bodyStyle && make ? getModelsForMakeAndBodyStyle(vehicles, bodyStyle, make) : []),
    [vehicles, bodyStyle, make],
  );
  const modelYears = useMemo(
    () => (make && model ? getModelYearsForMakeAndModel(vehicles, make, model) : []),
    [vehicles, make, model],
  );

  function pickBodyStyle(value: VehicleType) {
    setBodyStyle(value);
    setMake("");
    setStep("make");
  }
  function pickMake(value: string) {
    setMake(value);
    setStep("model");
  }
  // Auto-selects a trim rather than showing a separate step (removed
  // 2026-09-01, see the file comment above) -- the highest-scoring variant
  // among the model's own trims, scored against the body style's neutral
  // default priority order since there's no quiz/standalone priorities
  // necessarily available yet at pick time (see pickHighestScoringVariant's
  // own comment in matchmaker-scoring.ts for why). Fires onSelect
  // immediately; the caller (bootstrap or "+ Add vehicle") decides what
  // happens next.
  //
  // MY2027 support (2026-09-01): a model with only one year still behaves
  // exactly as before (immediate auto-select, no extra click) -- the new
  // Model Year step only shows when getModelYearsForMakeAndModel finds
  // more than one. `years[0]` is always defined in the single-year branch:
  // the Model step only ever lists models with >=1 real vehicle.
  function pickModel(value: string) {
    setModel(value);
    const years = getModelYearsForMakeAndModel(vehicles, make, value);
    if (years.length <= 1) {
      const variants = getAllVariantsForModel(vehicles, make, value, years[0]);
      onSelect(pickHighestScoringVariant(variants, defaultPriorityOrder(bodyStyle)));
      return;
    }
    setStep("modelYear");
  }
  // MY2027 support (2026-09-01) -- same auto-select-highest-scoring-trim
  // behavior as pickModel's single-year branch, just scoped to the
  // specific year the customer picked here.
  function pickModelYear(year: number) {
    const variants = getAllVariantsForModel(vehicles, make, model, year);
    onSelect(pickHighestScoringVariant(variants, defaultPriorityOrder(bodyStyle)));
  }
  function back() {
    if (step === "make") setStep("bodyStyle");
    else if (step === "model") setStep("make");
    else if (step === "modelYear") setStep("model");
  }

  const stepTitle: Record<PickerStep, string> = {
    bodyStyle: "What type of vehicle?",
    make: "Which make?",
    model: "Which model?",
    modelYear: "Which model year?",
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-xl shadow-black/20 sm:p-8">
      <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {step !== "bodyStyle" ? (
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1 text-zinc-400 normal-case transition-colors hover:text-white"
          >
            <BackArrow /> Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onCancel}
          className="text-zinc-400 normal-case transition-colors hover:text-white"
        >
          Cancel
        </button>
      </div>

      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{stepTitle[step]}</h2>

      {step === "bodyStyle" && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {VEHICLE_TYPES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => pickBodyStyle(option)}
              className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4 text-left text-sm font-semibold text-zinc-200 transition-all hover:border-white/25 hover:bg-white/[0.05]"
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {step === "make" && (
        <div className="mt-8 flex flex-col gap-1.5">
          {makes.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => pickMake(option)}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm font-medium text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/[0.05] hover:text-white"
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {step === "model" && (
        <div className="mt-8 flex flex-col gap-1.5">
          {models.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => pickModel(option)}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm font-medium text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/[0.05] hover:text-white"
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {step === "modelYear" && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {modelYears.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => pickModelYear(year)}
              className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-8 text-center text-2xl font-semibold text-white transition-all hover:border-white/25 hover:bg-white/[0.05]"
            >
              {year}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Standalone-tool segment tag (Step C, approved plan) -- disjoint from the
// quiz path's "primary"/"alt:${powertrain}" tags, since neither concept
// (preferred vs. alternate powertrain) applies to a vehicle picked
// directly via VehiclePickerFlow. Falls back to "unknown" only for the
// defensive null case fuelTypeToPowertrain documents (never hit against
// real data, since every real row has a known fuel type).
//
// Instance-suffixed (fix, 2026-09-01) -- previously just
// `direct:${powertrain}`, which meant picking the same make/model +
// powertrain combination twice via the standalone picker produced an
// IDENTICAL flagKey both times. toggleFlag() (the quiz Flag button's own
// function) treats "already flagged" as "unflag," so a second identical
// pick was silently read as removing the first entry instead of adding a
// second column. Every standalone add now gets its own monotonically-
// increasing instance id (nextStandaloneAddId() below), making flagKey
// collisions structurally impossible no matter how many times the same
// make/model/powertrain is picked -- this is what makes "pick the same
// model twice, get two independent columns, switch each to a different
// trim" possible.
function directSegmentTag(powertrain: Powertrain | null, instanceId: number): string {
  return `direct:${powertrain ?? "unknown"}:${instanceId}`;
}

// "Standalone home" screen (Step C, approved plan) -- what renders behind
// a closed comparison when reached via the standalone tool, since there's
// no ResultsList to fall back to the way the quiz path has one. Reopening
// is handled by the existing, unmodified CompareBar floating pill (kept
// mounted whenever flaggedGroups.length >= 2, regardless of mode -- see
// Matchmaker()) rather than a second, redundant reopen button here.
function StandaloneHome({ flaggedCount, onReset }: { flaggedCount: number; onReset: () => void }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-10 text-center shadow-xl shadow-black/20">
      <h2 className="text-2xl font-semibold tracking-tight text-white">
        Comparing {flaggedCount} vehicle{flaggedCount === 1 ? "" : "s"}
      </h2>
      <p className="mt-2 text-sm text-zinc-400">
        Use the Compare button in the corner to reopen your comparison, or add up to {FLAG_CAP} total from inside
        it.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
      >
        Reset comparison
      </button>
    </div>
  );
}

export function Matchmaker({ vehicles }: { vehicles: MatchmakerVehicle[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Ordered oldest-first (append-only until an unflag removes an entry) --
  // Step B of the approved comparison-view plan, replacing the old
  // per-trim Set<string>. Order matters for two reasons: it's what makes
  // "attempting to flag a 6th is blocked, don't auto-bump the oldest"
  // correct by construction (toggleFlag below just refuses to append past
  // FLAG_CAP, nothing ever gets evicted), and it gives the future Compare
  // bar/table a stable column order.
  const [flaggedGroups, setFlaggedGroups] = useState<FlaggedGroup[]>([]);
  // Step D -- whether ComparisonModal is open, and which trim is toggled
  // active per column (flagKey -> trimId), lifted here rather than kept
  // local to the modal so a trim switch survives a close/reopen. Kept in
  // sync on unflag (see removeFlag) so a re-flagged model later doesn't
  // resume on a stale selection from a previous comparison session.
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonTrimSelections, setComparisonTrimSelections] = useState<Record<string, string>>({});
  // Standalone Comparison Tool (Step C, approved plan) -- a third top-level
  // mode alongside the quiz's "answering" and "results" states, reusing
  // the SAME flaggedGroups/comparisonOpen/comparisonTrimSelections state
  // as the quiz-flagged path rather than a parallel set (this is the
  // approved plan's convergence point: one underlying comparison surface,
  // two ways to populate it). standalonePriorities holds the fixed
  // default row order (computed once, off the first picked vehicle's body
  // style) since there's no quiz `answers.priorities` in this mode -- see
  // comparisonPriorities below.
  const [standaloneMode, setStandaloneMode] = useState(false);
  const [standalonePriorities, setStandalonePriorities] = useState<string[] | null>(null);
  const [infoVehicleId, setInfoVehicleId] = useState<string | null>(null);
  // Tracks whether the customer has ever manually dragged/reordered
  // priorities. Main Use only pre-fills the STARTING order (§3d) -- once
  // touched, neither a later vehicleType nor useCase change auto-reshuffles
  // it again, so it never silently clobbers manual work.
  const [prioritiesTouched, setPrioritiesTouched] = useState(false);

  const currentStep = STEPS[step];
  const stepForRender = (() => {
    if (currentStep.id === "useCase") {
      return { ...currentStep, options: answers.vehicleType ? USE_CASES_BY_VEHICLE_TYPE[answers.vehicleType] : [] };
    }
    if (currentStep.id === "familySize") {
      const allowSixPlus = answers.vehicleType ? LARGE_CAPACITY_VEHICLE_TYPES.includes(answers.vehicleType) : false;
      return { ...currentStep, options: FAMILY_SIZES.filter((size) => size !== "6+" || allowSixPlus) };
    }
    return currentStep;
  })();
  const currentValue = answers[currentStep.id];
  const currentStringValue = typeof currentValue === "string" ? currentValue : "";

  // Same field-update logic whether it's the first-time step-by-step flow
  // or a live edit from the post-questionnaire AnswerPanel -- changing
  // vehicleType invalidates useCase/familySize either way, since their
  // option lists are scoped per vehicleType.
  //
  // Priority pre-fill (§3d): vehicleType always re-targets which of
  // Resale Value / Towing & Payload is valid -- the two are mutually
  // exclusive per type, so a stale label can never be left in the list,
  // touched or not. If untouched, that's a full fresh reset to the new
  // type's neutral order (useCase is also being cleared, so there's no
  // hint left to reapply); if already touched, it's a surgical in-place
  // swap that preserves the customer's own manual arrangement. useCase
  // only applies its hint while untouched -- once the customer has
  // dragged anything, later useCase changes (only reachable via the
  // live-edit AnswerPanel, or by going Back after touching priorities)
  // no longer reshuffle it.
  function setField(id: keyof Answers, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      if (id === "vehicleType" && prev.vehicleType !== value) {
        next.useCase = "";
        next.familySize = "";
        next.priorities = prioritiesTouched
          ? retargetPriorityOrderForVehicleType(prev.priorities, value as VehicleType | "")
          : defaultPriorityOrder(value as VehicleType | "");
      }
      if (id === "useCase" && !prioritiesTouched) {
        next.priorities = applyUseCaseHint(defaultPriorityOrder(next.vehicleType), value);
      }
      return next;
    });
  }

  function setPriceRange(range: PriceRangeValue) {
    setAnswers((prev) => ({ ...prev, priceRange: range }));
  }

  // priceRange stays null (hidden from chips, excluded from scoring) until
  // the customer actually reaches this step -- the moment they do, default
  // it to the full open range so QuestionPanel/AnswerPanel never have to
  // treat null as a real, renderable slider position. Re-running this after
  // priceRange is no longer null is a safe no-op (the condition just fails).
  useEffect(() => {
    if (currentStep.id === "priceRange" && answers.priceRange === null) {
      setPriceRange({ min: PRICE_SLIDER_MIN, max: PRICE_SLIDER_MAX });
    }
  }, [currentStep.id, answers.priceRange]);

  function goNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setDone(true);
    }
  }

  function select(id: keyof Answers, value: string) {
    setField(id, value);
    goNext();
  }

  function reorderPriorities(order: string[]) {
    setAnswers((prev) => ({ ...prev, priorities: order }));
    setPrioritiesTouched(true);
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function startOver() {
    setAnswers(EMPTY_ANSWERS);
    setStep(0);
    setDone(false);
    setDismissed(new Set());
    setFlaggedGroups([]);
    setComparisonOpen(false);
    setComparisonTrimSelections({});
    setStandaloneMode(false);
    setStandalonePriorities(null);
    setInfoVehicleId(null);
    setPrioritiesTouched(false);
  }

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
  }

  // Group-level toggle (Step B) -- unflagging removes by flagKey
  // regardless of which trim is currently active (unflagging the whole
  // model, not just whatever trim happens to be displayed); flagging a
  // new one is capped at FLAG_CAP with NO auto-bump of the oldest entry --
  // once at cap, this is a silent no-op. Step C adds a disabled button
  // state so this path is normally unreachable from the UI, but the cap
  // is enforced here regardless, as the actual source of truth.
  function toggleFlag(candidate: FlaggedGroup) {
    setFlaggedGroups((prev) => {
      const alreadyFlagged = prev.some((g) => g.flagKey === candidate.flagKey);
      if (alreadyFlagged) {
        return prev.filter((g) => g.flagKey !== candidate.flagKey);
      }
      if (prev.length >= FLAG_CAP) {
        return prev;
      }
      return [...prev, candidate];
    });
  }
  const flaggedKeys = useMemo(() => new Set(flaggedGroups.map((g) => g.flagKey)), [flaggedGroups]);
  const compareLimitReached = flaggedGroups.length >= FLAG_CAP;

  // Monotonic counter backing directSegmentTag's uniqueness suffix (fix,
  // 2026-09-01) -- a plain ref, not state, since its value only needs to be
  // correct at the moment a new flagKey string is built (synchronously,
  // inside an event handler) and never needs to trigger a re-render on its
  // own. Deliberately never reset (Start Over, Reset comparison, exiting
  // standalone mode) -- the simplest way to guarantee it can never repeat a
  // value and collide with a still-live flagKey, at zero real cost.
  const standaloneAddIdRef = useRef(0);
  function nextStandaloneAddId(): number {
    standaloneAddIdRef.current += 1;
    return standaloneAddIdRef.current;
  }

  // Standalone-picker add path (fix, 2026-09-01) -- ALWAYS appends
  // (respecting FLAG_CAP), never toggles off, unlike toggleFlag() above
  // (the quiz Flag button's own function, left completely unchanged --
  // it must keep working as a literal flag/unflag toggle). Needed because
  // the standalone picker can now legitimately add the same underlying
  // vehicle -- or the same auto-picked headline trim for the same model --
  // more than once (see directSegmentTag above); toggleFlag's "flagKey
  // already present -> treat as unflag" branch would otherwise silently
  // remove the first entry instead. Since every standalone-add flagKey is
  // now structurally unique (the instance counter), there's no "already
  // present" case to check here at all.
  function addFlaggedGroup(candidate: FlaggedGroup) {
    setFlaggedGroups((prev) => (prev.length >= FLAG_CAP ? prev : [...prev, candidate]));
  }

  // Standalone Comparison Tool entry (Step C) -- enter/exit are distinct
  // from resetStandaloneComparison below: entering/exiting is "use a
  // different entry path entirely" (exiting drops back to the normal quiz
  // landing), while reset is "start this same tool over" (stays in
  // standalone mode). Exiting clears every piece of state a standalone
  // session could have built up, matching startOver()'s own thoroughness.
  function enterStandaloneMode() {
    setStandaloneMode(true);
  }
  function exitStandaloneMode() {
    setStandaloneMode(false);
    setFlaggedGroups([]);
    setStandalonePriorities(null);
    setComparisonOpen(false);
    setComparisonTrimSelections({});
  }
  function resetStandaloneComparison() {
    setFlaggedGroups([]);
    setStandalonePriorities(null);
    setComparisonOpen(false);
    setComparisonTrimSelections({});
  }

  // The 2-vehicle bootstrap (confirmed design item 2/4) -- reuses
  // toggleFlag() as-is for the actual add (same cap enforcement, same
  // de-dupe-by-flagKey), so the FLAG_CAP invariant everywhere else in this
  // feature needs zero changes. The first pick also computes the fixed
  // default row order (confirmed design item 3) off ITS body style only --
  // never recomputed for a later, possibly different-body-style pick,
  // same "one shared row order for the whole table" principle
  // comparisonRowOrder already uses for the quiz path's own cross-body-
  // style case. The second pick auto-opens the comparison immediately,
  // which is the entire point of the standalone tool's bootstrap.
  // Reversed 2026-09-01 (fix, see directSegmentTag/addFlaggedGroup above):
  // this used to guard against re-picking a vehicle already in the
  // comparison (checking the underlying trimId, since re-picking the exact
  // same trim would previously toggleFlag() the first pick OFF -- same
  // flagKey => "remove"). That guard is now deliberately REMOVED -- the
  // whole point of the picker no longer having a separate Trim step is
  // that picking the same model twice (e.g. "Hyundai Tucson" for both
  // Vehicle 1 and Vehicle 2) is a legitimate, intended action: both picks
  // auto-select the same headline trim initially, producing two
  // independent columns the customer then diverges via each column's own
  // trim switcher. Now that every standalone add gets a structurally
  // unique flagKey, there's no collision left for a trimId guard to
  // protect against.
  function handleStandalonePick(vehicle: MatchmakerVehicle) {
    if (flaggedGroups.length === 0) {
      const hintUseCase = USE_CASES_BY_VEHICLE_TYPE[vehicle.bodyStyle][0];
      setStandalonePriorities(PRIORITY_HINTS_BY_USE_CASE[hintUseCase]);
    }
    const flagKey = modelGroupFlagKey(
      `${vehicle.make}|${vehicle.model}`,
      directSegmentTag(fuelTypeToPowertrain(vehicle.fuelType), nextStandaloneAddId()),
    );
    addFlaggedGroup({ flagKey, make: vehicle.make, model: vehicle.model, trimId: vehicle.id });
    if (flaggedGroups.length === 1) {
      setComparisonOpen(true);
    }
  }

  // "+ Add vehicle" inside ComparisonModal (Step D, approved plan) --
  // available from BOTH entry paths, since nothing about it is standalone-
  // specific once a comparison already exists (2+ already flagged, modal
  // already open, row order already fixed) -- deliberately does NOT touch
  // standalonePriorities or comparisonOpen the way handleStandalonePick
  // does, since neither is relevant here. Reuses the same
  // direct:${powertrain}:${instanceId} tag as the standalone bootstrap: a
  // vehicle added here was also picked directly via VehiclePickerFlow, the
  // identical "no preferred/alternate powertrain" situation.
  //
  // Reversed 2026-09-01 (fix): previously guarded against re-adding a
  // trimId already present in flaggedGroups (a duplicate-add bug fix from
  // the original build -- re-adding a vehicle already flagged from the
  // QUIZ path used to produce a literal duplicate column, since the quiz
  // path's flagKey uses a "primary"/"alt:" segment tag, not "direct:", so
  // the two never collided on flagKey the way toggleFlag's own check
  // expects). That guard is now deliberately REMOVED -- the whole point of
  // this task is to let the customer add the same model (and its
  // auto-picked headline trim, now that there's no separate Trim step) a
  // second time, producing a second independent column they then diverge
  // via each column's own trim switcher. flagKey collisions are what
  // actually made the old guard necessary; now that every standalone add
  // gets a structurally unique flagKey (directSegmentTag's instance
  // counter), a literal duplicate column can never happen, so there's
  // nothing left for a trimId guard to protect against. This still
  // correctly allows the pre-existing intentional case (a different
  // trim/powertrain of the same model, e.g. Camry Hybrid + Camry Gas, or
  // now also the exact same trim twice) -- both just add a new column.
  function addVehicleToComparison(vehicle: MatchmakerVehicle) {
    const flagKey = modelGroupFlagKey(
      `${vehicle.make}|${vehicle.model}`,
      directSegmentTag(fuelTypeToPowertrain(vehicle.fuelType), nextStandaloneAddId()),
    );
    addFlaggedGroup({ flagKey, make: vehicle.make, model: vehicle.model, trimId: vehicle.id });
  }

  // Dedicated unflag path for ComparisonModal's per-column remove action --
  // unlike toggleFlag, there's no cap check to make (removing never needs
  // one) and no ambiguity about add-vs-remove (the modal only ever shows
  // already-flagged models), so this is a plain filter rather than routing
  // through toggleFlag's add/remove branch. Also drops any stored trim
  // selection for that flagKey, so a later re-flag of the same model
  // starts fresh rather than silently resuming a stale toggle.
  function removeFlag(flagKey: string) {
    setFlaggedGroups((prev) => prev.filter((g) => g.flagKey !== flagKey));
    setComparisonTrimSelections((prev) => {
      if (!(flagKey in prev)) return prev;
      const next = { ...prev };
      delete next[flagKey];
      return next;
    });
  }

  function selectComparisonTrim(flagKey: string, trimId: string) {
    setComparisonTrimSelections((prev) => ({ ...prev, [flagKey]: trimId }));
  }

  // Auto-close on unflagging down to 1 remaining (confirmed-design item 1,
  // approved plan) -- comparing one thing isn't a comparison. Handled as an
  // effect (rather than just gating the render below) so `comparisonOpen`
  // itself goes back to false -- otherwise, flagging a 2nd model again
  // later would silently re-open the modal with no new click, since the
  // render gate alone can't tell "never opened" apart from "was open,
  // dropped below 2."
  useEffect(() => {
    if (flaggedGroups.length < 2 && comparisonOpen) {
      setComparisonOpen(false);
    }
  }, [flaggedGroups.length, comparisonOpen]);

  // Real data now (matchmaker-vehicles.ts / matchmaker-scoring.ts) --
  // hard-filters, scores, and segments by powertrain preference. Dismiss/
  // flag apply within each segment independently, so dismissing a vehicle
  // in "Best hybrid option" doesn't touch the primary list, and vice versa.
  const matched = useMemo(() => getMatchedVehicles(vehicles, answers), [vehicles, answers]);
  const segmented = useMemo(
    () => segmentByPowertrain(matched, answers.powertrain),
    [matched, answers.powertrain],
  );

  // Dismiss is applied BEFORE grouping, not after -- this is what makes
  // the "dismiss the currently-active trim, card recomputes its headline"
  // behavior (Brett, 2026-09-02) work with no special-case logic:
  // groupByModel()'s headline is always "the first (i.e. highest-scoring)
  // vehicle encountered for a given make+model key" in its sorted input,
  // so removing dismissed trims from that input before grouping already
  // produces the correct recomputed headline (and correctly re-sorts the
  // group's own list position if its headline changed) for free. A model
  // with every trim dismissed simply has no vehicles left to group, so no
  // group -- and no card -- is ever built for it; nothing needs to
  // explicitly hide a fully-dismissed card.
  //
  // Flag is now group-level (Step B) -- a group bubbles to the top of its
  // section if ITS OWN qualified flagKey is flagged, a direct Set lookup
  // rather than the old "check every variant" scan, since flagging no
  // longer has any per-trim component to check. `segmentTag` tells this
  // function which qualified flagKey to check -- it's called once for the
  // primary list and once per alternative-powertrain bucket, and each
  // call needs its own segment tag so a Tucson-Gas group and a
  // Tucson-Hybrid group (same raw ModelGroup.key) are never confused with
  // each other. Flag never changes which trim is the group's
  // headline/active display -- only dismiss does that.
  function groupWithDismissAndFlagSort(list: MatchedVehicle[], segmentTag: string): ModelGroup[] {
    const nonDismissed = list.filter((v) => !dismissed.has(v.id));
    return groupByModel(nonDismissed).sort(
      (a, b) =>
        Number(flaggedKeys.has(modelGroupFlagKey(b.key, segmentTag))) -
        Number(flaggedKeys.has(modelGroupFlagKey(a.key, segmentTag))),
    );
  }

  const visiblePrimary = groupWithDismissAndFlagSort(segmented.primary, PRIMARY_SEGMENT_TAG);

  // Each alternative powertrain shows only its single best (post-dismiss/
  // flag) MODEL GROUP as one labeled card, e.g. "Best hybrid option" --
  // not the full group, which can run into the hundreds of vehicles (see
  // Step 4's verification: e.g. 1,059 Gas vehicles in one alternative
  // group). groupWithDismissAndFlagSort runs independently per powertrain
  // bucket (not once across all of them) -- approved 2026-09-02, see the
  // joint plan's point 5: a model spanning multiple powertrains (e.g. a
  // Tucson sold as Gas/Hybrid/PHEV) can legitimately produce two separate
  // cards, one per powertrain bucket it has a real entry in, rather than
  // being collapsed into one card whose toggle would blur this section's
  // whole purpose.
  const visibleAlternatives = segmented.alternatives
    .map((altGroup) => {
      const resolved = groupWithDismissAndFlagSort(
        altGroup.vehicles,
        alternativeSegmentTag(altGroup.powertrain),
      );
      return resolved.length > 0
        ? { powertrain: altGroup.powertrain, label: altGroup.label, group: resolved[0] }
        : null;
    })
    .filter((entry): entry is { powertrain: Powertrain; label: string; group: ModelGroup } => entry !== null);

  const anyDismissed = dismissed.size > 0;

  const infoVehicle = infoVehicleId ? matched.find((v) => v.id === infoVehicleId) ?? null : null;

  // Which priorities drive comparisonRowOrder() -- the quiz's own live
  // answers.priorities when reached that way, or the fixed default
  // computed once at the standalone tool's first pick (see
  // handleStandalonePick). The `?? []` fallback is defensive only: it
  // can't actually be hit in standalone mode by the time a comparison
  // exists, since flaggedGroups.length >= 2 implies handleStandalonePick
  // already ran at least twice, and its first call always sets this.
  const comparisonPriorities = standaloneMode ? (standalonePriorities ?? []) : answers.priorities;

  return (
    <section className="bg-zinc-950 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          {/* PROPOSED customer-facing copy, pending explicit sign-off --
              "mock data" was accurate for the old hand-curated/derived-
              heuristic dataset; this is real researched vehicle data now
              (matchmaker-data-spec.md), just not live dealer inventory. */}
          <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-medium tracking-wide text-amber-400 uppercase">
            Real vehicle data — not yet connected to live dealer inventory
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Find your match
          </h1>
          <p className="mt-4 text-lg text-zinc-400">
            Answer a few quick questions and we&apos;ll suggest vehicles worth searching for.
          </p>
          {/* Standalone Comparison Tool entry point (Step C, approved plan)
              -- only on the initial landing view (confirmed design item 1),
              not mid-quiz or mid-results. */}
          {!done && !standaloneMode && step === 0 && (
            <p className="mt-4 text-sm text-zinc-500">
              Already know what you&apos;re cross-shopping?{" "}
              <button
                type="button"
                onClick={enterStandaloneMode}
                className="font-semibold text-emerald-400 underline decoration-emerald-400/40 underline-offset-4 transition-colors hover:text-emerald-300"
              >
                Skip the quiz — compare specific vehicles
              </button>
            </p>
          )}
        </div>

        <div className="mt-14">
          {standaloneMode ? (
            <div className="mx-auto max-w-2xl">
              {flaggedGroups.length < 2 ? (
                <>
                  <p className="mb-4 text-center text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Vehicle {flaggedGroups.length + 1} of 2
                  </p>
                  <VehiclePickerFlow
                    key={flaggedGroups.length}
                    vehicles={vehicles}
                    onSelect={handleStandalonePick}
                    onCancel={exitStandaloneMode}
                  />
                </>
              ) : (
                <StandaloneHome flaggedCount={flaggedGroups.length} onReset={resetStandaloneComparison} />
              )}
            </div>
          ) : done ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <ResultsList
                answers={answers}
                primary={visiblePrimary}
                alternatives={visibleAlternatives}
                flaggedKeys={flaggedKeys}
                compareLimitReached={compareLimitReached}
                onDismiss={dismiss}
                onToggleFlag={toggleFlag}
                onOpenInfo={setInfoVehicleId}
                onRestoreAll={() => setDismissed(new Set())}
                anyDismissed={anyDismissed}
              />
              {/* Normal document-flow positioning (2026-09-02, Brett's
                  request) -- previously lg:sticky lg:top-24 lg:self-start,
                  which only brought this panel fully into view once
                  scrolled most of the way down the (much longer, pre-cap)
                  primary results list. With the primary list now capped at
                  10 cards (see ResultsList's showMore/visibleCount logic),
                  the page is considerably shorter, making sticky
                  positioning unnecessary in practice as well as removed
                  here. */}
              <AnswerPanel
                answers={answers}
                onFieldChange={setField}
                onPriceRangeChange={setPriceRange}
                onReorderPriorities={reorderPriorities}
                onStartOver={startOver}
              />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[1fr_320px]">
              <QuestionPanel
                step={stepForRender}
                stepIndex={step}
                totalSteps={STEPS.length}
                value={currentStringValue}
                rankedValues={answers.priorities}
                priceRangeValue={answers.priceRange}
                onSelect={(value) => select(currentStep.id, value)}
                onPriceRangeChange={setPriceRange}
                onReorderPriorities={reorderPriorities}
                onBack={goBack}
                onContinue={goNext}
              />
              <BuildingVisual answers={answers} currentStepId={currentStep.id} />
            </div>
          )}
        </div>
      </div>

      {infoVehicle && <VehicleDetailModal vehicle={infoVehicle} answers={answers} onClose={() => setInfoVehicleId(null)} />}
      {/* Mounted whenever a comparison exists, regardless of entry path
          (Step C) -- previously gated on `done` alone, which only ever
          covered the quiz path. The standalone tool has no `done` state of
          its own (it never runs the quiz), so its own 2+-flagged condition
          has to be OR'd in here rather than folded into `done`. */}
      {(done || standaloneMode) && flaggedGroups.length >= 2 && (
        <CompareBar count={flaggedGroups.length} onClick={() => setComparisonOpen(true)} />
      )}
      {comparisonOpen && flaggedGroups.length >= 2 && (
        <ComparisonModal
          flaggedGroups={flaggedGroups}
          vehicles={vehicles}
          priorities={comparisonPriorities}
          selectedTrimIds={comparisonTrimSelections}
          onSelectTrim={selectComparisonTrim}
          onRemove={removeFlag}
          onAddVehicle={addVehicleToComparison}
          onClose={() => setComparisonOpen(false)}
        />
      )}
    </section>
  );
}
