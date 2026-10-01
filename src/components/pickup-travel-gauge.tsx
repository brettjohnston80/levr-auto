"use client";

import { useRef, useState } from "react";
import {
  PICKUP_TRAVEL_GAUGE_HINT,
  PICKUP_TRAVEL_GAUGE_STOPS,
  travelValueLabel,
} from "@/lib/pickup-travel";

/**
 * The pickup-range answer as a fuel gauge (approved 2026-09-30), replacing
 * the seven tiles. Shared by intake, Your Deal's prompt/change control and
 * the agent's undecided-finalize form, so the three can't differ.
 *
 * Seven stops on a half circle, empty (left: "I'd rather have it
 * delivered") to full (right: "I'd drive any distance"), with "It depends —
 * case by case" as a separate button. It always snaps to a stop. Nothing is
 * selected until the customer chooses -- a default would be an answer
 * nobody gave.
 *
 * Input: drag anywhere on the gauge (not just a small handle -- a missed
 * handle on a phone scrolls the page instead), tap a stop's label, or use
 * the keyboard as a slider (arrows, Home/End). An interaction commits ONE
 * onChange: on pointer-up, on a click, or ~0.7s after the last key press
 * (and on Enter/blur). Callers like Your Deal save to the server on change,
 * so committing on every drag frame or key press would fire a save each
 * time.
 *
 * `name` renders a hidden input for callers that submit FormData.
 */

// SVG geometry. Centre of the half circle at (CX, CY), stops on radius R.
// Extra height below the centre leaves room for the centre text under the
// needle hub, so the hub never covers it.
const VB = { x: -30, y: -28, w: 360, h: 236 };
const CX = 150;
const CY = 150;
const R = 120;
const STEP_DEG = 180 / (PICKUP_TRAVEL_GAUGE_STOPS.length - 1);
const KEY_COMMIT_MS = 700;

function stopAngle(index: number): number {
  return 180 - index * STEP_DEG;
}
function point(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY - radius * Math.sin(a) };
}
function pct(p: { x: number; y: number }) {
  return { left: `${((p.x - VB.x) / VB.w) * 100}%`, top: `${((p.y - VB.y) / VB.h) * 100}%` };
}
function arcPath(toIndex: number): string {
  const start = point(180, R);
  const end = point(stopAngle(toIndex), R);
  return `M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`;
}

const LAST = PICKUP_TRAVEL_GAUGE_STOPS.length - 1;

