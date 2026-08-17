"use client";

import { useState } from "react";
import { setAutoRenewEnabled } from "@/lib/extension-actions";

// Inline "[Turn off auto-renew]" control embedded in the Day-60 reminder
// banner (spec, 2026-08-17) -- reuses the same setAutoRenewEnabled action and
// the same no-refresh/local-state pattern as AutoRenewToggle, just styled
// inline for the banner's tighter paragraph instead of AutoRenewToggle's
// bordered box. AutoRenewToggle itself is untouched and still renders
// separately as the persistent off-switch outside the reminder window.
export function AutoRenewOffLink({ searchId }: { searchId: string }) {
  const [state, setState] = useState<"idle" | "submitting" | "off">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setState("submitting");
    setError(null);
    const result = await setAutoRenewEnabled(searchId, false);
    if (!result.ok) {
      setState("idle");
      setError(result.error);
      return;
    }
    setState("off");
  }

  if (state === "off") {
    return <p className="mt-2 text-xs text-amber-300/70">Auto-renew turned off.</p>;
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "submitting"}
        className="text-xs font-semibold text-amber-300 underline hover:text-amber-200 disabled:opacity-50"
      >
        {state === "submitting" ? "Turning off…" : "Turn off auto-renew"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
