# Card indicator redesign: compact badges → always-visible full list

**Date:** 2026-09-02
**Status:** Proposal only — no code written, per instruction.

---

## Critical finding: two different kinds of "missing field," verified against source

Before designing anything, checked exactly which of the 10 raw values this needs are already flowing from `vehicles` to the client `MatchmakerVehicle` type (`grep`-ed the migration, `matchmaker-vehicles.ts`, `matchmaker-vehicle-display.ts` directly — not assumed):

**Already stored on `vehicles`, just never threaded through to the client (cheap fix — widen `SELECT_COLUMNS`/`VehicleRow`/`MatchmakerVehicle`/`mapRowToVehicle`, no migration):**
- `nhtsa_overall_stars` (Safety)
- `reliability_rating` (Reliability)
- `tech_score` (Technology & Features)
- `resale_depreciation_pct` (Resale Value)

**Not stored anywhere — needs a real schema change:**
- `bed_length_ft` (Truck's Cargo Space display). Checked the actual scored CSV directly: the raw values genuinely exist there (179/191 real Trucks populated, matching the 93.7% figure from the original Cargo-formula work) — the pipeline never dropped this column, it's sitting right there in `data/matchmaker-vehicle-dataset-2026-v19-scored-hasdata.csv`. But the import route's `transformRow()` never mapped it into an insert, and no such column exists on the `vehicles` table at all — it was only ever used internally by the Python pipeline to *compute* `cargo_score`/`cargo_has_data` for Trucks, never persisted. Displaying the real bed length requires a new nullable column + an import-route mapping addition, not just a client-type change.

This means the data layer here is two different kinds of task, not one uniform "wire up 5 fields" step — flagging this distinction explicitly rather than treating it as a single undifferentiated task.

Everything else needed (Cargo cuft for non-Truck, both Fuel Economy fields, Price, Performance, both Towing/Payload fields) is already on `MatchmakerVehicle` today. Comfort needs no new raw field at all — its data point is a level-derived phrase, not a formatted number.

---

## 1. Where the formatting logic lives

**Recommendation: extend `matchmaker-dimension-indicators.ts`, not a new module.** This file already holds the shared threshold logic (`dimensionIndicator`) and ordering logic (`personalizedDimensionOrder`) specifically *because* both the card and the modal need to read from one source without risk of drifting apart — a new per-dimension data-point formatter is the same kind of shared concern (card row text and, pending the open question below, possibly modal row text too), so it belongs in the same file rather than fragmenting closely-related "how do we display a dimension" logic across two places.

Proposed signature:

```ts
export function dimensionDataPoint(
  vehicle: MatchmakerVehicle,
  label: string,
  level: IndicatorLevel,
): string
```

Takes `level` (not `hasData` separately) because the caller already has to compute `level` for the colored indicator anyway, and `level === "gray"` is exactly equivalent to `!hasData` (both come from the same `dimensionIndicator()` call) — reusing it avoids a redundant parameter and keeps one single "is this dimension gray" check instead of two that could theoretically disagree.

Sketch of the per-dimension logic (illustrative, not final code):

- **Safety** — `${nhtsaOverallStars}-star rating`, else no-data phrase.
- **Comfort** — pure level→phrase lookup, exactly the 4 phrases you gave verbatim (including "No interior data" for gray) — no raw field involved at all.
- **Cargo Space** — branches on `vehicle.bodyStyle === "Truck"`: `${bedLengthFt} ft bed` vs. `${cargoVolumeSeatsUpCuft} cu ft`.
- **Fuel Economy** — builds an array of whichever of `${mpg} mpg combined` / `${range} mi range` are non-null, joins with `", "`. Both, either alone, or the no-data phrase if genuinely neither (shouldn't happen when `hasData` is true, but handled instead of assumed).
- **Reliability** — `${reliabilityRating.toFixed(1)}/5.0 rating`.
- **Technology & Features** — `${techScore} of 6 standard features`.
- **Price/Value** — literally calls the existing `formatPriceEstimate(vehicle.trueStartingPriceCents)` from `matchmaker-vehicle-display.ts`, not a re-derived string — you were explicit this should be the exact same value as the headline, so reusing the exact same formatter is what actually guarantees that, rather than two formatters that happen to agree today and could quietly drift.
- **Resale Value** — `${Math.round(resaleDepreciationPct)}% depreciation over 5 years`.
- **Performance** — `0-60 in ${zeroToSixtySec} sec`.
- **Towing & Payload** — same array-join pattern as Fuel Economy: whichever of `Tows up to ${towing} lbs` / `${payload} lbs payload` are non-null.

**Open decision, flagged for your sign-off: no-data phrasing for the other 9 dimensions.** You gave Comfort's gray phrase explicitly ("No interior data"), matching its own topic. The other 9 dimensions weren't given explicit no-data text. Proposing the same pattern extended to all of them (e.g. "No safety data," "No cargo data," "No fuel economy data" ...) rather than one flat generic "No data" repeated nine times — costs nothing extra and reads more polished/consistent with the one example you did specify. Flagging as a proposed default, not a certainty.

---

## 2. Interaction with the modal's existing full-9 breakdown (Step F)

**Recommendation: extend the modal to show the same data point too, for consistency — but flagging this as a real decision, not assuming it.**

Reasoning: right now the modal shows label + score number + level word, no data point. Once the card shows a full data point per row, the modal would structurally show *less* information than the card for the same dimension — backwards, since the modal is supposed to be the "more detail" surface, and it already exists specifically to be the fuller view. `dimensionDataPoint()` living in the shared module makes this a small, low-risk addition: the modal's existing row-rendering loop just needs one more call to the same function it would otherwise ignore.

If you'd rather keep the modal as-is (label + score + level only, no data point), that's a smaller, equally valid change — just flagging that "extend the modal too" is the recommended default, and either way this is Step F's second and (as far as currently scoped) final revision, not a new step outside the existing card/modal shared-logic pattern.

---

## 3. Rendering/performance at real scale (100+ cards, 5 full rows each)

**Real numbers, not a guess:** the earlier Sedan/Gas search example was 228 raw vehicles → 62 model-group cards. SUV/Gas (928 raw SUV rows in the dataset) will produce meaningfully more groups than that — likely somewhere in the 150–300 range based on the Sedan ratio, though body styles vary in how many distinct models exist. Each card goes from Step E's single row of 5 small badges to 5 full rows (label text + data-point text + colored pill each) — roughly a 3x increase in DOM nodes per card, so a few thousand additional simple `<span>`/text elements across the largest realistic list.

**Assessment: not expected to be a real problem, and not recommending virtualization preemptively.** A few thousand simple text nodes is well within what React/modern browsers handle without special-casing — this app already renders hundreds of complex cards (buttons, native `<select>`s with up to 31 options, colored badges) with no virtualization today, and nothing about 5 plain text rows changes that order of magnitude meaningfully. Recommending this be confirmed with a real-browser scroll/render check on the largest realistic list (SUV, Gas, no other filters — the actual biggest case that exists in the data) as part of verification, rather than building virtualization now against a problem that hasn't been shown to exist. If that check finds a real issue, virtualization becomes its own follow-up step, not something to build speculatively today.

---

## 4. Build sequence

- **Step H1 — Schema + data-fetch widening.** One migration adding `bed_length_ft numeric` (nullable, same reasoning as every prior nullable-column addition here — existing rows/batches have nothing to backfill from) to `vehicles`; import route's `transformRow()` gains the `bed_length_ft` mapping alongside the 4 already-existing-but-unmapped columns. `MatchmakerVehicle`/`VehicleRow`/`SELECT_COLUMNS`/`mapRowToVehicle` widened for all 5 fields together, since there's no reason to split a client-type change into two passes. **No pipeline re-run needed** — confirmed the raw `bed_length_ft` values are already sitting in the current scored CSV, so this is a straight re-import of the same file into a new batch once the schema/route changes land, not a new data-generation pass.
- **Step H2 — `dimensionDataPoint()`.** Pure function in `matchmaker-dimension-indicators.ts`, no UI yet. Verifiable against real data via a scratch route before any component touches it — same pattern as Steps B/C: Ram Chassis Cab (Cargo Space → Truck-branch, likely a no-bed-data case worth re-confirming against the new column), Audi A3 (Comfort/Cargo Space genuinely-worst-in-class-with-real-data phrasing), a Hybrid/PHEV vehicle with only one of mpg/range populated, a Truck with only towing (no payload) populated.
- **Step H3 — Card UI: replace Step E's badge row with the always-visible 5-row list in `ModelGroupCard`.** Removes the dot-badge rendering entirely (no compact/expandable toggle survives, per your instruction). Verified against the same real cases already used for Steps D/E/F (Giulia RWD/AWD, Genesis G70's 8 variants, Audi A5's 3 trims, Ram ProMaster's 31) — confirming the row list updates correctly when the trim toggle changes, same as the badge row did.
- **Step H4 — Modal extension (pending your answer to the open question in section 2).** Adds the same `dimensionDataPoint()` call to the modal's existing 9-row breakdown loop, only if you want it — otherwise skipped entirely, modal stays as-is.
- **Step H5 — Real-browser scale check.** SUV/Gas/no-filters (the largest realistic list), confirming acceptable scroll/render performance before calling this done — not a speculative virtualization build, an actual check against the actual worst case in the actual data.
- **Step H6 — Promote + deploy.** Same sequencing already burned into muscle memory at this point: new batch imported (`promote: false`) → verified against real data locally → promoted → **then** deployed, in that order, confirmed live in a real browser afterward.

---

## Summary of things needing your explicit sign-off

1. **No-data phrasing for the 9 non-Comfort dimensions** — proposing "No [topic] data" per dimension (matching Comfort's given example), not a flat generic "No data."
2. **Modal extension (Step H4)** — proposing yes, extend it to show the same data point, but this is a real open question you flagged, not a foregone conclusion.
3. Everything else above (module placement, `bed_length_ft` needing a real migration, the join-format for partial Fuel Economy/Towing pairs, the performance-check-not-virtualization stance) is a recommendation, not a blocking question — happy to proceed on it as written unless you want something adjusted.
