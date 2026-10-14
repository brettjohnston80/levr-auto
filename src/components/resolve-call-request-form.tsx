"use client";

import { useRef, useState } from "react";
import { resolveCancellationCall, resolveSwitchCall } from "@/lib/call-resolution-actions";

// Labels for the manual outcomes (plan section 3.3). Kept in step with MANUAL_OUTCOMES in
// src/lib/call-resolution.ts, which is what the server accepts.
const OUTCOMES = {
  switch: [
    { code: "no_switch", label: "Didn't switch" },
    { code: "call_not_completed", label: "Couldn't complete the call" },
    { code: "other", label: "Other" },
  ],
  cancellation: [
    { code: "not_cancelled", label: "Didn't cancel" },
    { code: "call_not_completed", label: "Couldn't complete the call" },
    { code: "other", label: "Other" },
  ],
} as const;

/**
 * "Mark call resolved" on a switch or cancellation call card (Phase 1, Chunk 6). Switching or
 * cancelling from the card resolves the request automatically; this is for every other outcome.
 * On success the page refreshes and the card leaves the section.
 */
export function ResolveCallRequestForm({ searchId, callType }: { searchId: string; callType: "switch" | "cancellation" }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<string>(OUTCOMES[callType][0].code);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const res = callType === "switch" ? await resolveSwitchCall(searchId, outcome, note) : await resolveCancellationCall(searchId, outcome, note);
    inFlight.current = false;
    setBusy(false);
    if (!res.ok) setError(res.error);
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5"
        >
          Mark call resolved
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4 text-sm">
      <div>
        <label htmlFor={`outcome-${searchId}`} className="block text-xs text-zinc-400">
          Outcome
        </label>
        <select
          id={`outcome-${searchId}`}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white"
        >
          {OUTCOMES[callType].map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`note-${searchId}`} className="block text-xs text-zinc-400">
          Note (optional)
        </label>
        <textarea
          id={`note-${searchId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={2000}
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white"
        />
      </div>
      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-white px-4 py-2 font-semibold text-zinc-950 disabled:opacity-60"
        >
          {busy ? "Resolving…" : "Resolve"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={busy}
          className="rounded-lg border border-white/15 px-4 py-2 text-zinc-200 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
