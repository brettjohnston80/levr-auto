"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  requestSwitchCall,
  checkSwitchEligibility,
  executeFreeSwitch,
  createSwitchFeeCheckoutSession,
} from "@/lib/switch-self-service-actions";
import type { MakeModelOptions, ModelYearOptions } from "@/lib/intake-vehicle-options";
import { soleYearForModel, yearsForModel } from "@/lib/model-year-select";

type Mode = "choice" | "pick" | "free-confirm" | "paid-warning" | "call-requested";

const selectClass =
  "mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40";

export function SwitchChoice({
  searchId,
  make,
  model,
  switchCallAlreadyRequested,
  makeModelOptions,
  modelYearOptions,
}: {
  searchId: string;
  make: string;
  model: string;
  switchCallAlreadyRequested: boolean;
  /**
   * The live dataset, same source intake reads. The pick step used to be
   * two free-text boxes nothing validated; it now offers only real,
   * committable vehicles, and the server re-checks all three fields.
   */
  makeModelOptions: MakeModelOptions;
  modelYearOptions: ModelYearOptions;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(switchCallAlreadyRequested ? "call-requested" : "choice");
  const [newMake, setNewMake] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newYear, setNewYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makes = Object.keys(makeModelOptions).sort((a, b) => a.localeCompare(b));
  const models = makeModelOptions[newMake] ?? [];
  const years = yearsForModel(modelYearOptions, newMake, newModel);
  const pickComplete = Boolean(newMake && newModel && newYear);

  async function handleRequestCall() {
    setBusy(true);
    setError(null);
    const result = await requestSwitchCall(searchId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode("call-requested");
  }

  async function handlePickSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pickComplete) return;

    setBusy(true);
    setError(null);
    const result = await checkSwitchEligibility(searchId);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode(result.eligible ? "free-confirm" : "paid-warning");
  }

  async function handleConfirmFreeSwitch() {
    setBusy(true);
    setError(null);
    const result = await executeFreeSwitch(searchId, newMake, newModel, Number(newYear));
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/finalize/${result.newSearchId}`);
  }

  async function handleContinueToPayment() {
    setBusy(true);
    setError(null);
    const result = await createSwitchFeeCheckoutSession(searchId, newMake, newModel, Number(newYear));
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.location.href = result.url;
  }

  if (mode === "call-requested") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
        <p className="text-sm text-zinc-200">
          Request received. Our team&apos;s been notified and will reach out to discuss your
          requested change as soon as possible. We&apos;re actively working deals for you and
          every other LEVR customer right now, so thanks for your patience — you&apos;ll hear from
          us soon.
        </p>
      </div>
    );
  }

  if (mode === "paid-warning") {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
        <p className="text-sm font-semibold text-white">
          Switching your make or model will:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
          <li>Charge a $100 switch fee</li>
          <li>Restart your 30-day and 60-day guarantee clocks from today</li>
          <li>
            Not carry over any offer already found on your current vehicle — the guarantee starts
            clean against your new pick
          </li>
        </ul>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleContinueToPayment}
            disabled={busy}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {busy ? "Redirecting…" : "Continue to payment"}
          </button>
          <button
            type="button"
            onClick={() => setMode("pick")}
            disabled={busy}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (mode === "free-confirm") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
        <p className="text-sm text-zinc-200">
          You&apos;re within your free switch window, so this won&apos;t cost anything. It will
          still restart your 30-day and 60-day guarantee clocks, and any offer already found on
          your current vehicle won&apos;t carry over.
        </p>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleConfirmFreeSwitch}
            disabled={busy}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {busy ? "Switching…" : `Confirm switch to ${newYear} ${newMake} ${newModel}`}
          </button>
          <button
            type="button"
            onClick={() => setMode("pick")}
            disabled={busy}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (mode === "pick") {
    return (
      <form
        onSubmit={handlePickSubmit}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
      >
        <p className="text-sm text-zinc-400">
          What would you like to switch to instead of your {make} {model}?
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-zinc-400">New make *</label>
            <select
              required
              value={newMake}
              onChange={(e) => {
                setNewMake(e.target.value);
                setNewModel("");
                setNewYear("");
              }}
              className={selectClass}
            >
              <option value="">Select make</option>
              {makes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400">New model *</label>
            <select
              required
              value={newModel}
              disabled={!newMake}
              onChange={(e) => {
                setNewModel(e.target.value);
                setNewYear(soleYearForModel(modelYearOptions, newMake, e.target.value));
              }}
              className={selectClass}
            >
              <option value="">{newMake ? "Select model" : "Choose a make first"}</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400">New model year *</label>
            <select
              required
              value={newYear}
              disabled={!newModel}
              onChange={(e) => setNewYear(e.target.value)}
              className={selectClass}
            >
              <option value="">{newModel ? "Select year" : "Choose a model first"}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={busy || !pickComplete}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Continue"}
          </button>
          <button
            type="button"
            onClick={() => setMode("choice")}
            disabled={busy}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-sm font-semibold text-white">Want a different make or model?</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("pick")}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left transition-colors hover:border-emerald-500/60"
        >
          <h3 className="text-sm font-semibold text-white">Switch it myself</h3>
          <p className="mt-1 text-xs text-zinc-400">Pick a new make and model right now.</p>
        </button>
        <button
          type="button"
          onClick={handleRequestCall}
          disabled={busy}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <h3 className="text-sm font-semibold text-white">Have an agent handle it</h3>
          <p className="mt-1 text-xs text-zinc-400">
            {busy ? "Requesting…" : "We'll reach out to make the change for you."}
          </p>
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
