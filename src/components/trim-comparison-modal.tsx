"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsNarrowViewport } from "@/lib/use-is-narrow-viewport";
import type { TrimOption } from "@/lib/finalize-trims";
import { groupIntoPackages, type ConfiguratorQuestions } from "@/lib/configurator-matching";
import {
  cellsDiffer,
  computeChoiceComparisonRows,
  computeFeatureComparisonRows,
  seatingCell,
  seatingIsDifferentiator,
  summarizeDrivetrain,
  summarizeRoof,
  summarizeWheels,
  type ChoiceComparisonRow,
  type ComparisonCell,
} from "@/lib/trim-comparison";
import { ColorDot, Thumb } from "@/components/ranking-question";
import { resolveWheelImage } from "@/lib/vehicle-wheel-images";

// The trim comparison view (2026-09-19) -- a decision aid for the trim
// ranking step itself, distinct from combination-preferences (which only
// exists once trim AND colour/interior/seating are already ranked). Width
// handling is lifted directly from Matchmaker's own ComparisonModal
// (matchmaker.tsx) rather than re-derived: table-layout: fixed only reads
// widths from the <thead> row, a min-width on individual cells does
// NOTHING under fixed layout (the floor has to live on the <table>
// itself), the label column width has to be one JS constant feeding both
// the column calc() and the table min-width (never a CSS-only `sm:`
// class, which would desync the two), and header stacking is keyed to the
// MEASURED column width via ResizeObserver, never a viewport breakpoint --
// see ComparisonModal's own comments for the real bugs each of these
// closes.
//
// Deliberately NO cap and NO "+ Add" tile, unlike Matchmaker's FLAG_CAP=5.
// The comparison set there is an open-ended national catalog the customer
// curates by flagging; here it's just `trimOptions` -- real inventory for
// this exact search, confirmed to run 4-7 per model across every
// Toyota/Honda make with live synced inventory (2026-09-19). Nothing to
// add or cap: every real trim shows, and a model with more columns than
// fit simply scrolls horizontally, the same fallback ComparisonModal
// already relies on at high counts.

export interface TrimComparisonModalProps {
  make: string;
  model: string;
  trimOptions: TrimOption[];
  configuratorQuestions: Record<string, ConfiguratorQuestions>;
  /** Trim ranking, unowned by this component -- same onChange contract
   *  RankingQuestion itself uses, so Rank/Exclude/Undo/Remove here call
   *  through to the exact same handleTrimRanking the plain trim list
   *  already uses. See the header note below: this is NOT read-only. */
  ranked: string[];
  excluded: string[];
  onChange: (ranked: string[], excluded: string[]) => void;
  onOpenDetail: (trimId: string) => void;
  onClose: () => void;
}

function formatCents(cents: number | null): string {
  if (cents == null) return "";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const CELL_TONE_CLASSES: Record<ComparisonCell["tone"], string> = {
  free: "text-emerald-400/80",
  cost: "text-zinc-300",
  unknown: "text-amber-400/90",
  none: "text-zinc-600",
};

function Cell({ cell }: { cell: ComparisonCell }) {
  return <span className={`text-sm ${CELL_TONE_CLASSES[cell.tone]}`}>{cell.text}</span>;
}

/**
 * A category divider row (2026-09-20 reorg) -- same th-sticky-left/td
 * shape every other row here already uses, not a colSpan'd single cell,
 * so it stays pinned on horizontal scroll exactly like every data row
 * does. `onToggle` absent means non-collapsible (Overview, the only
 * always-visible category, per the approved plan) -- rendered as a plain
 * label with no +/- control, same convention AccountFaqSection uses for
 * its own expand/collapse indicator, just without the toggle affordance
 * when there's nothing to toggle.
 *
 * `perTrimSummary` (2026-09-21, correcting the first collapsed-summary
 * pass) renders per TRIM COLUMN, only while COLLAPSED -- e.g. "3 colors"
 * under one trim, "8 colors" under another. The original version of this
 * put one AGGREGATE count in the label column instead, which read as one
 * shared fact about the whole comparison rather than what actually
 * differs trim to trim -- the entire point of a comparison table. Once
 * expanded, the real rows underneath already say everything a per-trim
 * count would, so nothing renders in these cells then either.
 */
function CategoryHeaderRow({
  label,
  expanded,
  onToggle,
  perTrimSummary,
  trimIds,
}: {
  label: string;
  expanded: boolean;
  onToggle?: () => void;
  perTrimSummary?: (trimId: string) => string;
  trimIds: string[];
}) {
  return (
    <tr className="border-t border-white/10">
      <th scope="row" className="sticky left-0 z-10 bg-zinc-950 pt-5 pb-2 pr-4 text-left align-top">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
          >
            {label}
            <span className="text-sm normal-case tracking-normal text-zinc-500">
              {expanded ? "−" : "+"}
            </span>
          </button>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            {label}
          </span>
        )}
      </th>
      {trimIds.map((id) => (
        <td key={id} className="px-4 pt-5 pb-2 align-top text-xs text-zinc-500">
          {!expanded && perTrimSummary ? perTrimSummary(id) : null}
        </td>
      ))}
    </tr>
  );
}

