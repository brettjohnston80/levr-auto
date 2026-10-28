"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useIsNarrowViewport } from "@/lib/use-is-narrow-viewport";
import {
  COMPARE_COPY,
  comparisonOrder,
  comparisonRows,
  lowestOtdOfferId,
  type CompareCell,
  type CompareOffer,
} from "@/lib/offer-comparison-rows";

export interface CompareColumn {
  offer: CompareOffer;
  dealerName: string;
  dealerCity: string | null;
  distanceMiles: number | null;
  levrating: { rating: number; count: number } | null;
  /** Opens that offer's detail view, where accepting happens (with its own confirm step). */
  href: string;
}

// Same widths as the trim comparison (trim-comparison-modal.tsx): one label-column constant,
// 160px minimum columns, the table's min-width carries the floor.
const LABEL_COLUMN_WIDTH_PX = 160;
const COLUMN_MIN_WIDTH_PX = 160;

const toneClass: Record<CompareCell["tone"], string> = {
  plain: "text-zinc-200",
  good: "text-emerald-300",
  muted: "text-zinc-500",
};

function CellLines({ cell }: { cell: CompareCell }) {
  return (
    <div className={`space-y-0.5 text-sm ${toneClass[cell.tone]}`}>
      {cell.lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}

function ColumnHeader({ col, lowest }: { col: CompareColumn; lowest: boolean }) {
  const meta = [col.dealerCity, col.distanceMiles != null ? COMPARE_COPY.miles(col.distanceMiles) : null].filter(Boolean).join(" · ");
  return (
    <div className="space-y-1">
      {lowest && (
        <span className="inline-block rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-950">
          {COMPARE_COPY.badge}
        </span>
      )}
      <p className="font-semibold text-white">{col.dealerName}</p>
      {meta && <p className="text-xs text-zinc-400">{meta}</p>}
      <p className="text-xs text-zinc-500">
        {col.levrating ? COMPARE_COPY.rating(col.levrating.rating, col.levrating.count) : COMPARE_COPY.noRating}
      </p>
      <a
        href={col.href}
        className="mt-1 inline-block rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5"
      >
        {COMPARE_COPY.viewAndAccept}
      </a>
    </div>
  );
}

export function OfferComparison({
  columns,
  picks,
}: {
  columns: CompareColumn[];
  picks: { exterior: string[]; interior: string[] };
}) {
  const [open, setOpen] = useState(false);
  const narrow = useIsNarrowViewport();
  const ordered = comparisonOrder(columns.map((c) => c.offer)).map((o) => columns.find((c) => c.offer.id === o.id)!);
  const lowestId = lowestOtdOfferId(ordered.map((c) => c.offer));
  // Phone: two offers at a time, each column with ‹ › to swap in another.
  const [pair, setPair] = useState<[number, number]>([0, 1]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (ordered.length < 2) return null;

  const step = (side: 0 | 1, dir: 1 | -1) =>
    setPair((p) => {
      const other = p[side === 0 ? 1 : 0];
      let next = p[side];
      do next = (next + dir + ordered.length) % ordered.length;
      while (next === other);
      return side === 0 ? [next, p[1]] : [p[0], next];
    });

  const shown = narrow ? [ordered[pair[0]], ordered[pair[1]]] : ordered;
  const rows = comparisonRows(shown.map((c) => c.offer), picks);
  const tableMinWidthPx = LABEL_COLUMN_WIDTH_PX + ordered.length * COLUMN_MIN_WIDTH_PX;
  const sortedPair = [...pair].sort((a, b) => a - b);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPair([0, 1]);
          setOpen(true);
        }}
        className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/5"
      >
        {COMPARE_COPY.button}
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] overflow-y-auto bg-black/70"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div className="flex min-h-full items-start justify-center p-0 sm:p-6">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="offer-compare-title"
                className="relative w-full max-w-6xl rounded-none border border-white/10 bg-zinc-950 p-4 sm:rounded-2xl sm:p-6"
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="absolute right-3 top-3 rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  ✕
                </button>
                <h2 id="offer-compare-title" className="pr-10 text-xl font-semibold text-white">
                  {COMPARE_COPY.title}
                </h2>

                {narrow ? (
                  <div className="mt-4">
                    {ordered.length > 2 && (
                      <p className="mb-2 text-center text-xs text-zinc-400">
                        {COMPARE_COPY.pager(sortedPair[0] + 1, sortedPair[1] + 1, ordered.length)}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {([0, 1] as const).map((side) => (
                        <div key={side} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                          {ordered.length > 2 && (
                            <div className="mb-2 flex justify-between">
                              <button type="button" aria-label="Previous offer" onClick={() => step(side, -1)} className="h-11 w-11 rounded-lg border border-white/10 text-lg text-white">
                                ‹
                              </button>
                              <button type="button" aria-label="Next offer" onClick={() => step(side, 1)} className="h-11 w-11 rounded-lg border border-white/10 text-lg text-white">
                                ›
                              </button>
                            </div>
                          )}
                          <ColumnHeader col={shown[side]} lowest={shown[side].offer.id === lowestId} />
                        </div>
                      ))}
                    </div>
                    <dl className="mt-3 divide-y divide-white/5">
                      {rows.map((r) => (
                        <div key={r.key} className="py-2">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{r.label}</dt>
                          <dd className="mt-1 grid grid-cols-2 gap-3">
                            {r.cells.map((c, i) => (
                              <CellLines key={i} cell={c} />
                            ))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full table-fixed border-collapse" style={{ minWidth: `${tableMinWidthPx}px` }}>
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-zinc-950" style={{ width: `${LABEL_COLUMN_WIDTH_PX}px` }} />
                          {shown.map((col) => (
                            <th
                              key={col.offer.id}
                              className="border-b border-white/10 px-3 pb-3 text-left align-bottom font-normal"
                              style={{ width: `calc((100% - ${LABEL_COLUMN_WIDTH_PX}px) / ${shown.length})` }}
                            >
                              <ColumnHeader col={col} lowest={col.offer.id === lowestId} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.key} className="border-b border-white/5">
                            <th
                              scope="row"
                              className="sticky left-0 z-10 bg-zinc-950 py-2 pr-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-zinc-500"
                            >
                              {r.label}
                            </th>
                            {r.cells.map((c, i) => (
                              <td key={i} className="px-3 py-2 align-top">
                                <CellLines cell={c} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
