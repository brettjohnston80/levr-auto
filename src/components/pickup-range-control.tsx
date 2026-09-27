"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PickupTravelTiles } from "@/components/pickup-travel-tiles";
import { setSearchPickupTravel } from "@/lib/handoff-actions";
import {
  PICKUP_TRAVEL_PROMPT_BODY,
  PICKUP_TRAVEL_QUESTION,
  travelFromValue,
  travelSummary,
} from "@/lib/pickup-travel";

/**
 * Your Deal's pickup-range control (2026-09-26, approved). With no answer on
 * file it's a prompt card -- deliberately not dismissible, since one tap is
 * all it takes and the out-of-range flag can't work without it. With an
 * answer it's the one-line summary with "Change". Saves on tap either way.
 */
export function PickupRangeControl({ searchId, value }: { searchId: string; value: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const travel = travelFromValue(value);

  async function choose(next: string) {
    setSaving(true);
    setError(null);
    const res = await setSearchPickupTravel(searchId, next);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!travel) {
    return (
      <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
        <p className="text-sm font-semibold text-white">{PICKUP_TRAVEL_QUESTION}</p>
        <p className="mt-1 text-xs text-zinc-400">{PICKUP_TRAVEL_PROMPT_BODY}</p>
        <div className="mt-3">
          <PickupTravelTiles value="" onChange={choose} disabled={saving} />
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 text-sm text-zinc-400">
      {travelSummary(travel)}{" "}
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className="text-emerald-400 underline hover:text-emerald-300"
      >
        Change
      </button>
      {editing && (
        <div className="mt-3">
          <PickupTravelTiles value={value} onChange={choose} disabled={saving} />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
