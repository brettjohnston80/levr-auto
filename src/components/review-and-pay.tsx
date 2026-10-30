"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MakeModelOptions, ModelYearOptions } from "@/lib/intake-vehicle-options";
import { soleYearForModel, yearsForModel } from "@/lib/model-year-select";
import { updateUnpaidSearch } from "@/lib/intake-actions";
import { createCheckoutSession } from "@/lib/payment-actions";
import { PickupTravelGauge } from "@/components/pickup-travel-gauge";
import { PICKUP_TRAVEL_DEFAULT, PICKUP_TRAVEL_QUESTION, travelValueLabel } from "@/lib/pickup-travel";
import { INVENTORY_SOURCE_NOTE, nearbyInventoryCopy } from "@/lib/inventory-radius";
import { FLAT_PRICE } from "@/lib/vehicle-data";
import { guaranteeExceptionMake } from "@/lib/guarantee-exceptions";
import {
  EXCEPTIONS_FINE_PRINT,
  noGuaranteeLine,
  TERMS_AGREE_AFTER,
  TERMS_AGREE_BEFORE,
  TERMS_AGREE_LINK,
  TERMS_REQUIRED,
} from "@/lib/guarantee-exception-copy";

// "Review and pay" in Your Car (sign-up-to-payment fix, approved 2026-09-30,
// docs/plans/signup-to-payment-plan.md): the one clear moment where a saved,
// unpaid search is reviewed, edited and paid for. Everything here persists
// on the server, so it survives leaving, logging out and other devices.
// Payment is the only way forward; make and model lock once paid.

// Approved wording (2026-09-30).
const COPY = {
  heading: "Review your search",
  intro: "Check your choices, then pay to start. You can change any of these until you pay.",
  vehicle: "Vehicle",
  modelYear: "Model year",
  zip: "ZIP code",
  pickup: "Pickup range",
  change: "Change",
  undecidedVehicle: "To be chosen with your agent",
  includedHeading: "What's included",
  included: [
    "Your LEVR agent negotiates with dealers nationwide for this vehicle.",
    "Offers land in your account — accept one or pass. You're never obligated to buy.",
    "A flat $699 — no commission, no markup.",
    "At least one real offer below Total SRP within 30 days of your search going live, or your $699 back.",
  ],
  nextUndecided: "After you pay, your agent will reach out to help you choose the vehicle.",
  // One paragraph replacing "how it works", "after you pay" and the lock note, which repeated
  // each other (BAE, 2026-10-29). Approved by Brett 2026-10-29.
  howItWorks: "Here's how it works: after you pay, you'll choose your exact trim, color and options, and you can change them for 24 hours. Then your search goes live, and your agent goes to dealers for that exact car. Your make and model lock once you pay. Still deciding? Try the ",
  howItWorksLink: "Matchmaker",
  howItWorksEnd: " first.",
  pay: `Continue to payment — $${FLAT_PRICE}`,
};

export interface ReviewAndPaySearch {
  id: string;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  zip: string | null;
  /** Pickup-range form value (see PICKUP_TRAVEL_OPTIONS), "" when none. */
  pickupTravel: string;
}

