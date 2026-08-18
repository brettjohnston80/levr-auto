"use client";

import { useState } from "react";
import { markSearchPurchased } from "@/lib/outreach-actions";

export function MarkPurchasedButton({ searchId }: { searchId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setError(null);

    const res = await markSearchPurchased(searchId);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return <span className="ml-2 text-xs text-emerald-400">Marked purchased</span>;
  }

  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <button
        type="button"
        disabled={submitting}
        onClick={handleClick}
        className="rounded border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
      >
        {submitting ? "Marking…" : "Mark as purchased"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
