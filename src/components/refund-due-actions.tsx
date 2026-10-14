"use client";

import { useRef, useState } from "react";
import { issueGuaranteeRefund, recordExistingGuaranteeRefund } from "@/lib/guarantee-refund-actions";
import { formatRefundAmount } from "@/lib/refund-format";

export interface RefundDueRow {
  id: string;
  vehicle: string;
  customerName: string | null;
  customerEmail: string | null;
  resolvedLabel: string;
  paymentId: string | null;
  remainingCents: number;
}

/**
 * The /internal/refunds-due worklist (Phase 1, Chunk 5). Client-side so a finished refund can
 * show its confirmation at the top AND leave the list at once, without a reload losing the
 * message. Wording: plan section 3.1.
 */
export function RefundsDueList({ initialRows }: { initialRows: RefundDueRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [done, setDone] = useState<{ who: string; message: string }[]>([]);

  function onDone(row: RefundDueRow, message: string, refundedCents: number) {
    setDone((d) => [{ who: row.customerName ?? row.customerEmail ?? "Customer", message }, ...d]);
    setRows((rs) =>
      rs.flatMap((r) => {
        if (r.id !== row.id) return [r];
        const remaining = r.remainingCents - refundedCents;
        return remaining > 0 ? [{ ...r, remainingCents: remaining }] : [];
      }),
    );
  }

  return (
    <div className="mt-8">
      {done.length > 0 && (
        <ul role="status" className="mb-6 space-y-2">
          {done.map((d, i) => (
            <li key={i} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <span className="font-semibold text-emerald-200">{d.who}:</span> {d.message}
            </li>
          ))}
        </ul>
      )}
      {rows.length === 0 ? (
        <p className="text-zinc-400">No refunds currently due.</p>
      ) : (
        <div className="rounded-2xl border border-white/10">
          <div className="hidden grid-cols-[1.3fr_1fr_0.9fr_0.6fr] gap-4 border-b border-white/10 px-4 py-3 text-xs font-medium tracking-wide text-zinc-500 uppercase sm:grid">
            <span>Customer</span>
            <span>Search</span>
            <span>Resolved</span>
            <span className="text-right">Refundable</span>
          </div>
          <ul className="divide-y divide-white/5">
            {rows.map((row) => (
              <RefundDueItem key={row.id} row={row} onDone={onDone} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RefundDueItem({ row, onDone }: { row: RefundDueRow; onDone: (row: RefundDueRow, message: string, refundedCents: number) => void }) {
  const [mode, setMode] = useState<"idle" | "confirm" | "record">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundId, setRefundId] = useState("");
  // Set synchronously, so a second click landing before React re-renders still can't send twice.
  const inFlight = useRef(false);
  const amount = formatRefundAmount(row.remainingCents);
  const who = row.customerName ?? row.customerEmail ?? "this customer";
  const canRefund = row.paymentId !== null && row.remainingCents > 0;

  async function issue() {
    if (inFlight.current) return; // a second click while the first is in flight does nothing
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const res = await issueGuaranteeRefund(row.id);
    inFlight.current = false;
    setBusy(false);
    if (res.ok) onDone(row, res.message, res.amountCents);
    else {
      setError(res.error);
      setMode("idle");
    }
  }

  async function record() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const res = await recordExistingGuaranteeRefund(row.id, refundId);
    inFlight.current = false;
    setBusy(false);
    if (res.ok) {
      onDone(row, res.message, res.amountCents);
      setRefundId("");
      setMode("idle");
    } else setError(res.error);
  }

  return (
    <li className="px-4 py-4 text-sm">
      <div className="grid gap-1 sm:grid-cols-[1.3fr_1fr_0.9fr_0.6fr] sm:gap-4">
        <div className="min-w-0">
          <div className="break-words text-white">{row.customerName ?? "—"}</div>
          <div className="break-all text-zinc-500">{row.customerEmail ?? "unknown"}</div>
        </div>
        <div className="text-zinc-300">{row.vehicle}</div>
        <div className="text-zinc-400">{row.resolvedLabel}</div>
        <div className="font-semibold text-white sm:text-right">
          <span className="mr-1 text-xs font-normal text-zinc-500 sm:hidden">Refundable</span>
          {row.paymentId ? amount : "—"}
        </div>
      </div>

      <div className="mt-3">
        {mode === "confirm" ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-amber-200">
              {`Refund ${amount} to ${who} for the Day-30 guarantee? This sends the money back through Stripe and can't be undone.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={issue}
                disabled={busy}
                className="rounded-lg bg-white px-4 py-2 font-semibold text-zinc-950 disabled:opacity-60"
              >
                {busy ? "Refunding…" : `Refund ${amount}`}
              </button>
              <button
                type="button"
                onClick={() => setMode("idle")}
                disabled={busy}
                className="rounded-lg border border-white/15 px-4 py-2 text-zinc-200 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("confirm");
              }}
              disabled={!canRefund || mode === "record"}
              className="rounded-lg bg-white px-4 py-2 font-semibold text-zinc-950 disabled:opacity-40"
            >
              Issue refund
            </button>
            {mode !== "record" && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("record");
                }}
                className="text-left text-zinc-300 underline underline-offset-2 hover:text-white"
              >
                Record a refund already issued in Stripe
              </button>
            )}
          </div>
        )}

        {mode === "record" && (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <label htmlFor={`refund-${row.id}`} className="block text-xs text-zinc-400">
              Stripe refund ID (starts with re_)
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                id={`refund-${row.id}`}
                value={refundId}
                onChange={(e) => setRefundId(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-white"
              />
              <button
                type="button"
                onClick={record}
                disabled={busy || refundId.trim() === ""}
                className="rounded-lg bg-white px-4 py-2 font-semibold text-zinc-950 disabled:opacity-50"
              >
                {busy ? "Recording…" : "Record refund"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("idle");
                  setError(null);
                }}
                disabled={busy}
                className="rounded-lg border border-white/15 px-4 py-2 text-zinc-200 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-red-400">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
