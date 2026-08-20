"use client";

import { useMemo, useState } from "react";
import { GetStartedButton } from "@/components/get-started-button";
import { VehicleDetailModal } from "@/components/vehicle-detail-modal";
import {
  FAMILY_SIZES,
  LARGE_CAPACITY_VEHICLE_TYPES,
  MOCK_RECOMMENDATIONS,
  POWERTRAINS,
  PRICE_RANGES,
  PRIORITIES,
  USE_CASES_BY_VEHICLE_TYPE,
  VEHICLE_TYPES,
  type Answers,
  type MockVehicle,
  type Powertrain,
  type VehicleType,
} from "@/lib/matchmaker-data";

const DEFAULT_PRIORITY_ORDER = PRIORITIES.map((p) => p.label);

const EMPTY_ANSWERS: Answers = {
  vehicleType: "",
  useCase: "",
  familySize: "",
  powertrain: "",
  priceRange: "",
  priorities: DEFAULT_PRIORITY_ORDER,
};

type Step = {
  id: keyof Answers;
  kind: "select" | "rank";
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
    subtitle: "Gas, hybrid, or fully electric.",
    options: POWERTRAINS,
  },
  {
    id: "priceRange",
    kind: "select",
    title: "What's your target price range?",
    subtitle: "Ballpark is fine — you can fine-tune this later.",
    options: PRICE_RANGES.map((r) => r.label),
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
  Hybrid: "text-sky-400",
  Electric: "text-emerald-400",
};

const FAMILY_SCALE: Record<string, number> = {
  "": 1,
  "1-2": 0.85,
  "3-5": 1.05,
  "6+": 1.2,
};

const PRICE_TIER: Record<string, string> = {
  "": "",
  "Budget-Conscious (Under $30,000)": "$",
  "Practical ($30,000 – $45,000)": "$$",
  "Well-Equipped ($45,000 – $60,000)": "$$$",
  "Premium ($60,000 – $80,000)": "$$$$",
  "Luxurious (Over $80,000)": "$$$$$",
};

// Weighs all six answer fields, not just bodyType/powertrain. Weights are
// tuned so changing any one field visibly moves the list, not for a
// precisely calibrated formula:
//   - vehicleType (40) is the heaviest single weight -- the primary filter.
//   - powertrain (15) and familySize-vs-seatsCategory (15) are direct matches.
//   - priceRange (15) checks whether priceValue falls inside the selected bracket.
//   - useCase (5) isn't scored independently -- it's freeform text scoped
//     per-vehicleType, not a fixed taxonomy, so it just reinforces an
//     already-matching vehicleType.
//   - priorities (10) weighs each vehicle's priorityScores by how close to
//     the top each priority was ranked, normalized against the best
//     possible score so it nudges the result rather than dominating it.
function fitScore(vehicle: MockVehicle, answers: Answers): number {
  let score = 0;

  const typeMatches = answers.vehicleType !== "" && vehicle.bodyType === answers.vehicleType;
  if (typeMatches) score += 40;

  if (answers.powertrain && vehicle.powertrain === answers.powertrain) score += 15;

  if (answers.familySize && vehicle.seatsCategory === answers.familySize) score += 15;

  const range = PRICE_RANGES.find((r) => r.label === answers.priceRange);
  if (range && vehicle.priceValue >= range.min && vehicle.priceValue <= range.max) score += 15;

  if (answers.useCase && typeMatches) score += 5;

  const rankWeightTotal = PRIORITIES.length;
  let priorityRaw = 0;
  let priorityMax = 0;
  answers.priorities.forEach((label, index) => {
    const weight = rankWeightTotal - index;
    priorityRaw += (vehicle.priorityScores[label] ?? 0) * weight;
    priorityMax += 5 * weight;
  });
  if (priorityMax > 0) {
    score += (priorityRaw / priorityMax) * 10;
  }

  return score;
}

