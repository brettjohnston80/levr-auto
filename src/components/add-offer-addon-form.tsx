"use client";

import { useState, type FormEvent } from "react";
import { logOfferAddon } from "@/lib/outreach-actions";

export function AddOfferAddonForm({ offerId }: { offerId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("qualifying_offer_id", offerId);
    formData.set("description", description);
    formData.set("amount", amount);

    const res = await logOfferAddon(formData);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setDescription("");
    setAmount("");
    setExpanded(false);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-2 text-xs text-zinc-400 underline hover:text-white"
      >
        + Add add-on
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
      <div>
        <label className="block text-xs text-zinc-400">Description *</label>
        <input
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-48 rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-400">Amount ($) *</label>
        <input
          required
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-24 rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white"
      >
        Cancel
      </button>
      {error && <p className="w-full text-xs text-red-400">{error}</p>}
    </form>
  );
}