export function ReviewAndPay({
  search,
  makeModelOptions,
  modelYearOptions,
  syncedCount,
  nearbyCount,
  termsAccepted,
}: {
  search: ReviewAndPaySearch;
  makeModelOptions: MakeModelOptions;
  modelYearOptions: ModelYearOptions;
  /** Existing approved inventory lines; null = no count (hidden). */
  /** Listings we've synced for the make and model (null if the count failed). */
  syncedCount: number | null;
  nearbyCount: number | null;
  /** GX-3: false until the customer has accepted the current terms (the W3 box then shows). */
  termsAccepted: boolean;
}) {
  const router = useRouter();
  const undecided = !search.make || !search.model;
  const [editing, setEditing] = useState(false);
  const [make, setMake] = useState(search.make ?? "");
  const [model, setModel] = useState(search.model ?? "");
  const [modelYear, setModelYear] = useState(search.modelYear != null ? String(search.modelYear) : "");
  const [zip, setZip] = useState(search.zip ?? "");
  const [pickupTravel, setPickupTravel] = useState(search.pickupTravel || PICKUP_TRAVEL_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const exceptionBrand = guaranteeExceptionMake(search.make);

  const makes = Object.keys(makeModelOptions).sort();
  const models = make ? [...(makeModelOptions[make] ?? [])].sort() : [];
  const years = make && model ? yearsForModel(modelYearOptions, make, model) : [];
  const canSave = Boolean(make && model && modelYear && /^\d{5}$/.test(zip) && pickupTravel);

  function startEditing() {
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setMake(search.make ?? "");
    setModel(search.model ?? "");
    setModelYear(search.modelYear != null ? String(search.modelYear) : "");
    setZip(search.zip ?? "");
    setPickupTravel(search.pickupTravel || PICKUP_TRAVEL_DEFAULT);
    setError(null);
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await updateUnpaidSearch(search.id, {
      kind: "vehicle",
      make,
      model,
      modelYear: modelYear ? Number(modelYear) : null,
      zip,
      pickupTravel: pickupTravel || null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function pay() {
    if (!termsAccepted && !agreed) {
      setError(TERMS_REQUIRED);
      return;
    }
    setPaying(true);
    setError(null);
    const res = await createCheckoutSession(search.id, !termsAccepted && agreed);
    if (!res.ok) {
      setPaying(false);
      setError(res.error);
      return;
    }
    window.location.href = res.url;
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";

  return (
    <div>
      <Link href="/account" className="text-sm text-zinc-400 hover:text-white">
        ← Back to your account
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">{COPY.heading}</h1>
      <p className="mt-2 text-sm text-zinc-400">{COPY.intro}</p>

      {editing ? (
        <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-zinc-400">
              Make
              <select
                className={fieldClass}
                value={make}
                onChange={(e) => {
                  setMake(e.target.value);
                  setModel("");
                  setModelYear("");
                }}
              >
                <option value="">Select make</option>
                {makes.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              Model
              <select
                className={fieldClass}
                value={model}
                disabled={!make}
                onChange={(e) => {
                  setModel(e.target.value);
                  setModelYear(soleYearForModel(modelYearOptions, make, e.target.value));
                }}
              >
                <option value="">{make ? "Select model" : "Choose a make first"}</option>
                {models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              {COPY.modelYear}
              <select
                className={fieldClass}
                value={modelYear}
                disabled={!model}
                onChange={(e) => setModelYear(e.target.value)}
              >
                <option value="">{model ? "Select year" : "Choose a model first"}</option>
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs text-zinc-400">
            {COPY.zip}
            <input
              className={fieldClass}
              inputMode="numeric"
              placeholder="90210"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            />
          </label>
          <div>
            <p className="text-xs text-zinc-400">{PICKUP_TRAVEL_QUESTION}</p>
            <div className="mt-2">
              <PickupTravelGauge value={pickupTravel} onChange={setPickupTravel} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={save}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
          {[
            { label: COPY.vehicle, value: undecided ? COPY.undecidedVehicle : `${search.make} ${search.model}` },
            ...(undecided
              ? []
              : [
                  { label: COPY.modelYear, value: search.modelYear != null ? String(search.modelYear) : "—" },
                  { label: COPY.zip, value: search.zip ?? "—" },
                  { label: COPY.pickup, value: travelValueLabel(search.pickupTravel) ?? "—" },
                ]),
          ].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 px-4 py-3">
              <dt className="text-xs text-zinc-500">{row.label}</dt>
              <dd className="flex items-baseline gap-3 text-right text-sm text-white">
                {row.value}
                <button type="button" onClick={startEditing} className="text-xs text-emerald-400 underline hover:text-emerald-300">
                  {COPY.change}
                </button>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {!undecided && !editing && (
        <div className="mt-3 space-y-1 text-xs text-zinc-400">
          {/* Our listings are a sample, never the nationwide market (BAE, 2026-10-29). */}
          {syncedCount === 0 && <p>{nearbyInventoryCopy(0, 0)}</p>}
          {syncedCount !== null && syncedCount > 0 && nearbyCount !== null && (
            <>
              <p>{nearbyInventoryCopy(nearbyCount, syncedCount)}</p>
              <p className="text-zinc-500">{INVENTORY_SOURCE_NOTE}</p>
            </>
          )}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-300">{COPY.includedHeading}</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
          {COPY.included.map((line, i) =>
            // W2 (GX-3): an exception brand gets this in place of the guarantee bullet (the last one).
            i === COPY.included.length - 1 && exceptionBrand ? (
              <li key="no-guarantee" className="flex gap-2 text-zinc-400">
                <span className="text-zinc-500">–</span>
                {noGuaranteeLine(exceptionBrand)}
              </li>
            ) : (
              <li key={line} className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                {line}
              </li>
            ),
          )}
        </ul>
        {!undecided && (
          <p className="mt-3 text-sm text-zinc-400">
            {COPY.howItWorks}
            <a href="/matchmaker" className="text-emerald-400 underline hover:text-emerald-300">
              {COPY.howItWorksLink}
            </a>
            {COPY.howItWorksEnd}
          </p>
        )}
      </div>

      {undecided && <p className="mt-6 text-sm text-zinc-400">{COPY.nextUndecided}</p>}

      {/* W3 with W3a under it (GX-3): once, before the first payment, and again when the terms change. */}
      {!termsAccepted && (
        <div className="mt-6">
          <label className="flex items-start gap-3 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked && error === TERMS_REQUIRED) setError(null);
              }}
              className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
            />
            <span>
              {TERMS_AGREE_BEFORE}
              <a href="/terms" target="_blank" rel="noreferrer" className="text-emerald-400 underline hover:text-emerald-300">
                {TERMS_AGREE_LINK}
              </a>
              {TERMS_AGREE_AFTER}
            </span>
          </label>
          <p className="mt-1.5 pl-8 text-xs text-zinc-500">{EXCEPTIONS_FINE_PRINT}</p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={pay}
        disabled={paying || editing}
        className="mt-6 w-full rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 sm:w-auto"
      >
        {paying ? "Redirecting to checkout…" : COPY.pay}
      </button>
    </div>
  );
}
