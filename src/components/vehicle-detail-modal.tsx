"use client";

import { createPortal } from "react-dom";
import type { Answers } from "@/lib/matchmaker-data";
import { buildRationale, formatPriceEstimate, fuelTypeToPowertrain, type MatchmakerVehicle } from "@/lib/matchmaker-vehicle-display";
import {
  dimensionIndicator,
  personalizedDimensionOrder,
  INDICATOR_CLASSES,
  INDICATOR_LEVEL_LABEL,
} from "@/lib/matchmaker-dimension-indicators";

// vehicleType/familySize/priceRange are hard filters now (matchmaker-
// scoring.ts) -- every vehicle reaching this modal already satisfies them
// exactly, so these bullets are confirmations, not soft matches. Powertrain
// is NOT a hard filter (segmented display only), so its bullet only shows
// when the vehicle's folded powertrain genuinely matches the preference --
// a vehicle can legitimately reach this modal from an "alternatives" group
// with a different one. Priority-score bullets use the new 0-100 scale
// (80+ is a reasonable "excellent for its class" bar, the natural
// translation of the old system's "4 of 5" threshold onto the new scale).
function buildFitBullets(vehicle: MatchmakerVehicle, answers: Answers): string[] {
  const bullets: string[] = [];

  const typeMatches = answers.vehicleType !== "" && vehicle.bodyStyle === answers.vehicleType;
  if (typeMatches) {
    bullets.push(`Matches your ${answers.vehicleType} preference.`);
  }

  if (answers.powertrain && fuelTypeToPowertrain(vehicle.fuelType) === answers.powertrain) {
    bullets.push(`${answers.powertrain} powertrain, as you wanted.`);
  }

  if (answers.familySize) {
    const minSeats = answers.familySize === "6+" ? 6 : answers.familySize === "3-5" ? 3 : 0;
    if (minSeats === 0 || (vehicle.seatingCapacity !== null && vehicle.seatingCapacity >= minSeats)) {
      bullets.push(`Seating sized right for your group (${answers.familySize} riders).`);
    }
  }

  if (
    answers.priceRange &&
    vehicle.trueStartingPriceCents !== null &&
    vehicle.trueStartingPriceCents >= Math.round(answers.priceRange.min * 100) &&
    vehicle.trueStartingPriceCents <= Math.round(answers.priceRange.max * 100)
  ) {
    bullets.push("Falls within your target price range.");
  }

  if (answers.useCase && typeMatches) {
    bullets.push(`A solid fit for "${answers.useCase}."`);
  }

  answers.priorities.slice(0, 3).forEach((label, index) => {
    const score = vehicle.scores[label] ?? 0;
    if (score >= 80) {
      bullets.push(`Scores well on ${label}, your #${index + 1} priority.`);
    }
  });

  return bullets;
}

export function VehicleDetailModal({
  vehicle,
  answers,
  onClose,
}: {
  vehicle: MatchmakerVehicle;
  answers: Answers;
  onClose: () => void;
}) {
  const bullets = buildFitBullets(vehicle, answers);
  const priceEstimate = formatPriceEstimate(vehicle.trueStartingPriceCents);

  // Portaled to document.body (2026-09-02, real bug found during Step 5
  // verification, not new to this rewrite -- this modal's fixed/inset-0
  // CSS was already unchanged from before). The page-transition wrapper
  // around <main> (drive-transition-provider.tsx) applies
  // will-change-transform, which creates a new containing block for any
  // `position: fixed` descendant -- so without the portal, this modal
  // renders positioned relative to that wrapper instead of the viewport,
  // landing far off-screen on any page that's been scrolled. Same root
  // cause and same fix already applied to mobile-nav-menu.tsx.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 px-6 py-12 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
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

        <p className="pr-8 text-xs font-semibold tracking-wide text-emerald-400 uppercase">
          {vehicle.bodyStyle} · {vehicle.fuelType ?? "—"}
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-white">
          {vehicle.make} {vehicle.model} {vehicle.trim}
        </h2>
        <p className="mt-1 text-sm font-semibold text-emerald-400">{priceEstimate}</p>

        <p className="mt-4 text-sm leading-relaxed text-zinc-300">{buildRationale(vehicle)}</p>

        {bullets.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Why this fits you</h3>
            <ul className="mt-3 space-y-2">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Full 9-dimension breakdown (Step F, approved 2026-09-02, Part
            3) -- a new, separate section from "Why this fits you" above,
            not a replacement for it: the bullets confirm hard-filter
            matches and narratively call out standout (>=80) scores,
            this is the complete personalized-order breakdown across every
            valid dimension for THIS vehicle's own body style. Reads
            `vehicle` directly (the same prop the rest of this modal
            already uses) -- when a grouped results card (matchmaker.tsx)
            opens this modal for whichever trim is currently toggled
            active, not necessarily the group's headline, this section
            automatically reflects that specific trim's own scores/
            hasData with no extra wiring, since it never looks at the
            group, only at whatever single vehicle it was given. */}
        <div className="mt-6">
          <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
            How it scores on what matters to you
          </h3>
          <ul className="mt-3 space-y-1.5">
            {personalizedDimensionOrder(vehicle.bodyStyle, answers.priorities).map((label) => {
              const score = vehicle.scores[label] ?? 0;
              const hasData = vehicle.hasData[label] ?? false;
              const level = dimensionIndicator(score, hasData);
              return (
                <li key={label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-300">{label}</span>
                  <div className="flex items-center gap-2">
                    {hasData && <span className="text-xs text-zinc-500">{Math.round(score)}/100</span>}
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${INDICATOR_CLASSES[level]}`}
                    >
                      {INDICATOR_LEVEL_LABEL[level]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* PROPOSED customer-facing copy, pending explicit sign-off -- the
            old line ("...once Matchmaker connects to real inventory data")
            is now stale: this IS real researched vehicle data, just not
            live dealer inventory (VIN-level pricing/availability). */}
        <p className="mt-6 border-t border-white/10 pt-4 text-xs text-zinc-500">
          Full spec sheets and trusted review videos will show up here once Matchmaker connects to
          live dealer inventory.
        </p>
      </div>
    </div>,
    document.body,
  );
}
