import { retargetPriorityOrderForVehicleType, TOWING_PAYLOAD_VEHICLE_TYPES, type VehicleType } from "./matchmaker-data";
import { formatPriceEstimate, type MatchmakerVehicle } from "./matchmaker-vehicle-display";

// Ranking-indicator (Green/Yellow/Red/Gray) logic, part of the
// results-card redesign approved 2026-09-02 (see
// data/matchmaker-duplicate-investigation-and-grouping-plan-2026-09-02.md,
// Part 3, "Step C"). Pure functions, no UI here -- consumed by both the
// compact card indicator row (top 5) and the detail modal's full
// breakdown (all 9), so ordering logic lives in exactly one place.

export type IndicatorLevel = "gold" | "green" | "yellow" | "red" | "gray";

// Thresholds (updated 2026-09-02): Gold ==100 (genuine best-in-class on
// this dimension -- real ties are expected and correctly ALL read as gold,
// since this is a pure per-vehicle-per-dimension check with no "pick a
// winner" step anywhere; confirmed against the real Mercedes-Benz S-Class
// S 500/S 580/S 580e three-way Comfort tie), Green 80-99, Yellow 60-79
// (widened from 65-79), Red 50-59 (narrowed from 50-64 -- real data,
// genuinely weak/worst-in-class -- the pipeline's scores never go below 50,
// see floor_rescale in matchmaker_scoring_pipeline.py), Gray = no
// underlying data for this dimension. `score >= 100` rather than `=== 100`
// -- behaviorally identical today since scores are capped at 100, but
// safer against any theoretical float rounding at the boundary. Gray is
// checked first and short-circuits every numeric threshold entirely -- a
// score is never used to infer "has data" on its own, since a bare 50 is
// genuinely ambiguous between "missing data" and "real data, tied for
// worst in class" (see the vehicles_has_data_flags migration's comment).
// Always pass hasData from MatchmakerVehicle.hasData, never derive it
// from the score value.
export function dimensionIndicator(score: number, hasData: boolean): IndicatorLevel {
  if (!hasData) return "gray";
  if (score >= 100) return "gold";
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

// The customer's chosen priority order (already exactly 9 labels: the 8
// shared dimensions + whichever of Resale Value / Towing & Payload was
// valid for the vehicleType active when they arranged it), reordered/
// retargeted for a SPECIFIC vehicle's own bodyStyle. This is a thin
// semantic wrapper over retargetPriorityOrderForVehicleType, which
// already does exactly this job (matchmaker-data.ts) -- swaps whichever
// of the two type-dependent labels is present for the one the given body
// style wants, preserving every other label's position, and is a no-op
// if the list already matches. Keying off the vehicle's own bodyStyle
// rather than answers.vehicleType is deliberate: every displayed vehicle
// already satisfies the vehicleType hard filter today, so the two are
// always equal in practice, but reading it off the vehicle itself doesn't
// depend on that continuing to hold true everywhere this gets called from
// (e.g. a future grouped-card toggle showing a different trim's data).
//
// Used by both the compact card (sliced to the top 5) and the full
// detail-modal breakdown (all 9) -- one shared function, so the two
// surfaces can't silently drift apart on ordering.
export function personalizedDimensionOrder(bodyStyle: VehicleType, priorities: string[]): string[] {
  return retargetPriorityOrderForVehicleType(priorities, bodyStyle);
}

// Comparison view (approved plan, 2026-09-02) -- the shared row order for
// the up-to-5-column comparison table. Deliberately NOT
// personalizedDimensionOrder() above, which retargets a full 9-item list
// PER VEHICLE (swapping in whichever of Resale Value/Towing & Payload that
// ONE vehicle's own body style wants) -- a comparison table needs ONE
// shared row order across every column, not a different one per vehicle.
//
// Returns the customer's most recent 8 shared-dimension order (whichever
// of Resale Value/Towing & Payload was present in `priorities` gets
// stripped out), followed by one fixed extra row per DISTINCT 9th-
// dimension type actually present among the flagged vehicles -- 1 row if
// every flagged vehicle shares a type (e.g. all Sedans), up to 2 if mixed
// body styles are flagged together (Sedan + Truck). Never one row per
// vehicle -- a shared table row that only applies to one column doesn't
// make sense, and cross-body-style comparison is an explicit requirement
// (approved plan, confirmed-design item 7).
//
// Extra-row order is fixed (Resale Value before Towing & Payload, matching
// ALL_PRIORITIES' own declared order in matchmaker-data.ts) rather than
// derived from flag order or vehicle order, so the table's row layout
// never reshuffles as vehicles are added to or removed from the
// comparison.
export function comparisonRowOrder(priorities: string[], flaggedVehicles: MatchmakerVehicle[]): string[] {
  const shared = priorities.filter((label) => label !== "Resale Value" && label !== "Towing & Payload");

  const ninthLabelFor = (vehicle: MatchmakerVehicle): string =>
    TOWING_PAYLOAD_VEHICLE_TYPES.includes(vehicle.bodyStyle) ? "Towing & Payload" : "Resale Value";
  const presentNinths = new Set(flaggedVehicles.map(ninthLabelFor));

  const extraRows = ["Resale Value", "Towing & Payload"].filter((label) => presentNinths.has(label));

  return [...shared, ...extraRows];
}

// Shared display constants -- moved here (2026-09-02, Step F) from being
// matchmaker.tsx-local so the compact card row and the detail modal's
// full breakdown render the exact same colors/labels/abbreviations for
// the exact same indicator level, rather than two components each
// maintaining their own copy that could quietly drift apart.
// Ring width now lives HERE per-level, not in the shared className
// template at the two render call sites (matchmaker.tsx's
// DimensionDetailList, vehicle-detail-modal.tsx's breakdown section) --
// both previously hardcoded a shared "ring-1" ahead of this map's value.
// Gold needs a visibly thicker ring-2 as one of three independent
// differentiators from Yellow (brightness + ring weight + the "star"
// glyph in its label, deliberately not relying on hue/saturation alone,
// which amber-400 vs. yellow-300 turned out to be too close together to
// trust at a glance -- see the reviewed color comparison). A single
// element can't cleanly carry two different Tailwind ring-width utilities
// at once, so every level's own full ring class (width + color) is now
// self-contained here.
export const INDICATOR_CLASSES: Record<IndicatorLevel, string> = {
  gold: "bg-yellow-500/15 text-yellow-200 ring-2 ring-yellow-400",
  green: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30",
  red: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  gray: "bg-zinc-600/15 text-zinc-500 ring-1 ring-zinc-600/30",
};

// "★ " prefixed directly onto the label string -- both render call sites
// already just interpolate this string as plain text, so the icon comes
// along for free with zero JSX changes needed at either surface.
export const INDICATOR_LEVEL_LABEL: Record<IndicatorLevel, string> = {
  gold: "★ Best in Class",
  green: "Excellent",
  yellow: "Good",
  red: "Below average",
  gray: "No data",
};

// Short, visually distinct abbreviations for the compact card row --
// matches the style reviewed in the approved plan (e.g. "Sf" Safety,
// "T&P" Towing & Payload), not auto-derived from each label, so two
// dimensions can never collide on their first couple letters (e.g.
// Comfort vs. Cargo Space). Not used by the modal's full breakdown, which
// has room for the full label.
export const DIMENSION_ABBREVIATION: Record<string, string> = {
  Safety: "Sf",
  Comfort: "Cf",
  "Cargo Space": "Cg",
  "Fuel Economy": "FE",
  Reliability: "Re",
  Performance: "Pf",
  "Technology & Features": "T&F",
  "Price/Value": "P/V",
  "Resale Value": "RV",
  "Towing & Payload": "T&P",
};

// Comfort's phrase-per-level lookup -- locked wording (approved
// 2026-09-02, see matchmaker-full-indicator-list-plan-2026-09-02.md),
// not auto-derived from the level like every other dimension's data
// point below. No raw field involved at all -- Comfort's data point is
// purely a function of which bucket the score landed in.
const COMFORT_PHRASE_BY_LEVEL: Record<IndicatorLevel, string> = {
  gold: "Best-in-class interior",
  green: "Spacious interior",
  yellow: "Average interior space",
  red: "Below average interior space",
  gray: "No interior data",
};

// "No [topic] data" per dimension when gray (approved 2026-09-02) --
// not one generic "No data" string repeated across every dimension.
// Comfort is excluded here since COMFORT_PHRASE_BY_LEVEL already covers
// its own gray case with matching wording.
const NO_DATA_PHRASE: Record<string, string> = {
  Safety: "No safety data",
  "Cargo Space": "No cargo data",
  "Fuel Economy": "No fuel economy data",
  Reliability: "No reliability data",
  "Technology & Features": "No tech data",
  "Price/Value": "No price data",
  "Resale Value": "No resale data",
  Performance: "No performance data",
  "Towing & Payload": "No towing data",
};

// The per-dimension data point shown alongside each row's colored
// indicator -- e.g. "4-star rating", "26 mpg combined", "0-60 in 5.3
// sec". Takes `level` (not hasData separately) because the caller
// already has to compute it for the colored indicator anyway, and
// level === "gray" is exactly equivalent to !hasData (both come from the
// same dimensionIndicator() call) -- reusing it keeps one single "is
// this gray" check instead of two that could disagree. Used by both the
// always-visible card row list and the modal's full breakdown (both
// approved 2026-09-02) -- one shared function, same reasoning as
// dimensionIndicator/personalizedDimensionOrder above.
export function dimensionDataPoint(
  vehicle: MatchmakerVehicle,
  label: string,
  level: IndicatorLevel,
): string {
  if (label === "Comfort") {
    return COMFORT_PHRASE_BY_LEVEL[level];
  }
  if (level === "gray") {
    return NO_DATA_PHRASE[label] ?? "No data";
  }

  switch (label) {
    case "Safety":
      return `${vehicle.nhtsaOverallStars}-star rating`;
    case "Cargo Space":
      // Truck's Cargo Space is scored off bed_length_ft, not
      // cargo_volume_seats_up_cuft (see matchmaker_scoring_pipeline.py's
      // CARGO_BED_LENGTH_BODY_STYLES) -- the data point mirrors that
      // same body-style branch, not a coincidence.
      return vehicle.bodyStyle === "Truck"
        ? `${vehicle.bedLengthFt} ft bed`
        : `${vehicle.cargoVolumeSeatsUpCuft} cu ft`;
    case "Fuel Economy": {
      // Real data confirmed (2026-09-02): Gas vehicles have both mpg and
      // range populated together 81% of the time, but Hybrid (50%), PHEV
      // (25%), and Diesel (4%) frequently have only one -- never assume
      // both are present.
      const parts: string[] = [];
      if (vehicle.epaCombinedMpg !== null) parts.push(`${Math.round(vehicle.epaCombinedMpg)} mpg combined`);
      if (vehicle.rangeMi !== null) parts.push(`${Math.round(vehicle.rangeMi)} mi range`);
      return parts.length > 0 ? parts.join(", ") : NO_DATA_PHRASE["Fuel Economy"];
    }
    case "Reliability":
      return `${(vehicle.reliabilityRating ?? 0).toFixed(1)}/5.0 rating`;
    case "Technology & Features":
      // tech_score is already a 0-6 count of standard features, not a
      // 0-100 score -- distinct from technology_&_features_score, which
      // is the separately-computed 50-100 dimension score.
      return `${vehicle.techScore} of 6 standard features`;
    case "Price/Value":
      // Deliberately reuses the exact same formatter the card's own
      // headline price already calls, rather than a second formatter
      // that happens to agree today and could quietly drift later.
      return formatPriceEstimate(vehicle.trueStartingPriceCents);
    case "Resale Value":
      return `${Math.round(vehicle.resaleDepreciationPct ?? 0)}% depreciation over 5 years`;
    case "Performance":
      return `0-60 in ${vehicle.zeroToSixtySec} sec`;
    case "Towing & Payload": {
      // Real data confirmed (2026-09-02): "towing only, no payload" is
      // the dominant real case (549 of ~785 vehicles with any data at
      // all) -- never assume both are present.
      const parts: string[] = [];
      if (vehicle.towingCapacityLbs !== null) {
        parts.push(`Tows up to ${vehicle.towingCapacityLbs.toLocaleString()} lbs`);
      }
      if (vehicle.payloadCapacityLbs !== null) {
        parts.push(`${vehicle.payloadCapacityLbs.toLocaleString()} lbs payload`);
      }
      return parts.length > 0 ? parts.join(", ") : NO_DATA_PHRASE["Towing & Payload"];
    }
    default:
      return "";
  }
}
