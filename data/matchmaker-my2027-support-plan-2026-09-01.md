# Matchmaker: MY2027 Support — Investigation + Proposed Plan (2026-09-01)

Investigation only was requested first, then a plan for review — same pattern as every other multi-step Matchmaker build. No code has been written.

## Part 0 — Does 2027 data exist in a promoted batch yet?

**No.** Confirmed by reading `getLiveVehicles()`/`getVehiclesForBatch()` (`src/lib/matchmaker-vehicles.ts`) and checking git history for any import/promotion since the last batch (`2194835`, "Part 2: Towing & Payload pipeline, v19 re-score, new batch imported" — unrelated to 2027). No `data/` file or committed CSV contains 2027 rows. Three untracked `.numbers` files exist in the repo root (`LEVR_Auto_Matchmaker_2027_Vehicle_Dataset_Simplified.numbers`, `LEVR_Matchmaker_Column_Checklist.numbers`, `matchmaker-vehicle-dataset-2026-v2.numbers`) — these look like the real source of the eventual 2027 import (consistent with the earlier flagged note that a Numbers checklist "plausibly connects to the Roadmap doc's own real-inventory-backed Matchmaker prerequisite"), but their contents aren't visible to this assistant and nothing has been imported from them yet.

**This plan is written against the current 2026-only data, designed to work correctly for both cases** (a model with only a 2026 entry, and a model with both 2026 and 2027 entries) from day one — per your instruction, since assuming universal 2027 coverage would be wrong today and might stay wrong for some models even after the next import.

## Part 1 investigation — how `model_year` already flows through the app

**Good news: no schema or query change needed anywhere.** `model_year` is already a real, non-nullable column (`vehicles.model_year smallint not null`, confirmed in the `vehicles_dataset` migration), already selected by `matchmaker-vehicles.ts`'s `SELECT_COLUMNS`, and already present on every `MatchmakerVehicle` object as `modelYear` (`matchmaker-vehicle-display.ts`). This is purely a component-logic change in `matchmaker-scoring.ts` and `matchmaker.tsx`.

**`groupByModel`'s key is the one thing that actually needs to change.** Today:
```ts
const key = `${vehicle.make}|${vehicle.model}`;
```
This is why a hypothetical 2026 Civic and 2027 Civic would currently collapse into ONE `ModelGroup` — the higher-scoring one would silently "win" as headline, and the other year's trims would just look like extra variants in the same switcher, indistinguishable from a same-year trim. Fixing the key to `${vehicle.make}|${vehicle.model}|${vehicle.modelYear}` fixes this at the source: `ModelGroupCard`'s existing trim switcher (which only ever iterates `group.variants`) automatically becomes year-scoped for free, with zero changes needed to `ModelGroupCard` itself, since every vehicle landing in one group necessarily now shares the same make+model+year.

**`ModelGroup` gains a stored `modelYear: number` field**, same reasoning the type's own comment already gives for storing `make`/`model` directly rather than parsing them back out of `key`: "a later comparison view can resolve 'which model is this' without any fragile string-splitting." This is what lets `VehiclePickerFlow`'s new model-year step and `ComparisonModal`'s duplicate shortcuts (Parts 2/3 below) read a group's year without ever touching the key string.

**A real, non-obvious consequence this surfaced, not explicitly asked for but structurally required: `getAllVariantsForModel` needs a `model_year` parameter too, or Part 1's own "no intermixing" principle breaks one level down.** Today `getAllVariantsForModel(vehicles, make, model)` filters on make+model only — it's what feeds *two* things beyond `ModelGroupCard`:
- `ComparisonModal`'s own per-column trim switcher (this session's earlier "+ Add vehicle" trim-switcher fix)
- `VehiclePickerFlow`'s trim auto-selection (this session's earlier Trim-step-removal work)

Once a 2027 Civic exists, a flagged/added 2026 Civic column's own trim switcher would show 2026 *and* 2027 trims mixed in one flat list — the exact intermixing problem Part 1 is about, just one component over. **Proposing `getAllVariantsForModel(vehicles, make, model, modelYear)` — `modelYear` becomes a required 4th argument, not optional**, so there's no code path left that can accidentally forget to scope it. Three existing call sites need updating to pass it:
1. `ComparisonModal`'s `columns` computation — resolves the year from the already-found `originVehicle.modelYear` (no new state needed; `FlaggedGroup` doesn't need a `modelYear` field of its own, since the origin vehicle it already resolves via `trimId` is always the single source of truth).
2. `VehiclePickerFlow`'s single-year auto-select path (Part 2 below).
3. `VehiclePickerFlow`'s two-column year-pick auto-select path (Part 2 below).

