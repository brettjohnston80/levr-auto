"use client";

import { useState } from "react";
import { checkServiceAgreementSigningStatus } from "@/lib/outreach-actions";

export function CheckSigningStatusButton({ offerId }: { offerId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setMessage(null);
    setIsError(false);

    const res = await checkServiceAgreementSigningStatus(offerId);
    setSubmitting(false);

    if (!res.ok) {
      setMessage(res.error ?? "Something went wrong.");
      setIsError(true);
      return;
    }
    if (!res.signed) {
      setMessage("Not signed yet, per PandaDoc.");
    }
    // If signed, the page revalidates and shows the signed state directly —
    // no need for a transient message.
  }

  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <button
        type="button"
        disabled={submitting}
        onClick={handleClick}
        className="rounded border border-white/10 px-2 py-0.5 text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-50"
      >
        {submitting ? "Checking…" : "Check signing status"}
      </button>
      {message && <span className={`text-xs ${isError ? "text-red-400" : "text-zinc-500"}`}>{message}</span>}
    </span>
  );
}
