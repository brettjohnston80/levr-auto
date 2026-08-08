"use client";

import { useState } from "react";

export function CallbackRequestButton() {
  const [requested, setRequested] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setRequested(true)}
        className="rounded-full border border-emerald-500/40 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:border-emerald-500 hover:bg-emerald-500/10"
      >
        Request a Callback
      </button>
      {requested && (
        <p className="mt-2 text-xs text-zinc-500">
          Placeholder — this will connect you with a personal agent once callbacks go live.
        </p>
      )}
    </div>
  );
}
