"use client";

import { useState } from "react";
import { requestFinalizationCall } from "@/lib/finalize-actions";
import { FinalizeSelfService } from "@/components/finalize-self-service";
import type { TrimOption } from "@/lib/finalize-trims";

type Mode = "choice" | "self-service" | "call-requested";

export function FinalizeChoice({
  searchId,
  make,
  model,
  callAlreadyRequested,
  trimOptions,
}: {
  searchId: string;
  make: string;
  model: string;
  callAlreadyRequested: boolean;
  trimOptions: TrimOption[];
}) {
  const [mode, setMode] = useState<Mode>(callAlreadyRequested ? "call-requested" : "choice");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestCall() {
    setRequesting(true);
    setError(null);
    const result = await requestFinalizationCall(searchId);
    setRequesting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode("call-requested");
  }

  if (mode === "self-service") {
    return <FinalizeSelfService searchId={searchId} make={make} model={model} trimOptions={trimOptions} />;
  }

  if (mode === "call-requested") {
    return (
      <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-10 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-zinc-950">
          ✓
        </span>
        <h1 className="mt-6 text-2xl font-semibold text-white">
          We&apos;ve got your request — an agent will reach out.
        </h1>
        <p className="mt-4 text-sm text-zinc-400">
          We&apos;ll call or email you to finalize the trim, color, and options for your {make}{" "}
          {model} search. Once that call happens, the same 24-hour window to make changes still
          applies.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-white">
        Payment received — let&apos;s finalize your {make} {model} search
      </h1>
      <p className="mt-4 text-zinc-400">
        You made your decision today. We&apos;ll begin the search tomorrow. If you wake up
        wanting to change something, now&apos;s the time.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("self-service")}
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-left transition-colors hover:border-emerald-500/60"
        >
          <h2 className="text-lg font-semibold text-white">Finalize it myself</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Compare trims, pick a color, and choose options for your {make} {model} — takes a
            few minutes.
          </p>
        </button>
        <button
          type="button"
          onClick={handleRequestCall}
          disabled={requesting}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left transition-colors hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <h2 className="text-lg font-semibold text-white">Schedule a call</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {requesting
              ? "Requesting…"
              : "Talk it through with your assigned agent — we'll reach out to set it up."}
          </p>
        </button>
      </div>

      {error && (
        <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <p className="mt-8 text-xs text-zinc-500">
        Once you finalize — either way — you&apos;ll have 24 hours to change your mind before we
        start reaching out to dealers.
      </p>
    </div>
  );
}
