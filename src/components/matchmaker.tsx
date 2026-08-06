"use client";

import { useMemo, useState } from "react";
import { GetStartedButton } from "@/components/get-started-button";
import {
  FAMILY_SIZES,
  MOCK_RECOMMENDATIONS,
  POWERTRAINS,
  PRICE_RANGES,
  USE_CASES,
  VEHICLE_TYPES,
  type MockVehicle,
  type Powertrain,
  type VehicleType,
} from "@/lib/matchmaker-data";

type Answers = {
  vehicleType: VehicleType | "";
  useCase: string;
  familySize: string;
  powertrain: Powertrain | "";
  priceRange: string;
  notes: string;
};

const EMPTY_ANSWERS: Answers = {
  vehicleType: "",
  useCase: "",
  familySize: "",
  powertrain: "",
  priceRange: "",
  notes: "",
};

type Step = {
  id: keyof Answers;
  kind: "select" | "text";
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
    options: USE_CASES,
  },
  {
    id: "familySize",
    kind: "select",
    title: "How many people usually ride along?",
    subtitle: "Helps us gauge how much seating and cargo room you need.",
    options: FAMILY_SIZES,
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
    options: PRICE_RANGES,
  },
  {
    id: "notes",
    kind: "text",
    title: "Anything else we should know?",
    subtitle: "Optional — towing needs, must-have features, dealbreakers, whatever matters to you.",
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
  "Just me": 0.82,
  "2 people": 0.92,
  "3-4 people": 1.06,
  "5+ people": 1.2,
};

const PRICE_TIER: Record<string, string> = {
  "": "",
  "Under $25k": "$",
  "$25k – $40k": "$$",
  "$40k – $60k": "$$$",
  "$60k+": "$$$$",
};

function CarSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 110" className={className} fill="currentColor">
      <path d="M10 78 L10 70 Q10 66 14 65 L46 58 L70 34 Q78 26 92 26 L150 26 Q163 26 172 35 L192 58 L226 65 Q230 66 230 70 L230 78 Z" />
      <circle cx="62" cy="82" r="14" />
      <circle cx="178" cy="82" r="14" />
    </svg>
  );
}

function TruckSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 110" className={className} fill="currentColor">
      <path d="M10 78 L10 68 Q10 64 14 64 L40 64 L40 34 Q40 26 50 26 L110 26 Q120 26 126 34 L140 64 L226 64 Q230 64 230 70 L230 78 Z" />
      <circle cx="62" cy="82" r="14" />
      <circle cx="178" cy="82" r="14" />
    </svg>
  );
}

function SuvSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 110" className={className} fill="currentColor">
      <path d="M10 78 L10 66 Q10 58 18 55 L36 40 Q44 28 60 28 L182 28 Q198 28 206 40 L222 55 Q230 58 230 66 L230 78 Z" />
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
  if (vehicleType === "Car") return <CarSilhouette className={className} />;
  if (vehicleType === "Truck") return <TruckSilhouette className={className} />;
  if (vehicleType === "SUV") return <SuvSilhouette className={className} />;
  return <DefaultSilhouette className={className} />;
}

function BackArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M8.5 2.5L3 7l5.5 4.5M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

