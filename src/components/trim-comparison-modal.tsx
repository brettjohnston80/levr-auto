"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsNarrowViewport } from "@/lib/use-is-narrow-viewport";
import type { TrimOption } from "@/lib/finalize-trims";
import type { ConfiguratorQuestions } from "@/lib/configurator-matching";
import {
  cellsDiffer,
  computeFeatureComparisonRows,
  seatingCell,
  seatingIsDifferentiator,
  summarizeDrivetrain,
  summarizeRoof,
  summarizeWheels,
  type ComparisonCell,
} from "@/lib/trim-comparison";
import { ColorDot, Thumb } from "@/components/ranking-question";

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

/** Up to 4 swatch dots + "+N more" -- the table cell's compact rendering
 *  of a colour/interior list. Full per-name list with price/package
 *  detail lives only in the single-trim detail modal (trim-detail-
 *  modal.tsx), which reads the same *Raw arrays directly. */
function SwatchRow({ choices }: { choices: ConfiguratorQuestions["exteriorColorRaw"] }) {
  if (choices.length === 0) return <Cell cell={{ text: "—", tone: "none" }} />;
  const shown = choices.slice(0, 4);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {shown.map((c) => (
          <span key={c.name} title={c.name} className="flex items-center">
            <Thumb item={{ id: c.name, label: c.name, imageUrl: c.imageUrl ?? null }} />
            <ColorDot item={{ id: c.name, label: c.name, swatch: c.swatch ?? null }} />
          </span>
        ))}
      </div>
      <span className="text-xs text-zinc-500">
        {choices.length} color{choices.length === 1 ? "" : "s"}
        {choices.length > shown.length ? ` (+${choices.length - shown.length} more)` : ""}
      </span>
    </div>
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
  const roofCells = trimIds.map((id) => summarizeRoof(configuratorQuestions[id]));
  const drivetrainCells = trimIds.map((id) => summarizeDrivetrain(configuratorQuestions[id]));
  const showWheels = cellsDiffer(wheelsCells);
  const showRoof = cellsDiffer(roofCells);
  const showDrivetrain = cellsDiffer(drivetrainCells);
  const featureRows = computeFeatureComparisonRows(trimIds, configuratorQuestions);

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
              <tr className="border-t border-white/5">
                <th scope="row" className="sticky left-0 z-10 bg-zinc-950 py-3 pr-4 text-left align-top text-xs font-semibold text-zinc-400">
                  Price
                </th>
                {trimOptions.map((opt) => (
                  <td key={opt.id} className="px-4 py-3 align-top text-sm text-zinc-300">
                    {formatCents(opt.minPriceCents)}
                    {opt.maxPriceCents && opt.maxPriceCents !== opt.minPriceCents
                      ? `–${formatCents(opt.maxPriceCents)}`
                      : ""}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-white/5">
                <th scope="row" className="sticky left-0 z-10 bg-zinc-950 py-3 pr-4 text-left align-top text-xs font-semibold text-zinc-400">
                  Available
                </th>
                {trimOptions.map((opt) => (
                  <td key={opt.id} className="px-4 py-3 align-top text-sm text-zinc-300">
                    {opt.count} nationwide
                  </td>
                ))}
              </tr>
              <tr className="border-t border-white/5">
                <th scope="row" className="sticky left-0 z-10 bg-zinc-950 py-3 pr-4 text-left align-top text-xs font-semibold text-zinc-400">
                  Exterior colors
                </th>
                {trimOptions.map((opt) => (
                  <td key={opt.id} className="px-4 py-3 align-top">
                    <SwatchRow choices={configuratorQuestions[opt.id]?.exteriorColorRaw ?? []} />
                  </td>
                ))}
              </tr>
              <tr className="border-t border-white/5">
                <th scope="row" className="sticky left-0 z-10 bg-zinc-950 py-3 pr-4 text-left align-top text-xs font-semibold text-zinc-400">
                  Interior
                </th>
                {trimOptions.map((opt) => (
                  <td key={opt.id} className="px-4 py-3 align-top">
                    <SwatchRow choices={configuratorQuestions[opt.id]?.interiorRaw ?? []} />
                  </td>
                ))}
              </tr>
              {showSeating && (
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
              )}
              {showWheels && (
                <tr className="border-t border-white/5">
                  <th scope="row" className="sticky left-0 z-10 bg-zinc-950 py-3 pr-4 text-left align-top text-xs font-semibold text-zinc-400">
                    Wheels
                  </th>
                  {trimOptions.map((opt, i) => (
                    <td key={opt.id} className="px-4 py-3 align-top">
                      <Cell cell={wheelsCells[i]} />
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
              {featureRows.map((row) => (
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
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  );
}
