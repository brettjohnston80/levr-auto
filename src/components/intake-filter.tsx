"use client";

import { useEffect, useRef, useState } from "react";
import { MAKES, MAKES_AND_MODELS, FLAT_PRICE } from "@/lib/vehicle-data";
import { countNearbyInventory } from "@/lib/inventory-count";
import { INVENTORY_RADIUS_MILES } from "@/lib/inventory-radius";
import { createClient } from "@/lib/supabase/client";
import { saveIntakeSearch } from "@/lib/intake-actions";
import { createCheckoutSession } from "@/lib/payment-actions";
import { AuthGateModal } from "@/components/auth-gate-modal";

// Make/model/zip only -- trim, color, and options are collected post-payment
// during finalization (/finalize/[searchId]), matching the pending pivot's
// Steps 1-6: pre-payment intake stays light (just enough to show a live
// inventory count and start checkout), and finalizing the exact vehicle is
// a separate, explicit step once payment has landed.
type Vehicle = {
  make: string;
  model: string;
};

function emptyVehicle(): Vehicle {
  return { make: "", model: "" };
}

const PENDING_INTAKE_KEY = "levr_pending_intake";
const PENDING_INTAKE_TTL_MS = 60 * 60 * 1000; // 1 hour

type PendingIntake = { vehicle: Vehicle; zip: string; savedAt: number };

function stashPendingIntake(vehicle: Vehicle, zip: string) {
  const payload: PendingIntake = { vehicle, zip, savedAt: Date.now() };
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

// Presentational only -- IntakeFilter owns the actual fetch (debounced, one
// real countNearbyInventory call) so the badge here and the two other
// "~N vehicles" mentions on the page all share one result instead of each
// re-querying independently.
function MatchCounter({
  ready,
  loading,
  count,
}: {
  ready: boolean;
  loading: boolean;
  count: number | null;
}) {
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count !== null && prevCount.current !== count) {
      prevCount.current = count;
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 350);
      return () => window.clearTimeout(t);
    }
  }, [count]);

  if (!ready) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-zinc-500">
        Select a make, model, and zip to see live matches
      </div>
    );
  }

  if (loading || count === null) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-zinc-500">
        Checking live inventory…
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300">
        0 matching listings tracked near you right now — our nationwide outreach can still source it
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
      {count.toLocaleString()} {count === 1 ? "vehicle" : "vehicles"} within {INVENTORY_RADIUS_MILES} miles
    </div>
  );
}

