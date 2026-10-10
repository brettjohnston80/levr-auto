"use client";

import { useState } from "react";
import { setOfferDeliveryEstimate } from "@/lib/outreach-actions";
import type { DeliveryEstimate } from "@/lib/delivery-estimate";

/**
 * Agent view of one offer's delivery estimate (2026-10-10): what's on file,
 * whether it's standard or customer-requested, and a small form to record
 * the dealer's fee, mark it requested, or note the dealer doesn't deliver.
 */
export function AgentDeliveryEstimate({
  offerId,
  estimate,
  requestedBy,
  standard,
  open,
}: {
  offerId: string;
  estimate: DeliveryEstimate | null;
  requestedBy: "customer" | "agent" | null;
  standard: boolean;
  /** Pending or accepted -- the only offers whose estimate can change. */
  open: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"fee" | "requested" | "unavailable">(estimate?.status === "provided" ? "fee" : (estimate?.status ?? "fee") as "fee" | "requested" | "unavailable");
  const [fee, setFee] = useState(estimate?.cents != null ? String(estimate.cents / 100) : "");
  const [note, setNote] = useState(estimate?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary =
    estimate?.status === "provided" && estimate.cents != null
      ? `Delivery estimate: $${(estimate.cents / 100).toLocaleString()}`
      : estimate?.status === "unavailable"
        ? "Dealer doesn't deliver"
        : estimate?.status === "requested"
          ? `Delivery estimate requested${requestedBy === "customer" ? " by the customer" : " from the dealer"} — waiting on the figure`
          : standard
            ? "Delivery estimate needed (beyond range / prefers delivery)"
            : null;
  const needsAction = estimate?.status === "requested" || (!estimate && standard);

  if (!summary && !open) return null;

  return (
    <div className="ml-4 mt-1 text-xs">
      {summary && <span className={needsAction ? "text-amber-400" : "text-zinc-400"}>{summary}</span>}
      {estimate?.note && <span className="ml-1 text-zinc-500">({estimate.note})</span>}
      {open && !editing && (
        <button type="button" onClick={() => setEditing(true)} className="ml-2 text-emerald-400 underline hover:text-emerald-300">
          {estimate ? "Update estimate" : "Add delivery estimate"}
        </button>
      )}
      {open && editing && (
        <form
          className="mt-2 space-y-2 rounded-md border border-white/10 p-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError(null);
            const fd = new FormData();
            fd.set("offer_id", offerId);
            fd.set("delivery_mode", mode);
            fd.set("delivery_fee", fee);
            fd.set("delivery_note", note);
            const res = await setOfferDeliveryEstimate(fd);
            setSaving(false);
            if (!res.ok) {
              setError(res.error ?? "Something went wrong.");
              return;
            }
            setEditing(false);
          }}
        >
          <div className="flex flex-wrap gap-3 text-zinc-300">
            {(
              [
                ["fee", "Dealer's delivery fee"],
                ["requested", "Requested from dealer"],
                ["unavailable", "Dealer doesn't deliver"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1.5">
                <input type="radio" checked={mode === value} onChange={() => setMode(value)} />
                {label}
              </label>
            ))}
          </div>
          {mode === "fee" && (
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="$0.00 (0 = free delivery)"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="w-44 rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
            />
          )}
          {mode !== "requested" && (
            <input
              type="text"
              maxLength={500}
              placeholder="Note for the customer (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
            />
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-md bg-emerald-500 px-3 py-1.5 font-semibold text-zinc-950 disabled:opacity-50">
              {saving ? "Saving…" : "Save estimate"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-white/10 px-3 py-1.5 text-zinc-300">
              Cancel
            </button>
          </div>
          {error && <p className="text-red-400">{error}</p>}
        </form>
      )}
    </div>
  );
}
