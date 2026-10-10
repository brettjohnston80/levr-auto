"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOfferHighlight } from "@/lib/offer-highlight-actions";

// Shared by the offer card and the offer detail modal, so the two surfaces
// can't drift on behavior or wording. Only ever rendered for a PENDING
// offer -- the server action also refuses anything else. (The customer note
// that used to live here was retired into offer message threads, 2026-09-25.)

export function HighlightToggle({ offerId, highlighted }: { offerId: string; highlighted: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown state flips the moment the save succeeds, and the button stays
  // disabled until the refreshed page arrives (2026-10-10): it used to
  // re-enable from the stale prop, so a quick second tap sent the same
  // toggle again.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const shown = refreshing && optimistic !== null ? optimistic : highlighted;

  async function toggle() {
    setSaving(true);
    setError(null);
    const next = !shown;
    const res = await setOfferHighlight(offerId, next);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setOptimistic(next);
    startRefresh(() => router.refresh());
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={toggle}
        disabled={saving || refreshing}
        aria-pressed={shown}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          shown
            ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
            : "border-white/15 text-zinc-300 hover:bg-white/5"
        }`}
      >
        {saving ? "Saving…" : shown ? "★ Highlighted" : "☆ Highlight"}
      </button>
      {error && <span className="mt-1 text-xs text-red-400">{error}</span>}
    </span>
  );
}