/**
 * A light, non-collapsible sub-divider within "Colors & Interior" --
 * "Exterior colors" / "Interior" -- distinct from CategoryHeaderRow's
 * bolder top-level styling so the hierarchy (category > sub-group) reads
 * clearly rather than looking like two co-equal categories. Same
 * th-sticky-left/td shape as every other row here, for the same
 * horizontal-scroll-pinning reason.
 *
 * `perTrimSummary` (2026-09-21) -- same per-column-count contract as
 * CategoryHeaderRow's own, one level down: while the PARENT category is
 * collapsed, this row is what actually shows "3 colors" under one trim
 * and "8 colors" under another (Colors & Interior spans two real
 * sub-groups, so the count belongs here, not on the category row itself,
 * which stays a bare label + toggle with no aggregate of its own).
 */
function ChoiceGroupLabel({
  label,
  trimIds,
  perTrimSummary,
}: {
  label: string;
  trimIds: string[];
  perTrimSummary?: (trimId: string) => string;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-zinc-950 pt-3 pb-1 pr-4 text-left align-top text-[10px] font-semibold uppercase tracking-wide text-zinc-600"
      >
        {label}
      </th>
      {trimIds.map((id) => (
        <td key={id} className="px-4 pt-3 pb-1 align-top text-xs font-normal normal-case tracking-normal text-zinc-500">
          {perTrimSummary ? perTrimSummary(id) : null}
        </td>
      ))}
    </tr>
  );
}

/**
 * One row per colour/interior NAME (2026-09-20) -- replaces the old
 * SwatchRow, which crammed a trim's whole colour list (up to 4 dots plus
 * a "+N more" count) into a single cell with no way to show which of the
 * OTHER compared trims also offered it. The photo/swatch identifies the
 * row once, in the sticky label column; each trim's own cell shows only
 * its availability/price (Cell, via priceCellFor) rather than repeating
 * the same swatch across every column -- a real trim set here runs
 * 7-12+ colours, so keeping the swatch to one copy per row is what keeps
 * this readable rather than just longer.
 */
function ChoiceRow({ row, trimOptions }: { row: ChoiceComparisonRow; trimOptions: TrimOption[] }) {
  return (
    <tr className="border-t border-white/5">
      <th scope="row" className="sticky left-0 z-10 bg-zinc-950 py-2.5 pr-4 text-left align-top">
        <span className="flex items-center gap-2">
          <Thumb item={{ id: row.name, label: row.name, imageUrl: row.imageUrl }} />
          <ColorDot item={{ id: row.name, label: row.name, swatch: row.swatch }} />
          <span className="text-xs font-medium break-words text-zinc-300">{row.name}</span>
        </span>
      </th>
      {trimOptions.map((opt) => (
        <td key={opt.id} className="px-4 py-2.5 align-top">
          <Cell cell={row.cellsByTrimId[opt.id]} />
        </td>
      ))}
    </tr>
  );
}

