"use client";

import { useState, type FormEvent } from "react";
import { confirmDepositReceived } from "@/lib/outreach-actions";

export function ConfirmDepositForm({ offerId }: { offerId: string }) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await confirmDepositReceived(offerId, amount);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ml-2 inline-flex items-center gap-2">
      <input
        type="number"
        step="0.01"
        min="0"
        required
        placeholder="Deposit ($)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-28 rounded border border-white/10 bg-zinc-900 px-2 py-0.5 text-xs text-white"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded border border-white/10 px-2 py-0.5 text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-50"
      >
        {submitting ? "Confirming…" : "Confirm deposit received"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </form>
  );
}
