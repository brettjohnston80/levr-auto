"use client";

import { useState, type FormEvent } from "react";
import { switchCustomerSearch } from "@/lib/switch-actions";

export function AgentSwitchSearchForm({ searchId }: { searchId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [newMake, setNewMake] = useState("");
  const [newModel, setNewModel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("old_search_id", searchId);
    formData.set("new_make", newMake);
    formData.set("new_model", newModel);

    const res = await switchCustomerSearch(formData);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    // On success, revalidatePath refreshes the page — the switched search
    // drops out of this queue (no longer search_status = 'searching').
    setExpanded(false);
    setNewMake("");
    setNewModel("");
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-4 text-sm text-zinc-400 underline hover:text-white"
      >
        Switch this customer to a different make/model
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-zinc-500">
        Use this after the customer requests a change (phone/email). This starts a new search and closes
        out the current one.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-400">New make *</label>
          <input
            required
            value={newMake}
            onChange={(e) => setNewMake(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400">New model *</label>
          <input
            required
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
        >
          {submitting ? "Switching…" : "Confirm switch"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