const BODY_PATHS: Record<VehicleType, string> = {
  Sedan: "M10 78 L10 70 Q10 66 14 65 L46 58 L70 34 Q78 26 92 26 L150 26 Q163 26 172 35 L192 58 L226 65 Q230 66 230 70 L230 78 Z",
  Truck: "M10 78 L10 68 Q10 64 14 64 L40 64 L40 34 Q40 26 50 26 L110 26 Q120 26 126 34 L140 64 L226 64 Q230 64 230 70 L230 78 Z",
  SUV: "M10 78 L10 66 Q10 58 18 55 L36 40 Q44 28 60 28 L182 28 Q198 28 206 40 L222 55 Q230 58 230 66 L230 78 Z",
  Hatchback: "M10 78 L10 70 Q10 66 14 65 L46 58 L70 34 Q78 26 92 26 L145 26 Q160 26 168 38 L178 58 L226 62 Q230 63 230 70 L230 78 Z",
  Coupe: "M10 78 L10 72 Q10 69 13 68 L60 62 L92 32 Q100 25 112 25 L150 25 Q160 25 166 33 L184 58 L226 66 Q230 67 230 72 L230 78 Z",
  Convertible: "M10 78 L10 72 Q10 69 13 68 L50 64 L70 50 Q76 45 84 45 L160 45 Q168 45 174 50 L196 64 L226 68 Q230 69 230 72 L230 78 Z",
  Minivan: "M10 78 L10 58 Q10 46 22 42 L38 30 Q48 24 62 24 L184 24 Q196 24 204 32 L220 46 Q230 50 230 62 L230 78 Z",
  "Passenger Van": "M14 78 L14 30 Q14 24 20 24 L222 24 Q228 24 228 30 L228 78 Z",
  "Cargo Van": "M14 78 L14 30 Q14 24 20 24 L222 24 Q228 24 228 30 L228 78 Z",
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
        const priority = PRIORITIES.find((p) => p.label === label);
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
  const priceTier = PRICE_TIER[answers.priceRange];

  const allChips: { label: string; value: string; stepId: keyof Answers }[] = [
    { label: "Type", value: answers.vehicleType, stepId: "vehicleType" },
    { label: "Use", value: answers.useCase, stepId: "useCase" },
    { label: "Riders", value: answers.familySize, stepId: "familySize" },
    { label: "Powertrain", value: answers.powertrain, stepId: "powertrain" },
    { label: "Budget", value: answers.priceRange, stepId: "priceRange" },
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
function AnswerPanel({
  answers,
  onFieldChange,
  onReorderPriorities,
  onStartOver,
}: {
  answers: Answers;
  onFieldChange: (id: keyof Answers, value: string) => void;
  onReorderPriorities: (order: string[]) => void;
  onStartOver: () => void;
}) {
  const useCaseOptions = answers.vehicleType ? USE_CASES_BY_VEHICLE_TYPE[answers.vehicleType] : [];
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
        label="Main use"
        options={useCaseOptions}
        value={answers.useCase}
        onSelect={(v) => onFieldChange("useCase", v)}
        emptyMessage="Pick a vehicle type first."
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
      <CompactSelectField
        label="Price range"
        options={PRICE_RANGES.map((r) => r.label)}
        value={answers.priceRange}
        onSelect={(v) => onFieldChange("priceRange", v)}
      />

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
  onSelect,
  onReorderPriorities,
  onBack,
  onContinue,
}: {
  step: Step;
  stepIndex: number;
  totalSteps: number;
  value: string;
  rankedValues: string[];
  onSelect: (value: string) => void;
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

function VehicleCard({
  vehicle,
  flagged,
  onDismiss,
  onToggleFlag,
  onOpenInfo,
}: {
  vehicle: MockVehicle;
  flagged: boolean;
  onDismiss: () => void;
  onToggleFlag: () => void;
  onOpenInfo: () => void;
}) {
  const [searchClicked, setSearchClicked] = useState(false);

  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl border p-6 shadow-xl shadow-black/20 transition-colors sm:flex-row sm:items-start sm:justify-between ${
        flagged
          ? "border-emerald-500/40 bg-emerald-500/[0.06]"
          : "border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3 sm:block">
          <h3 className="text-lg font-semibold text-white">
            {vehicle.make} {vehicle.model}
          </h3>
          <span className="shrink-0 text-sm font-semibold text-emerald-400 sm:hidden">
            {vehicle.priceEstimate}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-zinc-400">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5">
            {vehicle.bodyType}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5">
            {vehicle.powertrain}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{vehicle.rationale}</p>
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-52">
        <span className="hidden text-right text-sm font-semibold text-emerald-400 sm:block">
          {vehicle.priceEstimate}
        </span>
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            Not interested
          </button>
          <button
            type="button"
            onClick={onOpenInfo}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-sky-400/40 hover:text-sky-300"
          >
            More info
          </button>
          <button
            type="button"
            onClick={onToggleFlag}
            aria-pressed={flagged}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
              flagged
                ? "border-amber-400 bg-amber-400/10 text-amber-300"
                : "border-white/15 text-zinc-300 hover:border-amber-400/40 hover:text-amber-300"
            }`}
          >
            <StarIcon filled={flagged} />
            {flagged ? "Flagged" : "Flag"}
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
function ResultsList({
  answers,
  visible,
  flagged,
  onDismiss,
  onToggleFlag,
  onOpenInfo,
  onRestoreAll,
}: {
  answers: Answers;
  visible: MockVehicle[];
  flagged: Set<string>;
  onDismiss: (id: string) => void;
  onToggleFlag: (id: string) => void;
  onOpenInfo: (id: string) => void;
  onRestoreAll: () => void;
}) {
  const answerChips = [
    answers.vehicleType,
    answers.useCase,
    answers.familySize,
    answers.powertrain,
    answers.priceRange,
  ].filter(Boolean);

  return (
    <div>
      <div>
        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium tracking-wide text-emerald-400 uppercase">
          Mock results — not live inventory
        </span>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Here&apos;s what we&apos;d search for
        </h2>
        <p className="mt-3 text-lg text-zinc-400">
          Dismiss what doesn&apos;t fit, flag what does — this narrows the list live.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Sorted by fit to your answers — flagged picks jump to the top. Edit any answer alongside
          the list to re-sort instantly.
        </p>
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

      {visible.length > 0 ? (
        <div className="mt-8 flex flex-col gap-4">
          {visible.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              flagged={flagged.has(vehicle.id)}
              onDismiss={() => onDismiss(vehicle.id)}
              onToggleFlag={() => onToggleFlag(vehicle.id)}
              onOpenInfo={() => onOpenInfo(vehicle.id)}
            />
          ))}
        </div>
      ) : (
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
      )}

      <div className="mt-10 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center sm:p-10">
        <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {flagged.size > 0 ? "Found the one (or a few)?" : "See something you like?"}
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

export function Matchmaker() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [infoVehicleId, setInfoVehicleId] = useState<string | null>(null);

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
  function setField(id: keyof Answers, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      if (id === "vehicleType" && prev.vehicleType !== value) {
        next.useCase = "";
        next.familySize = "";
      }
      return next;
    });
  }

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
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function startOver() {
    setAnswers(EMPTY_ANSWERS);
    setStep(0);
    setDone(false);
    setDismissed(new Set());
    setFlagged(new Set());
    setInfoVehicleId(null);
  }

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
  }

  function toggleFlag(id: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sortedByFit = useMemo(() => {
    return [...MOCK_RECOMMENDATIONS].sort((a, b) => fitScore(b, answers) - fitScore(a, answers));
  }, [answers]);

  const visible = sortedByFit
    .filter((v) => !dismissed.has(v.id))
    .sort((a, b) => Number(flagged.has(b.id)) - Number(flagged.has(a.id)));

  const infoVehicle = infoVehicleId ? MOCK_RECOMMENDATIONS.find((v) => v.id === infoVehicleId) ?? null : null;

  return (
    <section className="bg-zinc-950 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-medium tracking-wide text-amber-400 uppercase">
            Prototype — mock data, no live inventory yet
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Find your match
          </h1>
          <p className="mt-4 text-lg text-zinc-400">
            Answer a few quick questions and we&apos;ll suggest vehicles worth searching for.
          </p>
        </div>

        <div className="mt-14">
          {done ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <ResultsList
                answers={answers}
                visible={visible}
                flagged={flagged}
                onDismiss={dismiss}
                onToggleFlag={toggleFlag}
                onOpenInfo={setInfoVehicleId}
                onRestoreAll={() => setDismissed(new Set())}
              />
              <div className="lg:sticky lg:top-24 lg:self-start">
                <AnswerPanel
                  answers={answers}
                  onFieldChange={setField}
                  onReorderPriorities={reorderPriorities}
                  onStartOver={startOver}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[1fr_320px]">
              <QuestionPanel
                step={stepForRender}
                stepIndex={step}
                totalSteps={STEPS.length}
                value={currentStringValue}
                rankedValues={answers.priorities}
                onSelect={(value) => select(currentStep.id, value)}
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
    </section>
  );
}
