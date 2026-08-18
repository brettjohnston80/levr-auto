"use client";

import { useState, type FormEvent } from "react";
import { submitDeliveryPreference } from "@/lib/deal-progress-actions";
import { TRANSPORTER_REFERRAL_ENABLED } from "@/lib/vehicle-data";
import type { DashboardDealProgress } from "@/lib/customer-dashboard";

export function DeliveryPreferenceForm({
  offerId,
  existing,
}: {
  offerId: string;
  existing: DashboardDealProgress | null;
}) {
  const [method, setMethod] = useState<"pickup" | "delivery" | null>(
    (existing?.deliveryMethod as "pickup" | "delivery" | null) ?? null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!method) {
      setError("Please choose an option.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.set("qualifying_offer_id", offerId);
    formData.set("delivery_method", method);

    const res = await submitDeliveryPreference(formData);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-semibold text-zinc-400 uppercase">How will you get your vehicle?</p>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setMethod("pickup")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            method === "pickup" ? "bg-emerald-500 text-zinc-950" : "border border-white/10 text-zinc-400"
          }`}
        >
          I&apos;ll pick it up in person
        </button>
        <button
          type="button"
          onClick={() => setMethod("delivery")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            method === "delivery" ? "bg-emerald-500 text-zinc-950" : "border border-white/10 text-zinc-400"
          }`}
        >
          I&apos;d like it delivered
        </button>
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        LEVR doesn&apos;t arrange delivery in-house yet — if you choose delivery, you and the dealer
        will coordinate a shipping company directly.
      </p>

      {method === "delivery" && TRANSPORTER_REFERRAL_ENABLED && (
        <div className="mt-3 rounded-md border border-white/10 bg-white/5 p-3 text-xs text-zinc-400">
          {/* Real partner referral content goes here once a vendor is signed. */}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !method}
        className="mt-3 rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Save"}
      </button>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {success && <p className="mt-2 text-xs text-emerald-400">Saved.</p>}
    </form>
  );
}
