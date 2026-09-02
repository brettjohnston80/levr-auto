"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Answers } from "@/lib/matchmaker-data";
import { formatPriceEstimate, fuelTypeToPowertrain, type MatchmakerVehicle } from "@/lib/matchmaker-vehicle-display";
import { SilhouetteIcon } from "@/components/vehicle-silhouette";
import { countNationwideInventory } from "@/lib/inventory-count";
import {
  dimensionIndicator,
  dimensionDataPoint,
  personalizedDimensionOrder,
  INDICATOR_CLASSES,
  INDICATOR_LEVEL_LABEL,
} from "@/lib/matchmaker-dimension-indicators";

// Real, working sample video (this task, 2026-09-01) -- shown identically
// for every vehicle until real per-vehicle video sourcing exists. Genuine
// review content, not a placeholder/joke: Kelley Blue Book's own verified
// YouTube channel (youtube.com/@kbb), "2017 Honda Civic - Review and Road
// Test," confirmed via direct browser check before use -- real channel,
// real upload, real view count. Embeds via YouTube's standard
// youtube.com/embed/<id> format (an <iframe>, genuine in-page playback,
// no redirect/new-tab navigation) with no autoplay param, so it never
// plays until the customer clicks it.
const SAMPLE_REVIEW_VIDEO_ID = "K6kyAeAozBs";

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

  // Nationwide live-inventory count (this task, 2026-09-02) -- make+model
  // only, never trim-specific (see countNationwideInventory's own comment
  // for why: a direct spot-check found trim-string matching unreliable on
  // real data). `null` covers both "not loaded yet" and "the query itself
  // failed" -- neither should render a misleading count, so the line is
  // simply absent in both cases rather than showing a stale/wrong number.
  const [nationwideCount, setNationwideCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNationwideCount(null);
    countNationwideInventory(vehicle.make, vehicle.model).then((result) => {
      if (cancelled) return;
      setNationwideCount(result.ok ? result.count : null);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicle.make, vehicle.model]);

  // Portaled to document.body (2026-09-02, real bug found during Step 5
  // verification, not new to this rewrite -- this modal's fixed/inset-0
  // CSS was already unchanged from before). The page-transition wrapper
  // around <main> (drive-transition-provider.tsx) applies
  // will-change-transform, which creates a new containing block for any
  // `position: fixed` descendant -- so without the portal, this modal
  // renders positioned relative to that wrapper instead of the viewport,
  // landing far off-screen on any page that's been scrolled. Same root
  // cause and same fix already applied to mobile-nav-menu.tsx.
  //
  // z-[110], not z-[100] (bumped for the Comparison Tool's "More info"
  // button, this task) -- this modal can now open WHILE ComparisonModal
  // (also z-[100], also a document.body portal) is still open behind it.
  // Two equal z-index portals would fall back to DOM/mount order to
  // decide which paints on top, which isn't reliably guaranteed across
  // React's portal-commit timing -- a strictly higher z-index makes the
  // stacking deterministic instead, same z-[110]-over-z-[100] convention
  // mobile-nav-menu.tsx already uses for the identical "render above an
  // already-portaled z-[100] overlay" situation.
  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/70 px-6 py-12 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:p-8"
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

        {/* Single two-column grid for the ENTIRE modal body (restructured
            2026-09-02) -- previously the title/price+photo lived in their
            own flex row up top, separate from a second grid further down
            holding "How it scores"+video, which meant Photo and Video sat
            in two DIFFERENT containers with different widths (Photo
            squeezed next to the title text, Video given the full right-
            column width) -- same aspect-video class, genuinely different
            rendered pixel size. Merging into one grid means Photo and
            Video are now both children of the exact same right-column
            grid track, so they're pixel-identical in width (and therefore
            height, both being aspect-video) by construction, not by
            coincidence.
            lg:pr-8 on the right column only (not the whole grid) --
            clears the absolutely-positioned close button, same amount
            already proven correct when Photo first moved up here: with
            the button at top-5 right-5 (h-8 w-8) relative to the card, and
            the grid content itself already inset by the card's own
            p-6/p-8, this leaves a clean ~12px gap between "Photo"'s
            heading and the button rather than lg:pr-0 -- Only the right
            column needs it since the left column's content stays well
            clear of the top-right corner regardless. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left column: title/price, "Why this fits you", "How it scores"
              -- all three now share one column, in source order, so this
              is also what stacks first on mobile (grid-cols-1). */}
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-emerald-400 uppercase">
              {vehicle.bodyStyle} · {vehicle.fuelType ?? "—"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              {vehicle.make} {vehicle.model} {vehicle.trim}
            </h2>
            <p className="mt-1 text-sm font-semibold text-emerald-400">{priceEstimate}</p>

            {/* Nationwide listing count (this task, 2026-09-02) -- deliberately
                make+model level, not trim-specific (see the state/effect
                above), so the wording always says "across all trims" rather
                than implying this count is scoped to the exact trim shown in
                the heading above. Absent entirely while loading or on a
                query error -- never a flashed/misleading "0". The zero case
                gets its own honest sentence, not a bare "0 listings", same
                "tracked" framing (not "available") already used by the
                intake match-counter's own zero state, since this table only
                reflects what's been synced, not the true nationwide market. */}
            {nationwideCount !== null && (
              <p className="mt-1 text-xs text-zinc-500">
                {nationwideCount > 0
                  ? `${nationwideCount.toLocaleString()} ${vehicle.make} ${vehicle.model} listings nationwide (all trims)`
                  : `No ${vehicle.make} ${vehicle.model} listings currently tracked nationwide`}
              </p>
            )}

            {/* The old single-line auto-generated rationale sentence was
                removed here (2026-09-02) -- redundant with the "How it
                scores on what matters to you" breakdown below, which
                already surfaces the same kind of data point per dimension
                with added color context. buildRationale() itself was
                deleted from matchmaker-vehicle-display.ts, confirmed via
                grep to have no other callers. */}

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
                3; extended to show the same per-dimension data point as the
                card in Step H4, approved 2026-09-02) -- a new, separate
                section from "Why this fits you" above, not a replacement for
                it: the bullets confirm hard-filter matches and narratively
                call out standout (>=80) scores, this is the complete
                personalized-order breakdown across every valid dimension for
                THIS vehicle's own body style. Row shape now matches the
                card's exactly (label -- data point -- colored pill), via the
                same dimensionDataPoint() call, rather than showing a bare
                "X/100" score number -- the data point is more informative and
                human-readable, and reusing the identical shape/wording is
                what actually keeps the two surfaces from drifting apart, not
                just having them both technically derive from the same
                scores. Reads `vehicle` directly (the same prop the rest of
                this modal already uses) -- when a grouped results card
                (matchmaker.tsx) opens this modal for whichever trim is
                currently toggled active, not necessarily the group's
                headline, this section automatically reflects that specific
                trim's own scores/hasData/data point with no extra wiring,
                since it never looks at the group, only at whatever single
                vehicle it was given. */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                How it scores on what matters to you
              </h3>
              <ul className="mt-3 space-y-1.5">
                {personalizedDimensionOrder(vehicle.bodyStyle, answers.priorities).map((label) => {
                  const score = vehicle.scores[label] ?? 0;
                  const hasData = vehicle.hasData[label] ?? false;
                  const level = dimensionIndicator(score, hasData);
                  const dataPoint = dimensionDataPoint(vehicle, label, level);
                  return (
                    <li key={label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-zinc-300">{label}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-zinc-500">{dataPoint}</span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${INDICATOR_CLASSES[level]}`}
                        >
                          {INDICATOR_LEVEL_LABEL[level]}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Right column: Photo placeholder, then the sample video, same
              column width by construction (see the grid comment above) --
              space-y-4 is the same tightened gap between them from the
              earlier spacing pass. */}
          <div className="space-y-4 lg:pr-8">
            {/* Photo placeholder (originally added 2026-09-02, repositioned
                twice since -- first beside the title in its own flex row,
                now folded into this shared grid so it's genuinely the same
                size as the video below it) -- visual-only, no real
                per-vehicle photo sourcing yet (depends on a future
                stock-photo vendor decision, not yet made). Reuses the same
                illustrative body-style silhouette + "Placeholder visual"
                badge treatment BuildingVisual already uses during the quiz
                (matchmaker.tsx), extracted to vehicle-silhouette.tsx so both
                files can share it without a circular import (matchmaker.tsx
                already imports this file for VehicleDetailModal). */}
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Photo</h3>
              <div className="relative mt-2 flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]">
                <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-amber-400 uppercase">
                  Photo coming soon
                </span>
                <SilhouetteIcon vehicleType={vehicle.bodyStyle} className="h-16 w-36 text-zinc-500" />
              </div>
            </div>

            {/* Real embedded sample video (this task) -- same video for every
                vehicle, per-vehicle sourcing doesn't exist yet (see
                SAMPLE_REVIEW_VIDEO_ID above). aspect-video keeps the iframe a
                correct 16:9 regardless of column/viewport width; no autoplay
                param anywhere in the src, so it only plays on an explicit
                click. */}
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Sample review video</h3>
              <div className="mt-2 aspect-video overflow-hidden rounded-2xl border border-white/10">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${SAMPLE_REVIEW_VIDEO_ID}`}
                  title="Sample vehicle review video"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>

        {/* PROPOSED customer-facing copy, pending explicit sign-off (this
            task) -- replaces the prior proposed-but-never-confirmed line
            ("Full spec sheets and trusted review videos will show up
            here..."), which read as contradictory now that a video is
            genuinely playing above it. Distinguishes the two gaps that
            actually remain: the video shown is a real but generic sample,
            not sourced per-vehicle; spec sheets have no video-equivalent
            placeholder yet and stay a "coming soon" statement. */}
        <p className="mt-6 border-t border-white/10 pt-4 text-xs text-zinc-500">
          Shown above is a general sample video, not a review of this specific vehicle — per-vehicle
          videos aren&apos;t sourced yet. Full spec sheets will show up here once Matchmaker connects
          to live dealer inventory.
        </p>
      </div>
    </div>,
    document.body,
  );
}
