"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS, MAKES, MAKES_AND_MODELS, TIER_PRICING } from "@/lib/vehicle-data";
import { estimateMatches } from "@/lib/match-counter";
import { createClient } from "@/lib/supabase/client";
import { saveIntakeSearches } from "@/lib/intake-actions";
import { createCheckoutSession } from "@/lib/payment-actions";
import { AuthGateModal } from "@/components/auth-gate-modal";

type VehicleSlot = {
  id: number;
  make: string;
  model: string;
  trim: string;
  colors: string[];
};

function createVehicle(id: number): VehicleSlot {
  return { id, make: "", model: "", trim: "", colors: [] };
}

const PENDING_INTAKE_KEY = "levr_pending_intake";
const PENDING_INTAKE_TTL_MS = 60 * 60 * 1000; // 1 hour

type PendingIntake = { vehicles: VehicleSlot[]; zip: string; savedAt: number };

function stashPendingIntake(vehicles: VehicleSlot[], zip: string) {
  const payload: PendingIntake = { vehicles, zip, savedAt: Date.now() };
  window.localStorage.setItem(PENDING_INTAKE_KEY, JSON.stringify(payload));
}

function readPendingIntake(): PendingIntake | null {
  const raw = window.localStorage.getItem(PENDING_INTAKE_KEY);
  if (!raw) return null;
  try {
    const parsed: PendingIntake = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > PENDING_INTAKE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearPendingIntake() {
  window.localStorage.removeItem(PENDING_INTAKE_KEY);
}

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function ChevronIcon() {
  return (
    <svg
      className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-zinc-500"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d="M1.5 5L4 7.5L8.5 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-zinc-500"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M10 18s6-5.2 6-9.7A6 6 0 0 0 4 8.3C4 12.8 10 18 10 18Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="8.3" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">{label}</span>
      <div className="relative mt-2">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </div>
    </label>
  );
}

function MatchCounter({ vehicle, zip }: { vehicle: VehicleSlot; zip: string }) {
  const count = useMemo(
    () => estimateMatches(vehicle, zip, COLORS.length),
    [vehicle, zip]
  );
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (prevCount.current !== count) {
      prevCount.current = count;
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 350);
      return () => window.clearTimeout(t);
    }
  }, [count]);

  if (count === null) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-zinc-500">
        Select a make to see live matches
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors duration-300 ${
        pulse
          ? "border-emerald-400 bg-emerald-500/25 text-emerald-300"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      }`}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
      {count.toLocaleString()} vehicles match right now
    </div>
  );
}

export function IntakeFilter() {
  const [vehicles, setVehicles] = useState<VehicleSlot[]>([createVehicle(1)]);
  const [zip, setZip] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchIds, setSearchIds] = useState<string[]>([]);
  const [payingNow, setPayingNow] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const nextId = useRef(2);
  const resumeChecked = useRef(false);

  const zipTouched = zip.length > 0;
  const zipValid = /^\d{5}$/.test(zip);
  const allVehiclesComplete = vehicles.every((v) => v.make && v.model);
  const canSubmit = allVehiclesComplete && zipValid;
  const price = TIER_PRICING[vehicles.length];

  const totalMatches = vehicles.reduce(
    (sum, v) => sum + (estimateMatches(v, zip, COLORS.length) ?? 0),
    0
  );
  const anyMatchesReady = vehicles.some((v) => v.make);

  async function performSave(vehiclesToSave: VehicleSlot[], zipToSave: string) {
    setSaving(true);
    setSaveError(null);

    const result = await saveIntakeSearches(
      vehiclesToSave.map((v) => ({
        make: v.make,
        model: v.model,
        trim: v.trim,
        colors: v.colors,
      })),
      zipToSave
    );

    setSaving(false);

    if (!result.ok) {
      if (result.requiresAuth) {
        stashPendingIntake(vehiclesToSave, zipToSave);
        setAuthGateOpen(true);
      } else {
        setSaveError(result.error);
      }
      return;
    }

    clearPendingIntake();
    setSearchIds(result.searchIds);
    setSubmitted(true);
  }

  async function handleCheckout() {
    setPayingNow(true);
    setPayError(null);

    const result = await createCheckoutSession(searchIds);

    if (!result.ok) {
      setPayingNow(false);
      setPayError(result.error);
      return;
    }

    window.location.href = result.url;
  }

  // Resume-after-email-confirmation: if a pending intake was stashed before a
  // signup and the user is now signed in (e.g. they clicked the confirmation
  // link and landed back here), finish the save automatically.
  useEffect(() => {
    if (resumeChecked.current) return;
    resumeChecked.current = true;

    const pending = readPendingIntake();
    if (!pending) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setVehicles(pending.vehicles);
      setZip(pending.zip);
      performSave(pending.vehicles, pending.zip);
    });
  }, []);

  async function handleContinue() {
    if (!canSubmit || saving) return;
    await performSave(vehicles, zip);
  }

  function handleAuthenticated() {
    setAuthGateOpen(false);
    performSave(vehicles, zip);
  }

  function updateVehicle(id: number, patch: Partial<VehicleSlot>) {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  function addVehicle() {
    if (vehicles.length >= 3) return;
    setVehicles((prev) => [...prev, createVehicle(nextId.current++)]);
  }

  function removeVehicle(id: number) {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  }

  function startOver() {
    setVehicles([createVehicle(nextId.current++)]);
    setZip("");
    setSubmitted(false);
    setSaveError(null);
    setSearchIds([]);
    setPayError(null);
  }

  if (submitted) {
    return (
      <section id="get-started" className="bg-zinc-900 py-24">
        <div className="mx-auto max-w-2xl px-6">
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-10 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-zinc-950">
              ✓
            </span>
            <h2 className="mt-6 text-2xl font-semibold text-white">
              Nice pick — your search is saved.
            </h2>
            <ul className="mt-6 space-y-3 text-left">
              {vehicles.map((v, i) => (
                <li
                  key={v.id}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300"
                >
                  <span className="font-semibold text-white">
                    Vehicle {i + 1}: {v.make} {v.model}
                  </span>
                  <div className="mt-1 text-zinc-400">
                    Trim: {v.trim || "Any"} · Color:{" "}
                    {v.colors.length ? v.colors.join(", ") : "No preference"}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-lg font-semibold text-white">
              Total: ${price} for zip {zip}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              ~{totalMatches.toLocaleString()} vehicles nationwide currently match this search.
            </p>
            <p className="mt-4 text-sm text-zinc-400">
              Nothing has been charged yet. Once you check out, you&apos;ll fine-tune options like
              sunroof, leather, and packages before we start reaching out to dealers.
            </p>
            {payError && (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {payError}
              </p>
            )}
            <button
              onClick={handleCheckout}
              disabled={payingNow}
              className="mt-8 w-full rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 sm:w-auto"
            >
              {payingNow ? "Redirecting to checkout…" : `Proceed to Payment — $${price}`}
            </button>
            <div>
              <button
                onClick={startOver}
                className="mt-4 rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="get-started" className="bg-zinc-900 py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Tell us exactly what you want
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Make, model, trim, color. You decide the car; we do the rest.
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  vehicles.length === n
                    ? "bg-emerald-500 text-zinc-950"
                    : "text-zinc-400"
                }`}
              >
                {n} {n === 1 ? "vehicle" : "vehicles"} — ${TIER_PRICING[n]}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-12 space-y-6">
          {vehicles.map((vehicle, index) => (
            <div
              key={vehicle.id}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-xl shadow-black/20 sm:p-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-white">Vehicle {index + 1}</h3>
                </div>
                {vehicles.length > 1 && (
                  <button
                    onClick={() => removeVehicle(vehicle.id)}
                    aria-label="Remove vehicle"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M4 4L12 12M12 4L4 12"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>

              <div className="mt-4">
                <MatchCounter vehicle={vehicle} zip={zip} />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Make"
                  value={vehicle.make}
                  onChange={(value) => updateVehicle(vehicle.id, { make: value, model: "" })}
                  options={MAKES}
                  placeholder="Select make"
                />
                <SelectField
                  label="Model"
                  value={vehicle.model}
                  onChange={(value) => updateVehicle(vehicle.id, { model: value })}
                  options={vehicle.make ? MAKES_AND_MODELS[vehicle.make] : []}
                  placeholder={vehicle.make ? "Select model" : "Choose a make first"}
                  disabled={!vehicle.make}
                />
                <label className="block">
                  <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                    Trim <span className="text-zinc-500 normal-case">(optional)</span>
                  </span>
                  <input
                    type="text"
                    value={vehicle.trim}
                    onChange={(e) => updateVehicle(vehicle.id, { trim: e.target.value })}
                    placeholder="e.g. XLE, Sport, Limited"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </label>
              </div>

              <div className="mt-6">
                <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                  Color preference
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateVehicle(vehicle.id, { colors: [] })}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                      vehicle.colors.length === 0
                        ? "border-emerald-500 bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                        : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                    }`}
                  >
                    {vehicle.colors.length === 0 && <CheckIcon />}
                    No preference
                  </button>
                  {COLORS.map((color) => {
                    const active = vehicle.colors.includes(color);
                    return (
                      <button
                        type="button"
                        key={color}
                        onClick={() =>
                          updateVehicle(vehicle.id, { colors: toggleInArray(vehicle.colors, color) })
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                          active
                            ? "border-emerald-500 bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                            : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                        }`}
                      >
                        {active && <CheckIcon />}
                        {color}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  You&apos;ll fine-tune options like sunroof, leather, and packages right after
                  checkout — before we start reaching out to dealers.
                </p>
              </div>
            </div>
          ))}

          {vehicles.length < 3 && (
            <button
              type="button"
              onClick={addVehicle}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 py-4 text-sm font-semibold text-zinc-400 transition-colors hover:border-emerald-500/50 hover:text-emerald-400"
            >
              <span className="text-lg leading-none">+</span>
              Add another vehicle (brings total to ${TIER_PRICING[vehicles.length + 1]})
            </button>
          )}
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-900/90 p-6 shadow-2xl shadow-black/40 sm:p-8">
          <label className="block max-w-xs">
            <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
              Search zip code
            </span>
            <div className="relative mt-2">
              <PinIcon />
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="90210"
                className={`w-full rounded-xl border bg-zinc-950/80 py-3 pr-4 pl-11 text-sm font-medium text-white shadow-inner shadow-black/20 placeholder:text-zinc-600 focus:outline-none ${
                  zipTouched && !zipValid
                    ? "border-red-500/60 focus:border-red-500"
                    : "border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                }`}
              />
            </div>
            <span className="mt-2 block text-xs text-zinc-500">
              We search nationwide — this just helps us calibrate delivery estimates.
            </span>
            {zipTouched && !zipValid && (
              <span className="mt-1 block text-xs text-red-400">Enter a valid 5-digit zip code.</span>
            )}
          </label>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
            <div>
              <p className="text-sm text-zinc-400">
                {vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"} selected
              </p>
              <p className="text-2xl font-semibold text-white">${price} total</p>
              {anyMatchesReady && (
                <p className="mt-1 text-xs font-medium text-emerald-400">
                  ~{totalMatches.toLocaleString()} vehicles match your search right now
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!canSubmit || saving}
              onClick={handleContinue}
              className="w-full rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 sm:w-auto"
            >
              {saving ? "Saving…" : "Continue"}
            </button>
          </div>
          {!canSubmit && (
            <p className="mt-3 text-right text-xs text-zinc-500">
              Select a make and model for every vehicle and enter a valid zip code to continue.
            </p>
          )}
          {saveError && (
            <p className="mt-3 text-right text-xs text-red-400">{saveError}</p>
          )}
        </div>
      </div>

      <AuthGateModal
        open={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </section>
  );
}
