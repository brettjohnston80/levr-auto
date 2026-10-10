"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestDeliveryEstimate } from "@/lib/handoff-actions";
import { formatCents } from "@/lib/dashboard-format";
import { DELIVERY_ESTIMATE_COPY, type DeliveryEstimate } from "@/lib/delivery-estimate";

/**
 * An offer's delivery estimate on the card and in the detail view
 * (2026-10-10): the figure, "requested from the dealer", "doesn't deliver",
 * or -- on an open offer with nothing asked yet -- a "Get a delivery
 * estimate" button, available before accepting as well as after.
 */
export function DeliveryEstimateLine({
  offerId,
  estimate,
  canRequest,
}: {
  offerId: string;
  estimate: DeliveryEstimate | null;
  /** Open offer (pending or accepted, search still running). */
  canRequest: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  if (estimate?.status === "provided" && estimate.cents != null) {
    return (
      <div className="mt-1 text-sm">
        <p className="text-zinc-300">{DELIVERY_ESTIMATE_COPY.provided(formatCents(estimate.cents))}</p>
        {estimate.note && <p className="text-xs text-zinc-500">{estimate.note}</p>}
      </div>
    );
  }
  if (estimate?.status === "unavailable") {
    return <p className="mt-1 text-sm text-zinc-400">{DELIVERY_ESTIMATE_COPY.unavailable}</p>;
  }
  if (estimate?.status === "requested" || requested) {
    return <p className="mt-1 text-sm text-zinc-400">{DELIVERY_ESTIMATE_COPY.requested}</p>;
  }
  if (!canRequest) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError(null);
          const res = await requestDeliveryEstimate(offerId);
          setSaving(false);
          if (!res.ok) {
            setError(res.error ?? "Something went wrong.");
            return;
          }
          setRequested(true);
          router.refresh();
        }}
        className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
      >
        {saving ? "Saving…" : DELIVERY_ESTIMATE_COPY.request}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
