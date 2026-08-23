"use client";

import { useState } from "react";
import { addSalesperson, updateSalesperson } from "@/lib/dealership-actions";
import type { DealershipSalesperson } from "@/lib/dealership-queue";

interface Props {
  dealershipId: string;
  salesperson?: DealershipSalesperson;
  onSaved: (salesperson: DealershipSalesperson) => void;
  onCancel: () => void;
}

export function SalespersonForm({ dealershipId, salesperson, onSaved, onCancel }: Props) {
  const [name, setName] = useState(salesperson?.name ?? "");
  const [phone, setPhone] = useState(salesperson?.phone ?? "");
  const [email, setEmail] = useState(salesperson?.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    if (salesperson) {
      const result = await updateSalesperson(salesperson.id, name, phone, email);
      setSubmitting(false);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      onSaved({ id: salesperson.id, name: name.trim(), phone: phone.trim() || null, email: email.trim() || null });
      return;
    }

    const result = await addSalesperson(dealershipId, name, phone, email);
    setSubmitting(false);
    if (!result.ok || !result.id) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    onSaved({ id: result.id, name: name.trim(), phone: phone.trim() || null, email: email.trim() || null });
  }

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-300">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || name.trim() === ""}
          className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {submitting ? "Saving…" : salesperson ? "Save" : "Add"}
        </button>
      </div>
    </div>
  );
}
