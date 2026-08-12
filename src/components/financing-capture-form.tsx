"use client";

import { useState, type FormEvent } from "react";
import { submitFinancingChoice } from "@/lib/deal-progress-actions";
import type { DashboardDealProgress } from "@/lib/customer-dashboard";

const INCOME_RANGES = ["Under $50k", "$50k–$100k", "$100k–$150k", "$150k+"];
const LOAN_TERMS = [36, 48, 60, 72, 84];

export function FinancingCaptureForm({
  offerId,
  existing,
}: {
  offerId: string;
  existing: DashboardDealProgress | null;
}) {
  const [choice, setChoice] = useState<"own" | "help">(
    (existing?.financingChoice as "own" | "help" | null) ?? "own"
  );
  const [incomeRange, setIncomeRange] = useState(existing?.financingIncomeRange ?? "");
  const [downPayment, setDownPayment] = useState(
    existing?.financingDownPaymentCents != null ? (existing.financingDownPaymentCents / 100).toString() : ""
  );
  const [desiredTerm, setDesiredTerm] = useState(
    existing?.financingDesiredTermMonths?.toString() ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    formData.set("qualifying_offer_id", offerId);
    formData.set("financing_choice", choice);

    const res = await submitFinancingChoice(formData);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-semibold text-zinc-400 uppercase">Financing</p>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setChoice("own")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            choice === "own" ? "bg-emerald-500 text-zinc-950" : "border border-white/10 text-zinc-400"
          }`}
        >
          Bringing my own
        </button>
        <button
          type="button"
          onClick={() => setChoice("help")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            choice === "help" ? "bg-emerald-500 text-zinc-950" : "border border-white/10 text-zinc-400"
          }`}
        >
          I want help
        </button>
      </div>

      {choice === "own" ? (
        <div className="mt-3">
          <label className="block text-xs text-zinc-400">
            Proof of financing (pre-approval letter, bank statement, etc.)
          </label>
          <input
            type="file"
            name="financing_proof"
            className="mt-1 w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white"
          />
          {existing?.financingProofUploadedAt && (
            <p className="mt-1 text-xs text-zinc-500">
              On file: uploaded {new Date(existing.financingProofUploadedAt).toLocaleDateString()}. Upload a
              new file to replace it.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-zinc-400">Income range</label>
            <select
              name="income_range"
              value={incomeRange}
              onChange={(e) => setIncomeRange(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
            >
              <option value="">Select…</option>
              {INCOME_RANGES.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400">Down payment ($)</label>
            <input
              type="number"
              name="down_payment"
              step="0.01"
              min="0"
              value={downPayment}
              onChange={(e) => setDownPayment(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400">Desired term</label>
            <select
              name="desired_term_months"
              value={desiredTerm}
              onChange={(e) => setDesiredTerm(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
            >
              <option value="">Select…</option>
              {LOAN_TERMS.map((months) => (
                <option key={months} value={months}>
                  {months} months
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save financing details"}
        </button>
        {success && <span className="text-xs text-emerald-400">Saved.</span>}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </form>
  );
}