export function TrimComparisonModal({
  make,
  model,
  trimOptions,
  configuratorQuestions,
  ranked,
  excluded,
  onChange,
  onOpenDetail,
  onClose,
}: TrimComparisonModalProps) {
  const trimIds = trimOptions.map((o) => o.id);

  // Mirrors RankingQuestion's own rank/unrank/exclude/unexclude exactly
  // (ranking-question.tsx) -- trim's own removeMeansExclude is false
  // there (the default), so unexclude releases back to the neutral pool,
  // not back into "Your order". Reimplemented inline rather than
  // importing RankingQuestion itself, which renders a whole list UI, not
  // a single per-column action -- but the SET ARITHMETIC below must stay
  // byte-identical to that component's own, since both write through the
  // same onChange down to the same handleTrimRanking.
  const rank = (id: string) => onChange([...ranked, id], excluded.filter((e) => e !== id));
  const unrank = (id: string) => onChange(ranked.filter((r) => r !== id), excluded);
  const exclude = (id: string) => onChange(ranked.filter((r) => r !== id), [...excluded, id]);
  const unexclude = (id: string) => onChange(ranked, excluded.filter((e) => e !== id));

  const isNarrow = useIsNarrowViewport();
  const LABEL_COLUMN_WIDTH_PX = isNarrow ? 104 : 160;
  const TRIM_COLUMN_MIN_WIDTH_PX = 160;
  const HEADER_STACK_MIN_COLUMN_PX = 240;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollerWidth, setScrollerWidth] = useState(0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScrollerWidth(el.clientWidth));
    setScrollerWidth(el.clientWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const realColumnWidth = `calc((100% - ${LABEL_COLUMN_WIDTH_PX}px) / ${trimIds.length})`;
  const tableMinWidthPx = LABEL_COLUMN_WIDTH_PX + trimIds.length * TRIM_COLUMN_MIN_WIDTH_PX;
  const tableWidthPx = Math.max(scrollerWidth, tableMinWidthPx);
  const columnWidthPx =
    trimIds.length > 0 ? (tableWidthPx - LABEL_COLUMN_WIDTH_PX) / trimIds.length : 0;
  const headerStacked = columnWidthPx < HEADER_STACK_MIN_COLUMN_PX;

  const showSeating = seatingIsDifferentiator(trimIds, configuratorQuestions);
  const wheelsCells = trimIds.map((id) => summarizeWheels(configuratorQuestions[id]));
  // Per-column, not merged into wheelsCells itself, and only shown when
  // that column's OWN cell reads "Standard" -- summarizeWheels prefers a
  // priced upgrade's cost over "Standard" whenever a trim has one (e.g.
  // Civic Sport's real $1,600 Black Coal Alloy option), and no photo
  // exists for any upgrade. Showing the standard wheel's photo next to a
  // "+$1,600" cell would misrepresent what that price is for -- see
  // Highlights' own identical guard in trim-detail-modal.tsx.
  const wheelImageUrls = trimOptions.map((opt, i) =>
    wheelsCells[i].text === "Standard"
      ? resolveWheelImage(make, model, opt.trim, configuratorQuestions[opt.id]?.bodyStyle ?? null)
      : null,
  );
  const roofCells = trimIds.map((id) => summarizeRoof(configuratorQuestions[id]));
  const drivetrainCells = trimIds.map((id) => summarizeDrivetrain(configuratorQuestions[id]));
  const showWheels = cellsDiffer(wheelsCells);
  const showRoof = cellsDiffer(roofCells);
  const showDrivetrain = cellsDiffer(drivetrainCells);
  const showPerformance = showWheels || showRoof || showDrivetrain;
  const featureRows = computeFeatureComparisonRows(trimIds, configuratorQuestions);
  const exteriorColorRows = computeChoiceComparisonRows(
    trimIds,
    configuratorQuestions,
    (q) => q.exteriorColorRaw,
  );
  const interiorRows = computeChoiceComparisonRows(trimIds, configuratorQuestions, (q) => q.interiorRaw);
  const showColorsInterior = exteriorColorRows.length > 0 || interiorRows.length > 0;

  // Categorized collapsible sections, now defaulting to all-COLLAPSED
  // (2026-09-21, reversing the earlier all-expanded default per Brett's
  // explicit request) -- Overview is deliberately NOT one of these three,
  // it has no toggle at all, see CategoryHeaderRow.
  const [colorsExpanded, setColorsExpanded] = useState(false);
  const [performanceExpanded, setPerformanceExpanded] = useState(false);
  const [featuresExpanded, setFeaturesExpanded] = useState(false);

  // Collapsed-state PER-TRIM summaries (2026-09-21, correcting the first
  // pass -- see CategoryHeaderRow's own comment for why this replaced a
  // single aggregate line entirely rather than supplementing it). Each
  // function reads a specific trim's own already-fetched data -- no new
  // fetch, no new shape, just a per-trim count instead of a cross-trim one.
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  const exteriorCountFor = (trimId: string): string => {
    const n = configuratorQuestions[trimId]?.exteriorColorRaw.length ?? 0;
    return n > 0 ? plural(n, "color") : "—";
  };
  const interiorCountFor = (trimId: string): string => {
    const n = configuratorQuestions[trimId]?.interiorRaw.length ?? 0;
    return n > 0 ? plural(n, "option") : "—";
  };

  // Performance's per-trim count is "of the spec rows this table is
  // actually showing (showWheels/showRoof/showDrivetrain, decided once
  // across the whole compared set), how many does THIS trim have real
  // data for" -- not a bare re-statement of the shown-row count, since a
  // trim genuinely missing one category (summarizeWheels et al. return
  // the "none"-tone DASH only when that trim's own array is empty) should
  // show fewer specs than a trim with full data, even though both are
  // being compared on the same shown rows.
  const performanceRows: { show: boolean; cells: ComparisonCell[] }[] = [
    { show: showWheels, cells: wheelsCells },
    { show: showRoof, cells: roofCells },
    { show: showDrivetrain, cells: drivetrainCells },
  ];
  const performanceCountFor = (trimId: string): string => {
    const i = trimIds.indexOf(trimId);
    const n = performanceRows.filter((r) => r.show && r.cells[i]?.tone !== "none").length;
    return n > 0 ? plural(n, "spec") : "—";
  };

  const featuresCountFor = (trimId: string): string => {
    const q = configuratorQuestions[trimId];
    const n = q ? groupIntoPackages(q.features).length : 0;
    return n > 0 ? `${n} obtainable` : "—";
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950" onClick={onClose}>
      <div
        className="flex shrink-0 flex-col gap-1 border-b border-white/10 px-6 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Comparing {trimIds.length} {make} {model} trims
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>
        {/* Not read-only, and said plainly: ranking or excluding from here
            is the same real action as the plain list below -- same
            handleTrimRanking write, not a preview. */}
        <p className="text-xs text-zinc-500">
          Ranking or excluding a trim here saves it immediately — the same as using the list below.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6" onClick={(e) => e.stopPropagation()}>
        <div ref={scrollerRef} className="overflow-x-auto">
          <table
            className="w-full table-fixed border-separate border-spacing-0"
            style={{ minWidth: `${tableMinWidthPx}px` }}
          >
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-10 bg-zinc-950"
                  style={{ width: `${LABEL_COLUMN_WIDTH_PX}px` }}
                />
                {trimOptions.map((opt) => {
                  const isRanked = ranked.includes(opt.id);
                  const isExcluded = excluded.includes(opt.id);
                  const rankPosition = isRanked ? ranked.indexOf(opt.id) + 1 : null;
                  return (
                    <th key={opt.id} style={{ width: realColumnWidth }} className="px-4 pb-4 text-left align-top">
                      <div
                        className={
                          headerStacked
                            ? "flex flex-col gap-2"
                            : "flex flex-row items-start justify-between gap-2"
                        }
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold break-words text-white">
                            {opt.trim}
                            {opt.year != null ? (
                              <span className="ml-1.5 font-normal text-zinc-500">{opt.year}</span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-emerald-400">
                            {formatCents(opt.minPriceCents)}
                            {opt.maxPriceCents && opt.maxPriceCents !== opt.minPriceCents
                              ? `–${formatCents(opt.maxPriceCents)}`
                              : ""}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            {opt.count} available nationwide
                          </p>
                          {!configuratorQuestions[opt.id] && (
                            <p className="mt-0.5 text-[11px] text-zinc-600">inventory only</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(opt.id)}
                            className="text-[11px] font-semibold text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
                          >
                            Details
                          </button>
                          {isRanked ? (
                            <div className="flex items-center gap-1">
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                                Ranked #{rankPosition}
                              </span>
                              <button
                                type="button"
                                onClick={() => unrank(opt.id)}
                                aria-label={`Remove ${opt.trim} from your ranking`}
                                className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-500 hover:bg-white/10 hover:text-white"
                              >
                                <CloseIcon size={11} />
                              </button>
                            </div>
                          ) : isExcluded ? (
                            <div className="flex items-center gap-1">
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                                Excluded
                              </span>
                              <button
                                type="button"
                                onClick={() => unexclude(opt.id)}
                                className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-zinc-300 hover:border-white/35"
                              >
                                Undo
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => rank(opt.id)}
                                className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-zinc-950 hover:bg-emerald-400"
                              >
                                Rank #{ranked.length + 1}
                              </button>
                              <button
                                type="button"
                                onClick={() => exclude(opt.id)}
                                className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-semibold text-zinc-400 hover:border-amber-500/60 hover:text-amber-300"
                              >
                                Exclude
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Overview -- always visible, no toggle. Price and Available
                  are deliberately NOT here: both now render in the sticky
                  header above (opt.count was added there in this same
                  reorg specifically so dropping these two rows loses no
                  info, not just to avoid a duplicate). Seating is the only
                  row left worth a quick, un-collapsible glance -- everyone
                  compares seat count without digging into a category. */}
              {showSeating && (
                <>
                  <CategoryHeaderRow label="Overview" expanded trimIds={trimIds} />
                  <tr className="border-t border-white/5">
                    <th scope="row" className="sticky left-0 z-10 bg-zinc-950 py-3 pr-4 text-left align-top text-xs font-semibold text-zinc-400">
                      Seating
                    </th>
                    {trimOptions.map((opt) => (
                      <td key={opt.id} className="px-4 py-3 align-top">
                        <Cell cell={seatingCell(configuratorQuestions[opt.id])} />
                      </td>
                    ))}
                  </tr>
                </>
              )}

              {showColorsInterior && (
                <>
                  <CategoryHeaderRow
                    label="Colors & Interior"
                    expanded={colorsExpanded}
                    onToggle={() => setColorsExpanded((v) => !v)}
                    trimIds={trimIds}
                  />
                  {colorsExpanded ? (
                    <>
                      {exteriorColorRows.length > 0 && (
                        <>
                          <ChoiceGroupLabel label="Exterior colors" trimIds={trimIds} />
                          {exteriorColorRows.map((row) => (
                            <ChoiceRow key={row.name} row={row} trimOptions={trimOptions} />
                          ))}
                        </>
                      )}
                      {interiorRows.length > 0 && (
                        <>
                          <ChoiceGroupLabel label="Interior" trimIds={trimIds} />
                          {interiorRows.map((row) => (
                            <ChoiceRow key={row.name} row={row} trimOptions={trimOptions} />
                          ))}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {exteriorColorRows.length > 0 && (
                        <ChoiceGroupLabel
                          label="Exterior colors"
                          trimIds={trimIds}
                          perTrimSummary={exteriorCountFor}
                        />
                      )}
                      {interiorRows.length > 0 && (
                        <ChoiceGroupLabel
                          label="Interior"
                          trimIds={trimIds}
                          perTrimSummary={interiorCountFor}
                        />
                      )}
                    </>
                  )}
                </>
              )}

              {showPerformance && (
                <>
                  <CategoryHeaderRow
                    label="Performance"
                    expanded={performanceExpanded}
                    onToggle={() => setPerformanceExpanded((v) => !v)}
                    perTrimSummary={performanceCountFor}
                    trimIds={trimIds}
                  />
                  {performanceExpanded && (
                    <>
                      {showWheels && (
                        <tr className="border-t border-white/5">
                          <th scope="row" className="sticky left-0 z-10 bg-zinc-950 py-3 pr-4 text-left align-top text-xs font-semibold text-zinc-400">
                            Wheels
                          </th>
                          {trimOptions.map((opt, i) => (
                            <td key={opt.id} className="px-4 py-3 align-top">
                              <div className="flex items-start gap-2">
                                <Cell cell={wheelsCells[i]} />
                                {wheelImageUrls[i] && (
                                  <Thumb
                                    item={{ id: `wheels-${opt.id}`, label: `${opt.trim} wheels`, imageUrl: wheelImageUrls[i] }}
                                  />
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      )}
                      {showRoof && (
                        <tr className="border-t border-white/5">
                          <th scope="row" className="sticky left-0 z-10 bg-zinc-950 py-3 pr-4 text-left align-top text-xs font-semibold text-zinc-400">
                            Roof
                          </th>
                          {trimOptions.map((opt, i) => (
                            <td key={opt.id} className="px-4 py-3 align-top">
                              <Cell cell={roofCells[i]} />
                            </td>
                          ))}
                        </tr>
                      )}
                      {showDrivetrain && (
                        <tr className="border-t border-white/5">
                          <th scope="row" className="sticky left-0 z-10 bg-zinc-950 py-3 pr-4 text-left align-top text-xs font-semibold text-zinc-400">
                            Drivetrain
                          </th>
                          {trimOptions.map((opt, i) => (
                            <td key={opt.id} className="px-4 py-3 align-top">
                              <Cell cell={drivetrainCells[i]} />
                            </td>
                          ))}
                        </tr>
                      )}
                    </>
                  )}
                </>
              )}

              {featureRows.length > 0 && (
                <>
                  <CategoryHeaderRow
                    label="Features"
                    expanded={featuresExpanded}
                    onToggle={() => setFeaturesExpanded((v) => !v)}
                    perTrimSummary={featuresCountFor}
                    trimIds={trimIds}
                  />
                  {featuresExpanded &&
                    featureRows.map((row) => (
                      <tr key={row.name} className="border-t border-white/5">
                        <th scope="row" className="sticky left-0 z-10 bg-zinc-950 py-3 pr-4 text-left align-top text-xs font-semibold text-zinc-400">
                          {row.name}
                        </th>
                        {trimOptions.map((opt) => (
                          <td key={opt.id} className="px-4 py-3 align-top">
                            <Cell cell={row.cellsByTrimId[opt.id]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  );
}