export function IntakeFilter() {
  const [vehicle, setVehicle] = useState<Vehicle>(emptyVehicle());
  const [zip, setZip] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [payingNow, setPayingNow] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const resumeChecked = useRef(false);

  const zipTouched = zip.length > 0;
  const zipValid = /^\d{5}$/.test(zip);
  const vehicleComplete = Boolean(vehicle.make && vehicle.model);
  const canSubmit = vehicleComplete && zipValid;

  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const matchReady = vehicleComplete && zipValid;

  // Debounced -- this is now a real DB round trip (listings + zip_coordinates),
  // not a synchronous calculation, so it shouldn't fire on every keystroke.
  useEffect(() => {
    if (!matchReady) {
      setMatchCount(null);
      setMatchLoading(false);
      return;
    }

    let cancelled = false;
    setMatchLoading(true);

    const t = window.setTimeout(async () => {
      const result = await countNearbyInventory(vehicle.make, vehicle.model, zip);
      if (cancelled) return;
      setMatchLoading(false);
      setMatchCount(result.ok ? result.count : null);
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [matchReady, vehicle.make, vehicle.model, zip]);

  async function performSave(vehicleToSave: Vehicle, zipToSave: string) {
    setSaving(true);
    setSaveError(null);

    const result = await saveIntakeSearch(vehicleToSave, zipToSave);

    setSaving(false);

    if (!result.ok) {
      if (result.requiresAuth) {
        stashPendingIntake(vehicleToSave, zipToSave);
        setAuthGateOpen(true);
      } else {
        setSaveError(result.error);
      }
      return;
    }

    clearPendingIntake();
    setSearchId(result.searchId);
    setSubmitted(true);
  }

  async function handleCheckout() {
    if (!searchId) return;
    setPayingNow(true);
    setPayError(null);

    const result = await createCheckoutSession(searchId);

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
      setVehicle(pending.vehicle);
      setZip(pending.zip);
      performSave(pending.vehicle, pending.zip);
    });
  }, []);

  async function handleContinue() {
    if (!canSubmit || saving) return;
    await performSave(vehicle, zip);
  }

  function handleAuthenticated() {
    setAuthGateOpen(false);
    performSave(vehicle, zip);
  }

  function updateVehicle(patch: Partial<Vehicle>) {
    setVehicle((prev) => ({ ...prev, ...patch }));
  }

  function startOver() {
    setVehicle(emptyVehicle());
    setZip("");
    setSubmitted(false);
    setSaveError(null);
    setSearchId(null);
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
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left text-sm text-zinc-300">
              <span className="font-semibold text-white">
                {vehicle.make} {vehicle.model}
              </span>
            </div>
            <p className="mt-6 text-lg font-semibold text-white">
              Total: ${FLAT_PRICE} for zip {zip}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              {matchCount === null
                ? "Outreach begins right after checkout."
                : matchCount === 0
                  ? `0 matching listings tracked near you right now — our nationwide outreach can still source it.`
                  : `${matchCount.toLocaleString()} ${matchCount === 1 ? "vehicle" : "vehicles"} within ${INVENTORY_RADIUS_MILES} miles currently match this search.`}
            </p>
            <p className="mt-4 text-sm text-zinc-400">
              Nothing has been charged yet. Once you check out, you&apos;ll pick trim, color, and
              options — either yourself or on a call with your agent — before we start reaching
              out to dealers.
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
              {payingNow ? "Redirecting to checkout…" : `Proceed to Payment — $${FLAT_PRICE}`}
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
            Tell us what you want
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Make and model. You decide the car; we do the rest — trim, color, and options come
            right after checkout.
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm font-medium text-emerald-400">
            Flat ${FLAT_PRICE} — one vehicle, always
          </span>
        </div>

        <div className="mt-12 space-y-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-xl shadow-black/20 sm:p-8">
            <div className="mt-4">
              <MatchCounter ready={matchReady} loading={matchLoading} count={matchCount} />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Make"
                value={vehicle.make}
                onChange={(value) => updateVehicle({ make: value, model: "" })}
                options={MAKES}
                placeholder="Select make"
              />
              <SelectField
                label="Model"
                value={vehicle.model}
                onChange={(value) => updateVehicle({ model: value })}
                options={vehicle.make ? MAKES_AND_MODELS[vehicle.make] : []}
                placeholder={vehicle.make ? "Select model" : "Choose a make first"}
                disabled={!vehicle.make}
              />
            </div>

            <p className="mt-6 text-xs text-zinc-500">
              You&apos;ll fine-tune trim, color, and options right after checkout — before we
              start reaching out to dealers.
            </p>
          </div>
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
              <p className="text-2xl font-semibold text-white">${FLAT_PRICE} total</p>
              {matchReady && !matchLoading && matchCount !== null && (
                <p
                  className={`mt-1 text-xs font-medium ${matchCount === 0 ? "text-amber-400" : "text-emerald-400"}`}
                >
                  {matchCount === 0
                    ? `0 matching listings tracked near you right now — nationwide outreach can still source it`
                    : `${matchCount.toLocaleString()} ${matchCount === 1 ? "vehicle matches" : "vehicles match"} within ${INVENTORY_RADIUS_MILES} miles`}
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
              Select a make and model and enter a valid zip code to continue.
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
