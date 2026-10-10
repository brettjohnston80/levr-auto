"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { MAP_COPY, type OfferMapData } from "@/lib/map/pins";
import { PICKUP_TRAVEL_GAUGE_STOPS, travelFromValue, travelValueLabel } from "@/lib/pickup-travel";
import { setSearchPickupTravel } from "@/lib/handoff-actions";

// The Map half of Your Deal's List | Map toggle (2026-09-26). Provider-
// neutral: the Mapbox-bound component is loaded client-only and on demand.
const OfferMap = dynamic(() => import("@/components/offer-map"), {
  ssr: false,
  loading: () => <div className="h-[60vh] w-full animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] sm:h-[480px]" />,
});

/** Event OfferCardActions listens for, so a map pin can open that offer's
 *  detail view -- the cards stay mounted (hidden) while the map shows. */
export const OPEN_OFFER_EVENT = "levr:open-offer";

const LAST_STOP = PICKUP_TRAVEL_GAUGE_STOPS.length - 1;

function milesOf(value: string | null): number | null {
  const travel = travelFromValue(value);
  return travel?.choice === "distance" ? travel.miles : null;
}

export function OfferMapView({
  data,
  searchId,
  pickupValue,
  canEditRange,
}: {
  data: OfferMapData;
  searchId: string;
  /** The saved pickup-range form value ("" when none). */
  pickupValue: string;
  canEditRange: boolean;
}) {
  const router = useRouter();
  // Unsaved slider value (2026-10-10, Brett's walkthrough). Null = showing
  // the saved range. The circle previews it while dragging; nothing is
  // stored until Save, and leaving without saving keeps the saved range.
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = draft ?? pickupValue;
  const stopIndex = PICKUP_TRAVEL_GAUGE_STOPS.findIndex((s) => s.value === shown);
  const dirty = draft !== null && draft !== pickupValue;

  function openOffer(offerId: string) {
    window.dispatchEvent(new CustomEvent(OPEN_OFFER_EVENT, { detail: { offerId } }));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const res = await setSearchPickupTravel(searchId, draft);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    // Server-computed everything (map data, out-of-range flags) reloads.
    setDraft(null);
    router.refresh();
  }

  return (
    <div className="mt-3">
      <OfferMap data={data} onOpenOffer={openOffer} rangeMiles={milesOf(shown)} />

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400" aria-label="Map legend">
        <LegendItem swatch="border-2 border-emerald-500 bg-zinc-950" label={MAP_COPY.legend.pending} />
        <LegendItem swatch="border-2 border-emerald-500 bg-emerald-500" label={MAP_COPY.legend.accepted} />
        <LegendItem swatch="border-[3px] border-amber-500 bg-zinc-950" label={MAP_COPY.legend.highlighted} />
        <LegendItem swatch="border-2 border-zinc-700 bg-zinc-600 opacity-70" label={MAP_COPY.legend.inactive} />
      </ul>

      {data.unplacedCount > 0 && <p className="mt-2 text-xs text-zinc-500">{MAP_COPY.unplaced(data.unplacedCount)}</p>}

      {canEditRange && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="map-range-slider" className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
              {MAP_COPY.rangeSlider.label}
            </label>
            <span className="text-sm font-semibold text-white">{travelValueLabel(shown) ?? "—"}</span>
          </div>
          {/* Same seven stops as the fuel gauge, so the values can't
              diverge. "It depends -- case by case" isn't a stop on either;
              a saved case-by-case answer shows in the label above, and the
              thumb starts in the middle until moved. */}
          <input
            id="map-range-slider"
            type="range"
            min={0}
            max={LAST_STOP}
            step={1}
            value={stopIndex >= 0 ? stopIndex : Math.floor(LAST_STOP / 2)}
            disabled={saving}
            aria-valuetext={travelValueLabel(shown) ?? undefined}
            onChange={(e) => setDraft(PICKUP_TRAVEL_GAUGE_STOPS[Number(e.target.value)].value)}
            className="mt-3 h-11 w-full cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[11px] text-zinc-500" aria-hidden="true">
            {PICKUP_TRAVEL_GAUGE_STOPS.map((s) => (
              <span key={s.value}>{s.shortLabel}</span>
            ))}
          </div>
          {dirty && (
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setError(null);
                }}
                disabled={saving}
                className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold text-zinc-300 hover:bg-white/10"
              >
                {MAP_COPY.rangeSlider.cancel}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="min-h-11 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving ? "Saving…" : MAP_COPY.rangeSlider.save}
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-full ${swatch}`} aria-hidden="true" />
      {label}
    </li>
  );
}
