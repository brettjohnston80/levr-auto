"use client";

import {
  PRICE_SLIDER_MIN,
  PRICE_SLIDER_MAX,
  PRICE_SLIDER_STEP,
  formatPriceRange,
  type PriceRangeValue,
} from "@/lib/matchmaker-data";

// Dual-handle slider built from two overlaid native <input type="range">
// elements -- no slider library exists anywhere in this codebase, and this
// is the standard technique for a real dual-handle range with zero new
// dependencies: each input's own track is hidden (appearance-none +
// transparent), only its thumb captures pointer events (via the
// [&::-webkit-slider-thumb]/[&::-moz-range-thumb] arbitrary-variant
// overrides below), so both handles stay independently draggable
// regardless of stacking order. Native <input type="range"> also gives
// real keyboard accessibility (arrow keys, Home/End) for free.
const THUMB_CLASS =
  "pointer-events-none absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent " +
  "[&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:bg-transparent " +
  "[&::-moz-range-track]:appearance-none [&::-moz-range-track]:bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full " +
  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-950 " +
  "[&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-black/40 " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 " +
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-zinc-950 [&::-moz-range-thumb]:bg-emerald-500";

function percentOf(value: number): number {
  return ((value - PRICE_SLIDER_MIN) / (PRICE_SLIDER_MAX - PRICE_SLIDER_MIN)) * 100;
}

export function PriceRangeSlider({
  value,
  onChange,
}: {
  value: PriceRangeValue | null;
  onChange: (range: PriceRangeValue) => void;
}) {
  const range = value ?? { min: PRICE_SLIDER_MIN, max: PRICE_SLIDER_MAX };

  function handleMinChange(next: number) {
    onChange({ min: Math.min(next, range.max), max: range.max });
  }

  function handleMaxChange(next: number) {
    onChange({ min: range.min, max: Math.max(next, range.min) });
  }

  // When the two handles are close together, the one with the smaller
  // value needs priority so it stays grabbable instead of being covered by
  // the other thumb -- otherwise a user trying to pull two nearly-touching
  // handles apart can get stuck unable to grab the lower one.
  const closeTogether = range.max - range.min < (PRICE_SLIDER_MAX - PRICE_SLIDER_MIN) * 0.05;
  const minZIndex = closeTogether ? 4 : 3;
  const maxZIndex = 4;

  const minPercent = percentOf(range.min);
  const maxPercent = percentOf(range.max);

  return (
    <div>
      <p className="text-center text-lg font-semibold text-white">{formatPriceRange(range)}</p>

      <div className="relative mt-6 h-5">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-emerald-500"
          style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }}
        />

        <input
          type="range"
          aria-label="Minimum price"
          min={PRICE_SLIDER_MIN}
          max={PRICE_SLIDER_MAX}
          step={PRICE_SLIDER_STEP}
          value={range.min}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          className={THUMB_CLASS}
          style={{ zIndex: minZIndex }}
        />
        <input
          type="range"
          aria-label="Maximum price"
          min={PRICE_SLIDER_MIN}
          max={PRICE_SLIDER_MAX}
          step={PRICE_SLIDER_STEP}
          value={range.max}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          className={THUMB_CLASS}
          style={{ zIndex: maxZIndex }}
        />
      </div>

      <div className="mt-1 flex justify-between text-xs text-zinc-500">
        <span>${PRICE_SLIDER_MIN.toLocaleString()} or less</span>
        <span>${PRICE_SLIDER_MAX.toLocaleString()} or more</span>
      </div>
    </div>
  );
}
