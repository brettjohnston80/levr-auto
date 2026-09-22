"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { TrimOption } from "@/lib/finalize-trims";
import { groupIntoPackages, type ConfiguratorChoice, type ConfiguratorQuestions } from "@/lib/configurator-matching";
import {
  DASH,
  roofChoiceIsRedundant,
  seatingCell,
  summarizeDrivetrain,
  summarizeRoof,
  summarizeWheels,
  type ComparisonCell,
} from "@/lib/trim-comparison";
import { PriceTag, PackageNote } from "@/components/configurator-questions";
import { ColorDot, Thumb } from "@/components/ranking-question";
import { resolveWheelImage } from "@/lib/vehicle-wheel-images";

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
// standardChoice/ChoiceRow/Section exported (2026-09-18) so the read-only
// full-spec view on /account/vehicle can reuse them verbatim -- same "one
// implementation, can't drift" reasoning as PriceTag/PackageNote's own
// export from configurator-questions.tsx. That page needs the identical
// name + swatch/photo + price + package-note row format this modal
// already renders, just fed the customer's own ranked selections instead
// of a trim's full unfiltered option list.
export function standardChoice(name: string): ConfiguratorChoice {
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

export function ChoiceRow({ choice }: { choice: ConfiguratorChoice }) {
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

export function Section({ title, choices }: { title: string; choices: ConfiguratorChoice[] }) {
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

// Highlights tab (2026-09-21) -- compact/visual-first, distinct in kind
// from "All details" below: no names, no prices, no itemized package
// contents, just the minimum a customer needs to get a feel for this
// trim at a glance. Reads the exact same `questions` fields the existing
// Section-based "All details" tab already reads -- zero new props, zero
// new fetch.

/** Byte-identical twin of trim-comparison-modal.tsx's own CELL_TONE_CLASSES
 *  -- a 4-entry style map is cheap enough to keep in sync by eye, same
 *  precedent as this session's other small intentional twins (e.g.
 *  combinations-question.tsx's extraCostCentsFor next to priceCellFor). */
const CELL_TONE_CLASSES: Record<ComparisonCell["tone"], string> = {
  free: "text-emerald-400/80",
  cost: "text-zinc-300",
  unknown: "text-amber-400/90",
  none: "text-zinc-600",
};

/**
 * One colour/interior swatch cell for the Highlights grid -- ONE visual
 * per cell (photo preferred, else swatch, else a placeholder), not the
 * photo+swatch PAIR every other surface in this app shows side by side
 * (ChoiceRow just above, the plain trim list, combinations cards). That
 * pairing is right in a list row with room to spare; doubling every cell's
 * width here would cut how many fit per row roughly in half, undermining
 * the whole point of a dense grid. `title` carries the name for hover/
 * accessibility -- the grid itself shows no text, per the approved plan.
 *
 * ⚠ Real photos and hand-checked swatches both exist for Toyota Camry and
 * Honda Civic ONLY (vehicle-color-swatches.ts) -- every other configurator
 * make/model has neither for most colours. A blank cell there would be
 * worse than today's named list, so a colour with neither renders a
 * muted first-letter placeholder square instead of nothing (Brett's
 * explicit call, 2026-09-21).
 */
function ColorGridCell({ choice }: { choice: ConfiguratorChoice }) {
  if (choice.imageUrl) {
    return (
      <span title={choice.name}>
        <Thumb item={{ id: choice.name, label: choice.name, imageUrl: choice.imageUrl }} />
      </span>
    );
  }
  if (choice.swatch) {
    return (
      <span title={choice.name}>
        <ColorDot item={{ id: choice.name, label: choice.name, swatch: choice.swatch }} />
      </span>
    );
  }
  return (
    <span
      title={choice.name}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-sm font-semibold text-zinc-500"
    >
      {choice.name.charAt(0).toUpperCase()}
    </span>
  );
}

function ColorGrid({ title, choices }: { title: string; choices: ConfiguratorChoice[] }) {
  if (choices.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">{title}</p>
      <div className="mt-1.5 grid grid-cols-5 gap-2 sm:grid-cols-8">
        {choices.map((c) => (
          <ColorGridCell key={c.name} choice={c} />
        ))}
      </div>
    </div>
  );
}

/** One compact "Label: value" line, reusing the exact same summarizer
 *  functions trim-comparison-modal.tsx's own Performance rows already
 *  use -- e.g. "Wheels: Standard", "Roof: +$870" -- rather than the full
 *  per-choice list "All details" shows. `cell` already carries the tone
 *  (free/cost/unknown/none) the shared class map colours. */
function SpecLine({ label, cell }: { label: string; cell: ComparisonCell }) {
  return (
    <p className="mt-1 text-sm">
      <span className="text-zinc-500">{label}:</span>{" "}
      <span className={CELL_TONE_CLASSES[cell.tone]}>{cell.text}</span>
    </p>
  );
}

/** One package/feature pill -- name plus PriceTag's own short price text
 *  (the same component "All details" already uses), no itemized package
 *  contents. Standard (already-included) features are deliberately
 *  omitted from Highlights entirely -- see the caller below. */
function FeatureChip({ choice }: { choice: ConfiguratorChoice }) {
  return (
    <span
      title={choice.name}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-300"
    >
      {choice.name}
      <PriceTag choice={choice} />
    </span>
  );
}

function Highlights({
  make,
  model,
  trim,
  questions,
}: {
  make: string;
  model: string;
  trim: string;
  questions: ConfiguratorQuestions | null;
}) {
  if (!questions) {
    return (
      <p className="mt-5 text-sm text-zinc-500">
        This trim doesn&apos;t have researched build data from {make}/{model}&apos;s own
        configurator — no exact colour, interior, or feature options to show. It&apos;s still
        fully searchable, just without that extra detail.
      </p>
    );
  }

  const hasColors = questions.exteriorColorRaw.length > 0 || questions.interiorRaw.length > 0;
  const obtainablePackages = groupIntoPackages(questions.features);
  // Gated on the SUMMARIZER's own output, not the raw questions.roof
  // array length -- a redundant priced choice (roofChoiceIsRedundant)
  // still leaves a non-empty raw array, but summarizeRoof correctly
  // collapses it to DASH; the raw-length check was blind to that and is
  // what let "Roof: —" render here after the redundancy fix (2026-09-22)
  // instead of the line disappearing the way every other DASH-producing
  // spec here already does when its own array is genuinely empty.
  const roofCell = summarizeRoof(questions);
  const showRoof = roofCell !== DASH;
  const wheelsCell = summarizeWheels(questions);
  // Only shown when the SpecLine is genuinely describing the photographed
  // wheel -- summarizeWheels prefers a priced upgrade's cost over
  // "Standard" whenever a trim has one (e.g. Civic Sport's real $1,600
  // Black Coal Alloy option), and no photo exists for any upgrade. Pairing
  // the standard wheel's photo next to a line reading "+$1,600" would
  // misrepresent what that price is actually for; All-details doesn't
  // have this risk since it lists the standard and upgrade rows
  // separately, each with its own correct (photo or no-photo) pairing.
  const wheelImageUrl =
    wheelsCell.text === "Standard" ? resolveWheelImage(make, model, trim, questions.bodyStyle) : null;

  return (
    <div className="mt-5 space-y-5">
      {hasColors && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorGrid title="Exterior" choices={questions.exteriorColorRaw} />
          <ColorGrid title="Interior" choices={questions.interiorRaw} />
        </div>
      )}

      {(questions.seatingRaw.length > 0 ||
        questions.wheels.length > 0 ||
        showRoof ||
        questions.drivetrain.length > 0) && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Specs</p>
          {questions.seatingRaw.length > 0 && <SpecLine label="Seating" cell={seatingCell(questions)} />}
          {questions.wheels.length > 0 && (
            <div className="flex items-start gap-2">
              <SpecLine label="Wheels" cell={wheelsCell} />
              {wheelImageUrl && (
                <Thumb item={{ id: "wheels", label: `${trim} wheels`, imageUrl: wheelImageUrl }} />
              )}
            </div>
          )}
          {showRoof && <SpecLine label="Roof" cell={roofCell} />}
          {questions.drivetrain.length > 0 && (
            <SpecLine label="Drivetrain" cell={summarizeDrivetrain(questions)} />
          )}
        </div>
      )}

      {obtainablePackages.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
            Features & packages
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {obtainablePackages.map((c) => (
              <FeatureChip key={c.name} choice={c} />
            ))}
          </div>
        </div>
      )}
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
  // Local, resets to "Highlights" every open -- TrimDetailModal only ever
  // mounts while detailTrimId is non-null and fully unmounts on close (no
  // cross-trim remount-without-unmount path exists in either caller), so
  // there's no stale-tab-on-a-different-trim case to guard against.
  const [activeTab, setActiveTab] = useState<"highlights" | "all">("highlights");

  // Attached only to the SPECIFIC wheels choice with availability ===
  // "standard" -- never to a priced upgrade row a trim might also carry
  // (e.g. Civic's $1,600 Black Coal Alloy Wheels), which has no delivered
  // photo and must stay text-only. See vehicle-wheel-images.ts's own
  // comment for why this can't be resolved generically the way colour/
  // feature photos are.
  const wheelImageUrl = questions ? resolveWheelImage(make, model, trim.trim, questions.bodyStyle) : null;
  const allDetailsWheels =
    questions && wheelImageUrl
      ? questions.wheels.map((w) => (w.availability === "standard" ? { ...w, imageUrl: wheelImageUrl } : w))
      : (questions?.wheels ?? []);

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

          {questions && (
            <div className="mt-5 flex gap-1 border-b border-white/10">
              {(["highlights", "all"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`-mb-px border-b-2 px-1 pb-2 text-sm font-semibold transition-colors ${
                    activeTab === tab
                      ? "border-emerald-400 text-white"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab === "highlights" ? "Highlights" : "All details"}
                </button>
              ))}
            </div>
          )}

          {!questions ? (
            <p className="mt-5 text-sm text-zinc-500">
              This trim doesn&apos;t have researched build data from {make}/{model}&apos;s own
              configurator — no exact colour, interior, or feature options to show. It&apos;s still
              fully searchable, just without that extra detail.
            </p>
          ) : activeTab === "highlights" ? (
            <Highlights make={make} model={model} trim={trim.trim} questions={questions} />
          ) : (
            <>
              <Section title="Exterior colors" choices={questions.exteriorColorRaw} />
              <Section title="Interior" choices={questions.interiorRaw} />
              <Section title="Seating" choices={questions.seatingRaw} />
              <Section title="Wheels" choices={allDetailsWheels} />
              {/* Drops just the redundant choice, not the whole section
                  (2026-09-22) -- a trim whose ONLY roof choice duplicates
                  a Features entry at the same price loses the "ROOF"
                  heading entirely here (Section returns null on an empty
                  array), same outcome as the comparison table's row and
                  Highlights' spec line, both driven by the same
                  summarizeRoof fix. See roofChoiceIsRedundant's own
                  comment for the real-data investigation behind this. */}
              <Section
                title="Roof"
                choices={questions.roof.filter((c) => !roofChoiceIsRedundant(c, questions.features))}
              />
              <Section title="Drivetrain" choices={questions.drivetrain} />
              {/* Grouped by package (2026-09-20 reversal) -- a multi-item
                  package renders as ONE row under its package name, not one
                  row per member feature, matching how the customer actually
                  ranks these on the features step. PackageNote already
                  handles both shapes (choice.name === choice.packageName
                  for the grouped row vs. a raw member choice) with no
                  changes needed here. */}
              <Section
                title="Features"
                choices={[
                  ...groupIntoPackages(questions.features),
                  ...questions.featuresStandard.map(standardChoice),
                ]}
              />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
