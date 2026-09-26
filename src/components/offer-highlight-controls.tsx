"use client";

import { useState } from "react";
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

  async function toggle() {
    setSaving(true);
    setError(null);
    const res = await setOfferHighlight(offerId, !highlighted);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-pressed={highlighted}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          highlighted
            ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
            : "border-white/15 text-zinc-300 hover:bg-white/5"
        }`}
      >
        {highlighted ? "★ Highlighted" : "☆ Highlight"}
      </button>
      {error && <span className="mt-1 text-xs text-red-400">{error}</span>}
    </span>
  );
}
