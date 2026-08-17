"use client";

import { useState } from "react";
import { setAutoRenewEnabled } from "@/lib/extension-actions";

// Required customer-facing off switch for auto-renew (spec, 2026-08-16).
// Placement: directly on the SearchCard, not a dedicated account-settings
// page -- auto_renew_enabled is search-scoped (matches search_deadline_at/
// paused_at), not customer-scoped, so per-search is the natural home, and
// there's no existing settings section to bolt this onto (same gap already
// noted for communication_frequency). Turning it back on isn't offered here
// -- see setAutoRenewEnabled's doc comment.
export function AutoRenewToggle({ searchId }: { searchId: string }) {
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTurnOff() {
    setSubmitting(true);
    setError(null);
    const result = await setAutoRenewEnabled(searchId, false);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEnabled(false);
  }

  if (!enabled) {
    return <p className="mt-3 text-xs text-zinc-500">Automatic extensions turned off.</p>;
  }

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-400">
          Automatic extensions are on — we&apos;ll charge $100 to keep this search going every 30 days.
        </p>
        <button
          type="button"
          onClick={handleTurnOff}
          disabled={submitting}
          className="shrink-0 rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {submitting ? "Turning off…" : "Turn off"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
