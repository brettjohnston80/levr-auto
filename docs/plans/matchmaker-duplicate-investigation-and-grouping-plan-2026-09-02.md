# Duplicate investigation + Model-grouping/Ranking-indicators joint plan

**Date:** 2026-09-02
**Status:** Part 1 is a completed investigation (no fix applied). Parts 2/3 are a design proposal — **no code has been written for either**, per instruction. Everything below is for review.

---

## PART 1 — Investigation: "Audi A5 Prestige" appearing twice

### What was checked

Confirmed first, directly against the live promoted batch (`e0f184c3-dfa3-40a6-be6d-ad5385759427`): exactly **one** Audi A5 Prestige row exists (Sedan, AWD, Gas, $57,995) — matches what you found in the raw CSV.

Then ran four separate checks, via a scratch route (deleted after use, confirmed via grep — `api/internal/` contains only `sync-listings` and `import-vehicle-dataset`):

1. **`fetchLayerStabilityRuns` — ran `getVehiclesForBatch()` three separate times back to back.** Total row count came back 1,601 every time, **zero duplicate ids in any run.** This was the leading suspect going in: `getVehiclesForBatch()` paginates via `.range()` with **no `.order()` clause anywhere in the query** (confirmed via grep of `matchmaker-vehicles.ts`), and the live batch has 1,601 rows — past the 1,000-row page size, so it always issues two separate requests. Postgres/PostgREST does not guarantee stable row ordering across two independent `OFFSET/LIMIT`-style requests without an explicit sort key — in principle a row could land in both pages. It didn't reproduce here, but see "Residual risk" below — this is a real latent issue independent of whether it explains your report.

2. **`primaryAlternativesOverlapChecks` — ran the real Sedan hard-filter + score + `segmentByPowertrain` pipeline for all 5 powertrain-preference states** (none, Gas, Diesel, Hybrid, Electric). Zero overlap between `primary` and `alternatives` in any case, and zero internal duplicates within `alternatives` itself. This makes sense reading the code — `segmentByPowertrain` (`matchmaker-scoring.ts`) is a strict `if/else` per vehicle (`powertrain === preferred ? primary : rest`), and every `Powertrain` value appears in exactly one tier of `ALTERNATIVE_TIERS[preferred]` for any given preference — structurally, a vehicle cannot land in two places.

3. **`allBatchesDuplicateContentReport` — checked all 3 batches that have ever existed** (the current live one plus the two prior promoted batches) for actual duplicate content rows (same make/model/trim/body_style/drivetrain/fuel_type repeated within one batch — which would mean an import-time bug, e.g. a bad CSV or a re-run that appended instead of replacing). **Zero duplicate content groups in any of the 3 batches.**

4. **Confirmed the "not a bug" pairs.** Alfa Romeo Giulia Base: two real rows, AWD $50,245 and RWD $48,245. Genesis G70: 8 real rows across 4 trim levels × 2 drivetrains each (2.5T, 2.5T Prestige, 3.3T Prestige Graphite, 3.3T Sport Prestige — all AWD/RWD pairs). Confirmed directly against the `vehicles` table — these are genuinely distinct real vehicles differing on `drivetrain`, exactly as you said. The table's own unique constraint (`unique (dataset_batch_id, make, model, trim, model_year, body_style, drivetrain, fuel_type)`) already encodes this — `drivetrain` is part of what makes a row unique, confirmed via the schema, not just observed behavior.

### Conclusion

**Could not reproduce a genuine duplicate-rendering bug** under any combination tested — not in the fetch layer, not in powertrain segmentation, not in any batch's raw content. The powertrain segmentation logic in particular is structurally incapable of double-placing a vehicle (strict if/else, one tier per powertrain).

**Residual risk worth flagging regardless:** `getVehiclesForBatch()`'s missing `.order()` clause is a real SQL anti-pattern (`OFFSET/LIMIT` without a stable sort key has technically undefined row order across separate requests) even though it didn't reproduce a duplicate in this test. It's cheap, safe insurance to add `.order("id")` (or any indexed column) to that query regardless of this investigation's outcome — happy to do this as a one-line fix if you'd like, separately from this report, since it's not related to Parts 2/3.

**If this happens again:** the most useful thing to capture is the exact answers state (vehicle type, powertrain preference, price range, priorities order) at the moment it's seen, plus whether it was a fresh page load or after editing an answer live in the AnswerPanel — none of the three hypotheses I could test explain it, so a fresh repro with exact state would let me test something more targeted.

---

