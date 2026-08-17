"use client";

import { useState } from "react";
import { createExtensionCheckoutSession } from "@/lib/extension-actions";

// Mirrors intake-filter.tsx's handleCheckout exactly -- call the Server
// Action, check .ok, redirect via window.location.href on success.
//
// showAutoRenewOption controls the opt-in checkbox (auto-renew build,
// 2026-08-17) -- only shown when the search doesn't already have auto-renew
// on, since re-checking it would be a no-op (the checkout would just save a
// second payment method, not "extra" auto-renew). Parent (account/page.tsx)
// passes showAutoRenewOption={!search.autoRenewEnabled}.
export function ExtendSearchButton({
  searchId,
  showAutoRenewOption = false,
}: {
  searchId: string;
  showAutoRenewOption?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRenew, setAutoRenew] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setError(null);

    const result = await createExtensionCheckoutSession(searchId, autoRenew);

    if (!result.ok) {
      setSubmitting(false);
      setError(result.error);
      return;
    }

    window.location.href = result.url;
  }

  return (
    <div className="mt-3">
      {showAutoRenewOption && (
        <label className="mb-3 flex items-start gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={autoRenew}
            onChange={(e) => setAutoRenew(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Also enable automatic extensions — we&apos;ll save this card and automatically charge $100
            every 30 days if the search is about to pause, so it never stops on its own. You can turn
            this off anytime from your account page.
          </span>
        </label>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
      >
        {submitting ? "Starting checkout…" : "Extend now — $100"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