**`getModelsForMakeAndBodyStyle` needs NO change.** It lists distinct model *names* for the Model step (e.g. "Civic" once, not "Civic 2026"/"Civic 2027" as two rows) — year disambiguation only happens after a model is picked, which is exactly Part 2's new step. Confirmed by re-reading it: it already dedupes on `v.model` alone, unaffected by however many years a given model spans.

**New function needed:** `getModelYearsForMakeAndModel(vehicles, make, model): number[]` — distinct years for a make+model, ascending, same "plain option list, alphabetical/numeric, not scored" convention `getMakesForBodyStyle`/`getModelsForMakeAndBodyStyle` already use. This is what `VehiclePickerFlow` checks right after a Model pick to decide whether to show the new year-choice screen or skip it.

## Part 2 investigation — where the two-column year picker fits in `VehiclePickerFlow`

`model` state was removed from `VehiclePickerFlow` earlier this session (once auto-select made a stored "current model" unnecessary after the Trim step was removed). **It needs to come back** — the new `modelYear` step needs to know which model it's disambiguating.

Proposed flow, `pickModel(value)`:
```ts
function pickModel(value: string) {
  setModel(value);
  const years = getModelYearsForMakeAndModel(vehicles, make, value);
  if (years.length <= 1) {
    // Only one year exists -- skip the new step entirely, exactly like
    // today's behavior. `years[0]` is always defined: the Model step only
    // ever lists models with >=1 real vehicle.
    const variants = getAllVariantsForModel(vehicles, make, value, years[0]);
    onSelect(pickHighestScoringVariant(variants, defaultPriorityOrder(bodyStyle)));
    return;
  }
  setStep("modelYear");
}

function pickModelYear(year: number) {
  const variants = getAllVariantsForModel(vehicles, make, model, year);
  onSelect(pickHighestScoringVariant(variants, defaultPriorityOrder(bodyStyle)));
}
```
`PickerStep` gains `"modelYear"`; `back()` gains a `modelYear -> model` case; `stepTitle` gains an entry (proposing "Which model year?").

**Visual design, proposed, not locked:** two side-by-side cards (2026 left / 2027 right — matching your literal spec), each just a clickable year heading — no trim list, no price range, nothing more than the task asked for. Reusing this codebase's existing two-card side-by-side pattern (`FinalizeChoice`/`SwitchChoice`'s "two choices, click one" layout) rather than inventing new visual language, collapsing to stacked on mobile the same way those do. Open question for you: is a bare year label enough, or would a one-line hint under it (e.g. trim count, or price range) help the customer choose? Task said "just a single 'pick this year' choice," so I'm defaulting to bare — flagging in case you want more.

**Generalized to N years, not hardcoded to exactly 2** — the task's literal spec is "2026 on left, 2027 on right," but `getModelYearsForMakeAndModel` naturally returns however many years exist, and rendering `years.map(...)` as a row of cards costs nothing extra now versus hardcoding two slots. If a 3rd year ever lands, this keeps working with no revisit; if you'd rather I hard-cap at 2 and treat a 3rd year as a "shouldn't happen yet" case, say so and I'll simplify.

## Part 3 investigation — quick-duplicate shortcuts under "+ Add Vehicle"

**No new state-management function needed.** The duplicate-collision fix already shipped this session (`addFlaggedGroup`/`addVehicleToComparison`, both merged in `bf09eab`) already handles "add this exact vehicle again, even if an identical make/model/year is already in the comparison, with a guaranteed-unique flagKey." A quick-duplicate shortcut just needs to resolve the right `MatchmakerVehicle` and call the existing `addVehicleToComparison(vehicle)` — no new add path.

Resolution: for a given column, `getAllVariantsForModel(vehicles, column.make, column.model, column.activeVehicle.modelYear)` then `pickHighestScoringVariant(...)` — using `column.activeVehicle.modelYear` is safe and unambiguous once Part 1 lands, since every variant in a column's own switcher will already share one year by construction. This deliberately re-runs auto-select rather than literally cloning whichever trim the original column currently shows, per your spec ("Auto-select applies the same as any other add").

