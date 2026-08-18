"use client";

import { useEffect, useState } from "react";
import {
  getCustomerPaymentsForCancellation,
  resolveCancellation,
  type CustomerPaymentForRefund,
} from "@/lib/agent-cancellation-actions";
import { CANCELLATION_REASON_CATEGORIES } from "@/lib/cancellation-reasons";

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  search_fee: "Original search fee",
  switch_fee: "Switch fee",
  extension_fee: "Extension fee",
};

// Resolves an agent-mediated cancellation (Part 2, plan.md) -- reason +
// notes, plus a picker over every payment this customer has ever made
// (not just this search's own -- see getCustomerPaymentsForCancellation's
// comment), each with an editable refund amount bounded by its own
// remaining balance. Used two ways: inline per-row on the "Cancellation
// calls requested" queue (searchId/customerId already known), and from
// AgentCancellationLookup once a search is picked there -- same component,
// same props shape either way.
export function AgentCancellationResolutionForm({
  searchId,
  customerId,
}: {
  searchId: string;
  customerId: string;
}) {
  const [payments, setPayments] = useState<CustomerPaymentForRefund[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reasonCategory, setReasonCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [refundInputs, setRefundInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ refundsIssued: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getCustomerPaymentsForCancellation(customerId);
      if (cancelled) return;
      if ("error" in res) {
        setLoadError(res.error);
        return;
      }
      setPayments(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const refundLineItems = Object.entries(refundInputs)
      .map(([paymentId, value]) => ({ paymentId, amountCents: Math.round(parseFloat(value) * 100) }))
      .filter((item) => Number.isFinite(item.amountCents) && item.amountCents > 0);

    const res = await resolveCancellation(searchId, reasonCategory, notes, refundLineItems);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult({ refundsIssued: res.refundsIssued });
  }

  if (result) {
    return (
      <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
        Search cancelled.{" "}
        {result.refundsIssued > 0
          ? `${result.refundsIssued} refund${result.refundsIssued === 1 ? "" : "s"} issued.`
          : "No refund issued."}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
      <div>
        <label className="block text-xs text-zinc-400">Reason *</label>
        <select
          required
          value={reasonCategory}
          onChange={(e) => setReasonCategory(e.target.value)}
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        >
          <option value="" disabled>
            Select a reason…
          </option>
          {CANCELLATION_REASON_CATEGORIES.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-zinc-400">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <p className="text-xs text-zinc-400">Refund (optional, against any of this customer&apos;s payments)</p>
        {loadError && <p className="mt-1 text-xs text-red-400">{loadError}</p>}
        {payments === null && !loadError && <p className="mt-1 text-xs text-zinc-500">Loading payments…</p>}
        {payments?.length === 0 && <p className="mt-1 text-xs text-zinc-500">No payments on file.</p>}
        {payments && payments.length > 0 && (
          <div className="mt-2 space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-zinc-300">
                  {PAYMENT_TYPE_LABEL[payment.paymentType] ?? payment.paymentType} — {payment.searchMake}{" "}
                  {payment.searchModel} — {formatCents(payment.amountCents)} charged,{" "}
                  {formatCents(payment.remainingCents)} refundable
                </span>
                <input
                  type="number"
                  min="0"
                  max={payment.remainingCents / 100}
                  step="0.01"
                  placeholder="$0.00"
                  disabled={payment.remainingCents === 0}
                  value={refundInputs[payment.id] ?? ""}
                  onChange={(e) =>
                    setRefundInputs((prev) => ({ ...prev, [payment.id]: e.target.value }))
                  }
                  className="w-24 rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-right text-white disabled:opacity-40"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !reasonCategory}
        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
      >
        {submitting ? "Resolving…" : "Cancel search & resolve"}
      </button>
    </div>
  );
}
