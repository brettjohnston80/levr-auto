"use client";

import { useMemo, useState } from "react";
import { pauseSearchByAdmin, resumeSearchByAdmin, type AdminSearchRow } from "@/lib/admin-actions";

const STATUS_OPTIONS = [
  "All",
  "awaiting_finalization",
  "pending_refinement",
  "searching",
  "paused",
  "switched",
  "cancelled",
  "purchased",
  "closed",
] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Inline notes-required action, shared shape for both Pause and Resume --
// click reveals a required textarea + confirm/cancel, mirroring the
// required-reason pattern already used by AgentCancellationResolutionForm/
// AgentBypassLookup, just lighter (no reason-category picker, just notes).
function AdminLifecycleAction({
  label,
  confirmLabel,
  onSubmit,
}: {
  label: string;
  confirmLabel: string;
  onSubmit: (notes: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return <span className="text-xs text-emerald-400">{confirmLabel}</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-white/15 px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/5"
      >
        {label}
      </button>
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(notes);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="w-56 rounded border border-white/15 bg-zinc-900 p-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (required)"
        rows={2}
        className="w-full rounded border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <div className="mt-1.5 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setNotes("");
          }}
          className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || notes.trim() === ""}
          className="rounded bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {submitting ? "Saving…" : label}
        </button>
      </div>
    </div>
  );
}

export function AdminSearchesTable({ searches }: { searches: AdminSearchRow[] }) {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("All");

  const filtered = useMemo(() => {
    if (statusFilter === "All") return searches;
    return searches.filter((s) => s.searchStatus === statusFilter);
  }, [searches, statusFilter]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number])}
          className="rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All" : s}
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-500">{filtered.length} of {searches.length}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-zinc-400">No searches match this filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Make/Model</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assigned Agent</th>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Deadline</th>
                <th className="px-4 py-3 font-medium">Paused</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <div className="text-white">{row.customerName ?? "—"}</div>
                    <div className="text-zinc-500">{row.customerEmail ?? "unknown"}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {row.make && row.model ? `${row.make} ${row.model}` : "Undecided"}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{row.searchStatus}</td>
                  <td className="px-4 py-3 text-zinc-400">{row.assignedAgentName ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{formatDate(row.paidAt)}</td>
                  <td className="px-4 py-3 text-zinc-400">{formatDate(row.searchDeadlineAt)}</td>
                  <td className="px-4 py-3 text-zinc-400">{formatDate(row.pausedAt)}</td>
                  <td className="px-4 py-3">
                    {row.searchStatus === "searching" && (
                      <AdminLifecycleAction
                        label="Pause"
                        confirmLabel="Paused"
                        onSubmit={(notes) => pauseSearchByAdmin(row.id, notes)}
                      />
                    )}
                    {row.searchStatus === "paused" && (
                      <AdminLifecycleAction
                        label="Resume"
                        confirmLabel="Resumed"
                        onSubmit={(notes) => resumeSearchByAdmin(row.id, notes)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
