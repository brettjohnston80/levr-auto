"use client";

import { useMemo, useState } from "react";
import type { AdminSearchRow } from "@/lib/admin-actions";

// "unpaid" is not a search_status: it's an awaiting_finalization row with no
// paid_at (sign-up-to-payment fix, 2026-09-30). Unpaid rows are hidden from
// every other option, "All" included, and shown only under their own
// filter -- they aren't real customers yet (real customer = paid search).
const UNPAID = "unpaid";
const UNPAID_LABEL = "Unpaid (checkout not completed)";

function isUnpaidRow(row: AdminSearchRow): boolean {
  return row.searchStatus === "awaiting_finalization" && !row.paidAt;
}

const STATUS_OPTIONS = [
  "All",
  UNPAID,
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

// The manual Pause/Resume buttons that lived here were removed 2026-09-27
// (Brett): the admin pause had no defined use, was never used in production,
// and didn't move the Day-30 guarantee or Day-60 deadline clocks (Resume on a
// Day-60 pause left the deadline in the past, so the next nightly run re-paused
// or auto-renew-charged it). Day-60-paused searches resume through the
// customer's paid extension or the agent extension bypass, which both move the
// deadline. admin_action_log and the admin_pause_search/admin_resume_search DB
// functions are kept for their history. Customer-requested holds (with clock
// extensions) are a recorded future item.

export function AdminSearchesTable({ searches }: { searches: AdminSearchRow[] }) {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("All");

  const filtered = useMemo(() => {
    if (statusFilter === UNPAID) return searches.filter(isUnpaidRow);
    const paidOnly = searches.filter((s) => !isUnpaidRow(s));
    if (statusFilter === "All") return paidOnly;
    return paidOnly.filter((s) => s.searchStatus === statusFilter);
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
              {s === UNPAID ? UNPAID_LABEL : s}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <div className="text-white">{row.customerName ?? "—"}</div>
                    <div className="text-zinc-500">
                      {row.customerEmail ?? "unknown"}
                      {/* Flagged, not filtered out -- this table is the one
                          place an operator goes to see EVERY search, so
                          hiding rows here would defeat its purpose. */}
                      {row.isTest && (
                        <span className="ml-2 rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-300 uppercase">
                          Test
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {row.make && row.model ? `${row.make} ${row.model}` : "Undecided"}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{row.searchStatus}</td>
                  <td className="px-4 py-3 text-zinc-400">{row.assignedAgentName ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{formatDate(row.paidAt)}</td>
                  <td className="px-4 py-3 text-zinc-400">{formatDate(row.searchDeadlineAt)}</td>
                  <td className="px-4 py-3 text-zinc-400">{formatDate(row.pausedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
