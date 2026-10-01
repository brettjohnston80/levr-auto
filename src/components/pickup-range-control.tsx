"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PickupTravelGauge } from "@/components/pickup-travel-gauge";
import { setSearchPickupTravel } from "@/lib/handoff-actions";
import {
  PICKUP_TRAVEL_DEFAULT,
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
 *
 * The prompt's needle starts at the 100-mile default (2026-10-01), which
 * counts as the answer if left -- but nothing is saved until the customer
 * acts, so "Save" stores whatever the needle shows (tapping 100 itself is
 * not a change and would do nothing). Never written on load: an answer
 * the customer hasn't seen isn't theirs.
 */
export function PickupRangeControl({ searchId, value }: { searchId: string; value: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(PICKUP_TRAVEL_DEFAULT);
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
          <PickupTravelGauge
            value={draft}
            onChange={(next) => {
              setDraft(next);
              choose(next);
            }}
            disabled={saving}
          />
        </div>
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            disabled={saving}
            onClick={() => choose(draft)}
            className="min-h-11 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
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
          <PickupTravelGauge value={value} onChange={choose} disabled={saving} />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