## PART 2 & 3 — Joint plan: model grouping + ranking indicators

### Blocker to flag before anything else

**The pipeline attachment referenced in Part 3 didn't actually land.** `data/matchmaker_scoring_pipeline.py` on disk has no `<Dimension> Has Data` output columns anywhere — I grepped for `Has Data`/`has_data` and the only hit is an unrelated local variable inside `score_safety()`, not an exported column. The Downloads folder also shows no new/updated pipeline file (same timestamp as what's already in the repo). This is the same "attachment referenced but didn't transmit" pattern that's come up a few times before in this project — the reliable fix has been pasting the file content directly into chat.

**This doesn't block writing the plan below** (the schema/naming/population design is derivable from the existing score-column convention), but I want to flag it now rather than silently design around content I haven't actually seen — the exact column-name proposal below (`safety_has_data`, etc.) is my proposal based on this project's existing naming pattern, not something confirmed against real pipeline output yet.

---

### 1. Data shape for grouping-by-model

**Recommendation: application-code grouping, not query-time (SQL `GROUP BY`).**

A SQL-level `GROUP BY` would collapse rows, losing exactly the per-trim data the toggle needs (each trim's own price, its own scores, its own rationale). And the thing that determines the "headline" trim — the customer's live priority order — only exists in the browser, changes on every drag, and can't be pushed back into a query without a round trip on every reorder. So grouping has to happen in application code, after scoring, same place `segmentByPowertrain` already operates.

**Concretely:** a new pure function, `groupByModel(matched: MatchedVehicle[]): ModelGroup[]`, added to `matchmaker-scoring.ts` (or a new sibling file if you'd rather keep it separate — no strong preference), where:

```ts
export type ModelGroup = {
  key: string;               // `${make}|${model}` -- stable identity for dismiss/flag, see below
  make: string;
  model: string;
  headline: MatchedVehicle;  // highest-scoring trim in this group, drives list position
  variants: MatchedVehicle[]; // every trim in the group, headline included, in score order
};
```

Input is always an **already-sorted** array (exactly what `getMatchedVehicles` already produces). This makes the implementation a single-pass grouping with a nice property: since the input is pre-sorted descending by `totalScore`, the **first** vehicle encountered for any `make|model` key is automatically the headline — no separate max-finding pass needed, and the natural iteration order of the resulting groups (first-seen order) is already the correct headline-score-descending order for the group list too. No secondary sort required.

**Grouping key: `${make}|${model}`, not `model` alone.** Checked directly against the real 1,601-row dataset — **zero model names are currently shared across different makes**, so grouping on the literal `model` field alone happens to be safe today. But keying on `make + model` costs nothing and removes a latent risk if a future data pass ever introduces a name collision (e.g., two different makes both using a generic trim/model word) — recommending the safer key as a one-line difference from what was literally asked, flagging it explicitly rather than silently deciding.

**Where this slots into the existing pipeline:** `getMatchedVehicles()` → `segmentByPowertrain()` → **`groupByModel()`, run separately on `segmented.primary` and on each `alternatives[i].vehicles`** — not once on the whole matched list before segmentation. See point 5 below for why.

---

### 2. Schema for Part 3 (10 boolean columns)

Proposed columns on `vehicles`, mirroring the existing `*_score` naming exactly:

```sql
alter table public.vehicles
  add column safety_has_data boolean,
  add column comfort_has_data boolean,
  add column cargo_has_data boolean,
  add column fuel_economy_has_data boolean,
  add column reliability_has_data boolean,
  add column tech_features_has_data boolean,
  add column price_value_has_data boolean,
  add column resale_value_has_data boolean,
  add column performance_has_data boolean,
  add column towing_payload_has_data boolean;
```

**Nullable**, same reasoning as `towing_payload_score`'s migration comment — existing rows in already-promoted batches predate this column and have no value to backfill from. A new import (once the real pipeline lands) would populate all 10 for every row it inserts; older, already-promoted batches simply have `null` here until superseded by a new import, which is fine since nothing reads old batches live.

**Import route (`import-vehicle-dataset/route.ts`):** ten new lines in `transformRow()`, following the exact pattern already used for `is_performance_trim`/`has_third_row` (`toBool(row["..."])`, which already handles a `"yes"/"no"` string convention). Exact CSV header names depend on what the real pipeline actually emits once I see it — I'd guess `"Safety Has Data"` etc., paralleling `"Safety Score"`, but this needs confirming against the real file rather than guessed twice in a row.

**Frontend type (`MatchmakerVehicle` in `matchmaker-vehicle-display.ts`):** a new `hasData: Record<string, boolean>` map, built the same way `scores: Record<string, number>` already is — iterate `SCORE_COLUMN_TO_LABEL`, look up the paired `_has_data` column for each. This keeps the "don't infer has-data from the score value" rule structurally enforced: the indicator helper (point 3 below) takes `hasData` as a required, separate argument, never derives it from `score === 50`.

---

### 3 & 4. Card UI (toggle) and detail modal, and how they stay in sync

**Card layout change:** the `<h3>` heading changes from `{make} {model} {trim}` to just `{make} {model}` — trim moves into a toggle control below the heading, since trim is now a selectable, changeable thing within the card rather than fixed.

**Toggle mechanics — recommend a native `<select>`, not a pill row.** Checked the real data for the actual range this needs to handle: **308 distinct `(make, model)` groups**, trim-count distribution median 4, but a real tail — Ram ProMaster has **31** distinct trims in one group, 23 groups have more than 10 rows, 6 have more than 15. A pill row (like `PriorityRanker` or `CompactSelectField` use elsewhere in this codebase) reads fine at 2-6 options but gets unwieldy fast past that, and would need special-case wrapping/scrolling logic for the ProMaster case specifically. A native `<select>` scales cleanly from 2 to 31 with zero special-casing, and gets keyboard/accessibility behavior for free — recommending it purely for that range, not because pill styling would look wrong at small counts.

**Toggle option labels always show trim + drivetrain**, e.g. `"Prestige — AWD — $57,995 est."`, not conditionally only when a trim name repeats. Checked: **38 of 308 groups have at least one repeated trim label** (this is exactly the Giulia/G70 case) — where drivetrain is the only thing that disambiguates two otherwise-identical-looking options. Always showing it is one consistent code path instead of a conditional "only show drivetrain if trim name collides within this group" check, and it directly addresses the root complaint (indistinguishable cards) even for a customer who wouldn't otherwise know two trims share a name.

**State:** the active trim within a group is local `useState` inside a new grouped-card component (e.g. `ModelGroupCard`), initialized to `group.headline`, changed only by the toggle — **does not affect the group's position in the results list**, which is fixed by `group.headline.totalScore` at the `ResultsList`/`Matchmaker` level regardless of what's toggled inside any card. This directly satisfies your point 4.

**Dismiss/flag — proposing these apply to the whole group, not the currently-toggled trim.** Not explicitly specified in the ask, so flagging as a decision rather than assuming silently: today, `dismiss(id)`/`toggleFlag(id)` key off a single vehicle row's id. Once a card represents a *model*, "Not interested" reads most naturally as "I don't want to see any A5 trim again," not "hide Prestige specifically but keep showing Premium." Recommending `dismissed`/`flagged` be keyed by the group's `key` (`make|model`) instead of a row id — this is a real behavior change from today's per-row semantics, called out explicitly for your sign-off rather than folded in silently.

**Detail modal sync (the actual joint-design point):** `VehicleDetailModal` currently receives a single `vehicle: MatchmakerVehicle` prop from `Matchmaker`'s `infoVehicleId`/`infoVehicle` state, which looks it up from the flat `matched` array by id. Once cards are grouped, "More info" needs to open the modal for **whichever trim is currently active in that specific card**, not always the group's headline. Concretely: `ModelGroupCard` holds the active-trim state locally, and its "More info" button calls `onOpenInfo(activeTrim.id)` (the currently toggled trim's own id) rather than `onOpenInfo(group.headline.id)`. Since `infoVehicle` is already looked up by id from the flat `matched` list (unaffected by grouping — grouping is a display-layer concern, the underlying scored/matched array of individual rows is untouched), this requires no change to how the modal itself resolves its vehicle — only the id passed to it needs to reflect the card's current toggle state, and toggling the select mid-view naturally updates which id `onOpenInfo` would send if clicked again. **The G/Y/R breakdown inside the modal (point 3 below) is computed from whatever `vehicle` the modal receives, so it automatically reflects the active trim with no separate wiring** — this is the "designed together" part: the modal doesn't need to know about grouping at all, it just needs to keep receiving whichever single vehicle row is currently "in view," which the card is already responsible for tracking.

**Compact card-level indicator (point 4 of your ask — visual approach at list scale):** given lists can run into the hundreds of cards, recommending a small horizontal row of **5 colored dot badges** (one per the customer's top 5 ranked priorities, in their actual chosen order) placed under the existing rationale sentence — not a sentence per dimension, not a bar chart. Each dot: a small circle, colored per the Green/Yellow/Red/Gray rule, with the dimension's first letter or a short 2-3 letter abbreviation inside it (e.g. "Sf" Safety, "Cg" Cargo Space, "T&P" Towing & Payload), and a native `title` attribute tooltip with the full dimension name + numeric score for anyone who wants the detail without opening the modal. This reuses the same lightweight-badge visual language `VehicleCard` already uses for the bodyStyle/fuelType pills, just smaller and color-coded, rather than introducing a new visual pattern. This row updates automatically when the trim toggle changes, since it's driven by whatever the currently-active-trim's `scores`/`hasData` maps say.

**Detail modal full breakdown (point 3 of Part 3):** a new section directly after the existing "Why this fits you" bullets (not replacing them), header e.g. "How it scores on what matters to you," listing all 9 valid dimensions for **the vehicle's own `bodyStyle`** (not `answers.vehicleType` — functionally identical today since vehicleType is a hard filter and every displayed vehicle already matches it, but keying off the vehicle's own field is more robust and doesn't assume the answers object is fully populated), in the customer's personalized rank order (`answers.priorities`, filtered down to the 9 valid for this body style). Each row: dimension label, a colored indicator (same 4-state logic as the card, but can afford a full word — "Excellent"/"Good"/"Below average"/"No data" — rather than just a dot, since modal space is more generous), and the raw score number for anyone who wants it.

**Shared logic, one new small module** (e.g. `matchmaker-dimension-indicators.ts`):

```ts
export type IndicatorLevel = "green" | "yellow" | "red" | "gray";

export function dimensionIndicator(score: number, hasData: boolean): IndicatorLevel {
  if (!hasData) return "gray";
  if (score >= 80) return "green";
  if (score >= 65) return "yellow";
  return "red"; // 50-64
}

// Valid dimension labels for a body style, in a FIXED canonical order --
// personalization (reordering to the customer's actual priority order) is
// the caller's job, this just resolves the Resale Value / Towing & Payload
// swap per body style, reusing TOWING_PAYLOAD_VEHICLE_TYPES.
export function visibleDimensionLabels(bodyStyle: VehicleType): string[] { ... }

// Sorts a body style's valid labels into the customer's chosen order --
// used by both the card (sliced to top 5) and the modal (all 9).
export function personalizedDimensionOrder(bodyStyle: VehicleType, priorities: string[]): string[] { ... }
```

Both the card's top-5 row and the modal's full-9 section call the same `personalizedDimensionOrder`, just slicing differently (`.slice(0, 5)` vs. the full list) — one source of truth for "what order do dimensions show in," so the two surfaces can never silently drift apart.

---

### 5. Powertrain segmentation interaction

**Recommendation: group *within* each powertrain bucket separately, not across all of them.**

Checked against real data: **66 of 308 model groups span more than one `fuel_type`** (e.g. Hyundai Tucson SE exists as Gas, Hybrid, and PHEV — 3 fuel types in one model). If grouping happened *before* powertrain segmentation (one Tucson group spanning all 3 powertrains), the toggle inside that single card would need to expose a *different powertrain* as one of its options — which conflicts with what "Other powertrains worth a look" is for. That section exists specifically to show *the single best alternative-powertrain vehicle*, clearly labeled and separated from the customer's stated preference; folding a Hybrid Tucson trim into the same toggle as a Gas Tucson trim would blur that distinction and make the alternative-powertrain section potentially redundant for any model that happens to span powertrains, while still being needed for every other model — an inconsistent customer experience depending on which model they're looking at.

Instead: keep today's `segmentByPowertrain()` step exactly as-is (it already correctly buckets by powertrain first), then run `groupByModel()` **independently on `segmented.primary` and on each `alternatives[i].vehicles` array**. Concretely: if a customer prefers Gas, the Tucson's Gas trim(s) group together and could appear as a headline card in the primary Gas section; the Tucson's Hybrid/PHEV trims group together *separately* and could independently be the best entry under "Best hybrid option." **This can mean the same model (Tucson) legitimately appears as two separate cards** — one under primary Gas, one under "Best hybrid option" — but that's not a new "duplicate" problem, it's the same already-accepted behavior this app has today at the row level (a Gas F-150 in primary and an EV F-150 Lightning under "Best electric option" today are two different, clearly-labeled cards), just now happening at the model level instead of the row level. Each section's own header already makes the distinction clear.

This also means `visibleAlternatives`' existing "show only the single best vehicle per alternative group" logic in `matchmaker.tsx` becomes "show only the single best **model group's headline** per alternative powertrain" — same shape, just operating on `ModelGroup[]` instead of `MatchedVehicle[]` after this change.

---

### 6. Build sequence

Same reviewable/revertable-step pattern as every prior build in this project. Steps A and B can happen in either order relative to each other (independent), but both need to land before D/E/F, and A specifically is blocked on actually seeing the real pipeline output.

- **Step A — schema + import (blocked on the real pipeline file).** Migration adding the 10 `*_has_data` columns; `transformRow()` updated once real CSV header names are confirmed. Reviewable/revertable independently of everything else — pure schema + import-route change, no frontend impact until a new batch is actually imported and promoted.
- **Step B — `groupByModel()` (data layer only, no UI change).** New pure function + `ModelGroup` type in `matchmaker-scoring.ts`. Verifiable against real data via a scratch route before any component touches it — confirm Giulia/G70/Audi A5 group correctly, confirm Ram ProMaster's 31 rows land in one group with the right headline, confirm the powertrain-segmented grouping behavior from point 5 (Tucson-style multi-powertrain models producing two separate group appearances). Fully revertable on its own — nothing calls this function yet.
- **Step C — `dimensionIndicator()` / `personalizedDimensionOrder()` (data layer only, no UI change).** New small module, point 4 above. The threshold logic (green/yellow/red) can be written and reviewed against synthetic score/hasData values immediately; full correctness against *real* `hasData` values depends on Step A's real data existing, but the module itself doesn't depend on Step A to be written or code-reviewed.
- **Step D — grouped card UI, no G/Y/R yet.** `VehicleCard` → `ModelGroupCard`: heading change, trim `<select>` toggle, local active-trim state, dismiss/flag re-keyed to `group.key` (pending your sign-off on that specific behavior change from point 3/4 above), "More info" wired to the active trim's id. `ResultsList`/`Matchmaker` updated to map over `ModelGroup[]` instead of `MatchedVehicle[]`. Isolates the grouping/toggle mechanics as one revertable unit, verified against the Giulia/G70/Audi A5 cases and the ProMaster worst case in a real browser before moving on.
- **Step E — compact card-level indicator row.** Adds the 5-dot row to `ModelGroupCard`, wired to the active trim (updates live when the toggle changes). Depends on C (for the logic) and D (for a place to put it) and effectively A (for real, non-synthetic `hasData` — though it can be built/reviewed against a temporarily-hardcoded `hasData: true` fallback if Step A's real pipeline data isn't ready yet, flagged as temporary).
- **Step F — full modal breakdown + toggle sync verification.** New section in `VehicleDetailModal`, plus the specific verification that opening "More info" on a non-headline toggled trim shows *that trim's* breakdown, not the headline's — the actual joint-design behavior this whole plan exists to get right.
- **Step G — end-to-end verification.** Real browser pass: Giulia/G70/Audi A5 cards show correct headline + toggle; ProMaster's 31-option select works and stays performant; G/Y/R thresholds spot-checked against known real score values (reusing values already verified in the Truck bed-length work, e.g. a truck at exactly 50 for a no-bed-data case should show Gray via `towing_payload_has_data`, not Red); dismiss/flag confirmed group-scoped; the "Other powertrains worth a look" Tucson-style dual-appearance case confirmed intentional-looking, not confusing, in the actual rendered UI.

**Everything from Step B onward can be built and reviewed with synthetic/placeholder `hasData` values if you'd rather not wait on the real pipeline file before starting** — flagging that as an option in case you want to unblock B–D now and slot in real Step A data later, rather than sequencing strictly A-then-everything-else. Your call.

---

## Summary of things needing your explicit sign-off (not just FYI)

1. **Dismiss/flag scope** — proposing group-level (`make|model`), not per-trim. This is a real behavior change from today.
2. **Grouping key** — proposing `make + model`, not literal `model` alone (no real collision exists today, but it's the safer key).
3. **Toggle UI** — proposing a native `<select>` over a pill row, based on the real 2-to-31 trim-count range.
4. **Powertrain/grouping interaction** — proposing grouping happens *within* each powertrain bucket separately (point 5), meaning a multi-powertrain model can legitimately show as two separate cards under different section headers.
5. **The pipeline attachment for the Has Data booleans still hasn't actually landed** — needed before Step A can be finalized (exact CSV header names) or before Step A/E can run against real (non-synthetic) data.
