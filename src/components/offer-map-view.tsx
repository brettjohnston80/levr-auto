"use client";

import dynamic from "next/dynamic";
import { MAP_COPY, type OfferMapData } from "@/lib/map/pins";

// The Map half of Your Deal's List | Map toggle (2026-09-26). Provider-
// neutral: the Mapbox-bound component is loaded client-only and on demand.
const OfferMap = dynamic(() => import("@/components/offer-map"), {
  ssr: false,
  loading: () => <div className="h-[60vh] w-full animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] sm:h-[480px]" />,
});

/** Event OfferCardActions listens for, so a map pin can open that offer's
 *  detail view -- the cards stay mounted (hidden) while the map shows. */
export const OPEN_OFFER_EVENT = "levr:open-offer";

export function OfferMapView({ data }: { data: OfferMapData }) {
  function openOffer(offerId: string) {
    window.dispatchEvent(new CustomEvent(OPEN_OFFER_EVENT, { detail: { offerId } }));
  }

  return (
    <div className="mt-3">
      <OfferMap data={data} onOpenOffer={openOffer} />

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400" aria-label="Map legend">
        <LegendItem swatch="border-2 border-emerald-500 bg-zinc-950" label={MAP_COPY.legend.pending} />
        <LegendItem swatch="border-2 border-emerald-500 bg-emerald-500" label={MAP_COPY.legend.accepted} />
        <LegendItem swatch="border-[3px] border-amber-500 bg-zinc-950" label={MAP_COPY.legend.highlighted} />
        <LegendItem swatch="border-2 border-zinc-700 bg-zinc-600 opacity-70" label={MAP_COPY.legend.inactive} />
        <LegendItem swatch="border-2 border-amber-500 bg-transparent ring-2 ring-amber-500/0" label={MAP_COPY.legend.beyondRange} ring />
      </ul>

      {data.unplacedCount > 0 && <p className="mt-2 text-xs text-zinc-500">{MAP_COPY.unplaced(data.unplacedCount)}</p>}
    </div>
  );
}

function LegendItem({ swatch, label, ring = false }: { swatch: string; label: string; ring?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`inline-block rounded-full ${ring ? "h-4 w-4" : "h-3 w-3"} ${swatch}`} aria-hidden="true" />
      {label}
    </li>
  );
}
