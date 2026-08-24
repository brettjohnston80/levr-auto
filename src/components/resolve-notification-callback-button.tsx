"use client";

import { useState } from "react";
import { resolveNotificationCallback } from "@/lib/outreach-actions";

export function ResolveNotificationCallbackButton({ eventId }: { eventId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);

    const res = await resolveNotificationCallback(eventId);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <button
        type="button"
        disabled={submitting}
        onClick={handleClick}
        className="rounded border border-white/10 px-2 py-0.5 text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-50"
      >
        {submitting ? "Resolving…" : "Mark handled"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