function QuestionPanel({
  step,
  stepIndex,
  totalSteps,
  value,
  onSelect,
  onTextChange,
  onBack,
  onContinue,
  onSkip,
}: {
  step: Step;
  stepIndex: number;
  totalSteps: number;
  value: string;
  onSelect: (value: string) => void;
  onTextChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
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
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
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

      {step.kind === "text" && (
        <div className="mt-8">
          <textarea
            value={value}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="e.g. I need to tow a small trailer a few times a year, and I really don't want cloth seats."
            rows={4}
            className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
          />
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              See My Matches
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
}: {
  vehicle: MockVehicle;
  flagged: boolean;
  onDismiss: () => void;
  onToggleFlag: () => void;
}) {
  const [searchClicked, setSearchClicked] = useState(false);

  return (
    <div
      className={`flex flex-col rounded-3xl border p-6 shadow-xl shadow-black/20 transition-colors ${
        flagged
          ? "border-emerald-500/40 bg-emerald-500/[0.06]"
          : "border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {vehicle.make} {vehicle.model}
          </h3>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-zinc-400">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5">
              {vehicle.bodyType}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5">
              {vehicle.powertrain}
            </span>
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold text-emerald-400">{vehicle.priceEstimate}</span>
      </div>

      <p className="mt-4 flex-1 text-sm leading-relaxed text-zinc-400">{vehicle.rationale}</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-red-500/40 hover:text-red-400"
        >
          Not interested
        </button>
        <button
          type="button"
          onClick={onToggleFlag}
          className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
            flagged
              ? "border-emerald-500 bg-emerald-500 text-zinc-950"
              : "border-white/15 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-400"
          }`}
        >
          {flagged ? "Flagged for more info" : "Want more info"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setSearchClicked(true)}
        className="mt-3 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
      >
        Start My Search
      </button>
      {searchClicked && (
        <p className="mt-2 text-center text-xs text-zinc-500">
          Placeholder — this will kick off your real search once the intake filter connects.
        </p>
      )}
    </div>
  );
}

function ResultsScreen({ answers, onStartOver }: { answers: Answers; onStartOver: () => void }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  const sortedByFit = useMemo(() => {
    function fitScore(v: MockVehicle) {
      let score = 0;
      if (answers.vehicleType && v.bodyType === answers.vehicleType) score += 2;
      if (answers.powertrain && v.powertrain === answers.powertrain) score += 1;
      return score;
    }
    return [...MOCK_RECOMMENDATIONS].sort((a, b) => fitScore(b) - fitScore(a));
  }, [answers.vehicleType, answers.powertrain]);

  const visible = sortedByFit
    .filter((v) => !dismissed.has(v.id))
    .sort((a, b) => Number(flagged.has(b.id)) - Number(flagged.has(a.id)));

  const answerChips = [
    answers.vehicleType,
    answers.useCase,
    answers.familySize,
    answers.powertrain,
    answers.priceRange,
  ].filter(Boolean);

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

  function restoreAll() {
    setDismissed(new Set());
  }

  return (
    <div>
      <div className="text-center">
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
          Sorted by fit to your answers — flagged picks jump to the top.
        </p>
        {answerChips.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
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
        {answers.notes && (
          <p className="mx-auto mt-4 max-w-xl text-sm text-zinc-500 italic">
            &ldquo;{answers.notes}&rdquo;
          </p>
        )}
      </div>

      {visible.length > 0 ? (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              flagged={flagged.has(vehicle.id)}
              onDismiss={() => dismiss(vehicle.id)}
              onToggleFlag={() => toggleFlag(vehicle.id)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <p className="text-lg font-semibold text-white">You dismissed everything.</p>
          <p className="mt-2 text-sm text-zinc-400">Restore the list, or start the questionnaire over.</p>
          <button
            type="button"
            onClick={restoreAll}
            className="mt-6 rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Restore All
          </button>
        </div>
      )}

      <div className="mt-16 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center sm:p-10">
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

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onStartOver}
          className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}

export function Matchmaker() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [done, setDone] = useState(false);

  const currentStep = STEPS[step];

  function select(id: keyof Answers, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setDone(true);
    }
  }

  function setText(id: keyof Answers, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function continueFromText() {
    setDone(true);
  }

  function startOver() {
    setAnswers(EMPTY_ANSWERS);
    setStep(0);
    setDone(false);
  }

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
            <ResultsScreen answers={answers} onStartOver={startOver} />
          ) : (
            <div className="grid gap-6 md:grid-cols-[1fr_320px]">
              <QuestionPanel
                step={currentStep}
                stepIndex={step}
                totalSteps={STEPS.length}
                value={answers[currentStep.id]}
                onSelect={(value) => select(currentStep.id, value)}
                onTextChange={(value) => setText(currentStep.id, value)}
                onBack={goBack}
                onContinue={continueFromText}
                onSkip={continueFromText}
              />
              <BuildingVisual answers={answers} currentStepId={currentStep.id} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