**Placement, proposed:** inside the same `<th>` cell as the "+ Add vehicle" tile (which is already a small fixed-width column from this session's tile-resize work), a short stacked list of compact buttons below it — one per current column, each showing the make/model (and year, once >1 year is possible) truncated to fit the ~140px column, capped by `columns.length < FLAG_CAP` the same way the Add tile itself already is (once at cap, neither the tile nor the duplicate shortcuts render — consistent, no separate cap logic needed). Flagging this as the rough shape rather than a locked design, since a narrow 140px column stacking up to 4 duplicate buttons plus the Add tile could get visually tall/cramped — happy to adjust (icons instead of text, a "Duplicate ▾" dropdown instead of a stacked list, etc.) once you've seen it.

## Build sequence (stop for review after each, same convention as before)

- **Step 1 — data layer.** `groupByModel` keyed on make+model+year, `ModelGroup.modelYear`, new `getModelYearsForMakeAndModel`, `getAllVariantsForModel` gains a required `modelYear` param with all 3 existing callers updated. **Fully verifiable today against the current 2026-only data with zero new data needed** — every model has exactly one year today, so the new key produces identical grouping to the old one and the new required param is always trivially satisfiable; this step is a real regression-proof pass, not a no-op deferred to later.
- **Step 2 — `VehiclePickerFlow`'s two-column year picker.** With today's 2026-only data this path is structurally always skipped (confirms the "skip entirely" branch still matches current behavior exactly). Actually seeing the two-column screen render needs either real 2027 data or a temporary synthetic test — see the open question below.
- **Step 3 — quick-duplicate shortcuts under "+ Add Vehicle."** Fully testable today, independent of whether any model has 2 years yet.
- **Step 4 — end-to-end verification pass** covering all three, plus a real click-through of the year-picker screen specifically.

**Open question for you: how should Step 2/4's actual two-column screen get verified before real 2027 data lands?** Two options, not deciding without you:
- (a) I temporarily insert a synthetic duplicate-year test row into a **non-live** batch via a scratch route (same "build a scratch route, verify, delete it, clean up test data" pattern already used throughout this project), confirm the screen renders/behaves correctly, then remove the test row — never touches the live batch customers see.
- (b) Defer visual verification of that one screen until a real 2027 batch is promoted, and ship Steps 1/3/4-minus-the-year-screen now; I re-verify the year-picker specifically once real data exists.

## Housekeeping — both addressed, not deferred

**Branch cleanup: done.** `levr/matchmaker-dataset` was confirmed fully merged into `main` (via PR #1, `3d12dc7`) before deleting. Deleted the local branch; the remote branch turned out to already be gone on GitHub (likely auto-deleted after the PR merged) — `git fetch --prune` confirmed no stale ref remains either.

**Doors/seating_capacity defensive-handling question — answered, no code needed.** Grepped every frontend reference to both fields:
- **`doors` is dead on the frontend today** — written at import time (`import-vehicle-dataset/route.ts`) and stored on the `vehicles` table, but never selected by `matchmaker-vehicles.ts`'s query, never present on the `MatchmakerVehicle` type, and never read anywhere in `src/`. A `doors` inconsistency by itself has zero frontend impact right now.
- **`seating_capacity` is genuinely load-bearing, and nothing validates it.** It drives a real hard filter (`passesHardFilters` in `matchmaker-scoring.ts` — a vehicle whose `seating_capacity` is below the customer's minimum-riders answer is excluded from results entirely) and a customer-facing "why this fits you" bullet (`vehicle-detail-modal.tsx`: "Seating sized right for your group"). Neither cross-checks against `doors`, trim name text, or anything else — the frontend fully trusts whatever the data says. So the Tacoma TRD PreRunner example you gave (2-seat trim showing `seating_capacity: 5`) wouldn't crash or misrender anything, but it would wrongly let that trim pass a "3-5 riders" or "6+ riders" filter it shouldn't, and wrongly show the "sized right for your group" bullet. **No defensive handling exists anywhere, and nothing in this plan proposes adding any** — flagging this as the honest current state per your question, not proposing a fix unless you want one (e.g. a plausibility check against `doors`, now that I've confirmed `doors` would need to actually be selected/typed first for that to even be possible).

**The addendum about actually correcting the Tacoma row — flagging a mismatch rather than guessing.** That message describes the fix as happening "at the source... via Cowork," and asks me to deliver it "in the same delivery as the 2027 additions." This session has no access to Cowork, no 2027 source CSV, and no mechanism to edit whatever's producing that dataset — so I can't execute "fix it at the source" from here. If instead you want a direct one-row correction against the **currently-live** batch's Tacoma TRD PreRunner data (a real DB write, not a source-file edit), I can propose that as a small corrective migration for you to review and run, same as the MSRP-wording correction earlier this session (`20260826120000_msrp_article_guarantee_wording.sql`) — just say the word and I'll write it. Didn't want to silently do nothing, or silently write to production data, on an ambiguous instruction.

No implementation on any of Parts 1-3 until you approve this plan and answer the Step 2 open question above.
