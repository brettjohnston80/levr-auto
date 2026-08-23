"use client";

import { useState } from "react";
import { removeSalesperson } from "@/lib/dealership-actions";
import { SalespersonForm } from "@/components/salesperson-form";
import type { DealershipSalesperson } from "@/lib/dealership-queue";

interface Props {
  dealershipId: string;
  salesperson: DealershipSalesperson;
  onUpdated: (salesperson: DealershipSalesperson) => void;
  onRemoved: (id: string) => void;
}

export function SalespersonRow({ dealershipId, salesperson, onUpdated, onRemoved }: Props) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <SalespersonForm
        dealershipId={dealershipId}
        salesperson={salesperson}
        onSaved={(updated) => {
          onUpdated(updated);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    const result = await removeSalesperson(salesperson.id);
    setRemoving(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    onRemoved(salesperson.id);
  }

  return (
    <div className="rounded-lg border border-white/10 px-3 py-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white">{salesperson.name}</p>
          <p className="text-xs text-zinc-500">
            {[salesperson.phone, salesperson.email].filter(Boolean).join(" · ") || "No contact info"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-zinc-400 hover:text-white">
            Edit
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
