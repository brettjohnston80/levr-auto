"use client";

import { useState } from "react";
import { cancelSearch, requestCancellationCall } from "@/lib/cancellation-actions";

type Mode = "intro" | "call-requested" | "cancelled";

// Cancellation copy locked by Brett, 2026-08-17 -- do not revise without
// re-opening. Mirrors SwitchChoice/FinalizeChoice's mode-based local-state
// shape: one client component, no navigation between states.
export function CancellationChoice({
  searchId,
  cancellationCallAlreadyRequested,
}: {
  searchId: string;
  cancellationCallAlreadyRequested: boolean;
}) {
  const [mode, setMode] = useState<Mode>(cancellationCallAlreadyRequested ? "call-requested" : "intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestCall() {
    setBusy(true);
    setError(null);
    const result = await requestCancellationCall(searchId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode("call-requested");
  }

  async function handleCancel() {
    setBusy(true);
    setError(null);
    const result = await cancelSearch(searchId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode("cancelled");
  }

  if (mode === "cancelled") {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm text-zinc-300">
          This search has been cancelled. To search again, start a new $699 search from the homepage.
        </p>
      </div>
    );
  }

  if (mode === "call-requested") {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
        <p className="text-sm text-zinc-200">
          Request received. Our team&apos;s been notified and will reach out to discuss your requested
          change as soon as possible. We&apos;re actively working deals for you and every other LEVR
          customer right now, so thanks for your patience — you&apos;ll hear from us soon.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-sm font-semibold text-white">Thinking about cancelling?</p>
      <p className="mt-2 text-sm text-zinc-400">
        Before anything final, talk it through with an agent — request a call and we&apos;ll see what we
        can do for you, including whether a refund makes sense given your situation.
      </p>
      <p className="mt-2 text-sm text-zinc-400">
        Prefer to just cancel outright? That&apos;s available too — this ends your search for good,
        without refund.
      </p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRequestCall}
          disabled={busy}
          className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          Request a call with an agent
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={busy}
          className="rounded-full border border-red-500/30 px-5 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
        >
          Cancel search permanently
        </button>
      </div>
    </div>
  );
}
