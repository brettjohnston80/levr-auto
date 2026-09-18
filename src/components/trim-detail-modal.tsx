"use client";

import { createPortal } from "react-dom";
import type { TrimOption } from "@/lib/finalize-trims";
import type { ConfiguratorChoice, ConfiguratorQuestions } from "@/lib/configurator-matching";
import { PriceTag, PackageNote } from "@/components/configurator-questions";
import { ColorDot, Thumb } from "@/components/ranking-question";

// Single-trim detail modal (2026-09-19) -- the "Details" button's target,
// both from the plain trim list and from trim-comparison-modal.tsx's
// column headers. Deliberately a SEPARATE modal from the comparison
// table, not the same table scoped to one column -- same precedent
// Matchmaker's own "More info" button already established (opens
// VehicleDetailModal, a genuinely different view, not ComparisonModal
// narrowed to one vehicle). A comparison cell has to stay compact; this
// modal has the room to show every real name, price, and package in full,
// which is the whole reason it exists as its own thing.
//
// Portaled + higher z-index than the comparison modal (2026-09-19,
// mirrors VehicleDetailModal's own z-[110]-over-z-[100] reasoning
// verbatim) -- this can open WHILE the comparison modal (z-[100]) is
// still open behind it, and drive-transition-provider.tsx's
// will-change-transform wrapper around <main> creates a new containing
// block for any position: fixed descendant, so the portal is not
// optional either way.

function formatCents(cents: number | null): string {
  if (cents == null) return "";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** A feature name that's `standard` on this trim, rendered through the
 *  exact same ChoiceRow/PriceTag path as a real priced ConfiguratorChoice
 *  -- fabricated here only because featuresStandard is names-only
 *  (2026-09-17, combination-preferences), never a full choice. Read-only,
 *  never saved: this modal writes nothing about features at all. */
function standardChoice(name: string): ConfiguratorChoice {
  return {
    name,
    availability: "standard",
    priceCents: 0,
    priceIsIncluded: true,
    packageName: null,
    packagePriceCents: null,
    packageContents: null,
  };
}

function ChoiceRow({ choice }: { choice: ConfiguratorChoice }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <span className="flex shrink-0 items-center gap-1.5">
        <Thumb item={{ id: choice.name, label: choice.name, imageUrl: choice.imageUrl ?? null }} />
        <ColorDot item={{ id: choice.name, label: choice.name, swatch: choice.swatch ?? null }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 text-sm font-medium text-white">{choice.name}</span>
          <PriceTag choice={choice} />
        </div>
        <PackageNote choice={choice} />
      </div>
    </li>
  );
}

function Section({ title, choices }: { title: string; choices: ConfiguratorChoice[] }) {
  if (choices.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title} ({choices.length})
      </p>
      <ul className="mt-2 space-y-1.5">
        {choices.map((c) => (
          <ChoiceRow key={c.name} choice={c} />
        ))}
      </ul>
    </div>
  );
}

export function TrimDetailModal({
  make,
  model,
  trim,
  questions,
  isRanked,
  isExcluded,
  rankPosition,
  onRank,
  onExclude,
  onUndo,
  onClose,
}: {
  make: string;
  model: string;
  trim: TrimOption;
  questions: ConfiguratorQuestions | null;
  isRanked: boolean;
  isExcluded: boolean;
  rankPosition: number | null;
  onRank: () => void;
  onExclude: () => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[110] overflow-y-auto bg-black/70 px-6 py-12 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          >
            <CloseIcon />
          </button>

          <h2 className="pr-10 text-xl font-semibold text-white">
            {trim.trim}
            {trim.year != null ? <span className="ml-1.5 font-normal text-zinc-500">{trim.year}</span> : null}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {make} {model} &middot; {formatCents(trim.minPriceCents)}
            {trim.maxPriceCents && trim.maxPriceCents !== trim.minPriceCents
              ? `–${formatCents(trim.maxPriceCents)}`
              : ""}{" "}
            &middot; {trim.count} available nationwide
          </p>

          {/* Not read-only -- ranking/excluding here is the exact same
              real action as the plain list and the comparison table,
              through the same handleTrimRanking write. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isRanked ? (
              <>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                  Ranked #{rankPosition}
                </span>
                <button
                  type="button"
                  onClick={onUndo}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-300 hover:border-white/35"
                >
                  Remove from ranking
                </button>
              </>
            ) : isExcluded ? (
              <>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
                  Excluded
                </span>
                <button
                  type="button"
                  onClick={onUndo}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-300 hover:border-white/35"
                >
                  Undo
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onRank}
                  className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
                >
                  Rank this trim
                </button>
                <button
                  type="button"
                  onClick={onExclude}
                  className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-zinc-400 hover:border-amber-500/60 hover:text-amber-300"
                >
                  Exclude
                </button>
              </>
            )}
          </div>

          {questions ? (
            <>
              <Section title="Exterior colors" choices={questions.exteriorColorRaw} />
              <Section title="Interior" choices={questions.interiorRaw} />
              <Section title="Seating" choices={questions.seatingRaw} />
              <Section title="Wheels" choices={questions.wheels} />
              <Section title="Roof" choices={questions.roof} />
              <Section title="Drivetrain" choices={questions.drivetrain} />
              <Section
                title="Features"
                choices={[
                  ...questions.features,
                  ...questions.featuresStandard.map(standardChoice),
                ]}
              />
            </>
          ) : (
            <p className="mt-5 text-sm text-zinc-500">
              This trim doesn&apos;t have researched build data from {make}/{model}&apos;s own
              configurator — no exact colour, interior, or feature options to show. It&apos;s still
              fully searchable, just without that extra detail.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