export function PickupTravelGauge({
  value,
  onChange,
  disabled = false,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  name?: string;
}) {
  const gaugeRef = useRef<HTMLDivElement>(null);
  const keyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);
  // A stop the customer is moving to but hasn't committed yet; null when
  // idle, so the displayed position otherwise always comes from `value`.
  const [pending, setPendingState] = useState<number | null>(null);
  // Mirrors `pending` so a release that fires before React re-renders (a
  // fast drag) still commits the stop the pointer actually ended on.
  const pendingRef = useRef<number | null>(null);
  function setPending(next: number | null) {
    pendingRef.current = next;
    setPendingState(next);
  }

  const committedIndex = PICKUP_TRAVEL_GAUGE_STOPS.findIndex((s) => s.value === value);
  const shownIndex = pending ?? (committedIndex >= 0 ? committedIndex : null);
  const isCaseByCase = value === "case_by_case" && pending === null;
  const centreText =
    shownIndex !== null
      ? travelValueLabel(PICKUP_TRAVEL_GAUGE_STOPS[shownIndex].value)
      : isCaseByCase
        ? travelValueLabel("case_by_case")
        : PICKUP_TRAVEL_GAUGE_HINT;

  function commit(index: number | null) {
    if (keyTimer.current) {
      clearTimeout(keyTimer.current);
      keyTimer.current = null;
    }
    setPending(null);
    if (index === null) return;
    const next = PICKUP_TRAVEL_GAUGE_STOPS[index].value;
    if (next !== value) onChange(next);
  }

  function indexFromPointer(clientX: number, clientY: number): number {
    const rect = gaugeRef.current!.getBoundingClientRect();
    const cx = rect.left + ((CX - VB.x) / VB.w) * rect.width;
    const cy = rect.top + ((CY - VB.y) / VB.h) * rect.height;
    let angle = (Math.atan2(cy - clientY, clientX - cx) * 180) / Math.PI;
    // Below the centre line, pin to whichever end is nearer.
    if (angle < 0) angle = clientX < cx ? 180 : 0;
    return Math.min(LAST, Math.max(0, Math.round((180 - angle) / STEP_DEG)));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    // Stop labels are buttons with their own click; let that handle it.
    if ((e.target as HTMLElement).closest("button")) return;
    dragging.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers throw if the pointer is no longer active; the drag
      // still works through the move events that do arrive.
    }
    setPending(indexFromPointer(e.clientX, e.clientY));
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    setPending(indexFromPointer(e.clientX, e.clientY));
  }
  function onPointerEnd() {
    if (!dragging.current) return;
    dragging.current = false;
    commit(pendingRef.current);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    // From the ref, not the render: fast key repeats arrive before React
    // re-renders, and must still step one stop each.
    const from = pendingRef.current ?? (committedIndex >= 0 ? committedIndex : null);
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = from === null ? 0 : Math.min(LAST, from + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = from === null ? 0 : Math.max(0, from - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = LAST;
    else if (e.key === "Enter" && pendingRef.current !== null) {
      e.preventDefault();
      commit(pendingRef.current);
      return;
    }
    if (next === null) return;
    e.preventDefault();
    setPending(next);
    if (keyTimer.current) clearTimeout(keyTimer.current);
    keyTimer.current = setTimeout(() => commit(next), KEY_COMMIT_MS);
  }

  const needle = shownIndex !== null ? point(stopAngle(shownIndex), R - 26) : null;

  return (
    <div className={disabled ? "opacity-50" : undefined}>
      <div
        ref={gaugeRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Pickup range"
        aria-valuemin={0}
        aria-valuemax={LAST}
        aria-valuenow={shownIndex ?? undefined}
        aria-valuetext={centreText ?? undefined}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        onBlur={() => pendingRef.current !== null && !dragging.current && commit(pendingRef.current)}
        className="relative mx-auto w-full max-w-[360px] cursor-pointer touch-none rounded-2xl select-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
        style={{ aspectRatio: `${VB.w} / ${VB.h}` }}
      >
        <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d={arcPath(LAST)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={14} strokeLinecap="round" />
          {shownIndex !== null && shownIndex > 0 && (
            <path d={arcPath(shownIndex)} fill="none" stroke="#10b981" strokeWidth={14} strokeLinecap="round" />
          )}
          {PICKUP_TRAVEL_GAUGE_STOPS.map((stop, i) => {
            const p = point(stopAngle(i), R);
            const reached = shownIndex !== null && i <= shownIndex;
            return <circle key={stop.value} cx={p.x} cy={p.y} r={5} fill={reached ? "#ecfdf5" : "#52525b"} />;
          })}
          {needle && (
            <>
              <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke="#ecfdf5" strokeWidth={4} strokeLinecap="round" />
              <circle cx={CX} cy={CY} r={8} fill="#ecfdf5" />
            </>
          )}
        </svg>

        {PICKUP_TRAVEL_GAUGE_STOPS.map((stop, i) => {
          const selected = i === shownIndex;
          return (
            <button
              key={stop.value}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label={travelValueLabel(stop.value) ?? stop.shortLabel}
              onClick={() => commit(i)}
              className={`absolute flex h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1 text-xs font-semibold transition-colors ${
                selected ? "text-emerald-300" : "text-zinc-400 hover:text-white"
              }`}
              style={pct(point(stopAngle(i), R + 30))}
            >
              {stop.shortLabel}
            </button>
          );
        })}

        <p
          className={`pointer-events-none absolute inset-x-0 bottom-[1%] px-10 text-center text-sm font-semibold ${
            shownIndex !== null || isCaseByCase ? "text-white" : "text-zinc-400"
          }`}
          aria-hidden="true"
        >
          {centreText}
        </p>
      </div>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={isCaseByCase}
          onClick={() => {
            setPending(null);
            if (value !== "case_by_case") onChange("case_by_case");
          }}
          className={`min-h-11 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            isCaseByCase
              ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
              : "border-white/10 bg-zinc-950/60 text-zinc-300 hover:border-white/25"
          }`}
        >
          {travelValueLabel("case_by_case")}
        </button>
      </div>
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
