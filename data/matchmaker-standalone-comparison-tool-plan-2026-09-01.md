# Matchmaker: Standalone Comparison Tool Entry Point — Investigation + Proposed Plan (2026-09-01)

Investigation only was requested first, then a plan for review — same pattern as the earlier comparison-view build (`matchmaker-comparison-view-plan-2026-09-02.md`). No code has been written.

## Part 1 — Investigation

### 1. Does "list distinct models for a given body style + make" already exist?

No. `getModelVariants(vehicles, make, model, powertrain)` (`matchmaker-scoring.ts`) is the closest existing thing, but it's scoped one level too narrow (it needs a specific `make`+`model` already chosen, plus a folded `powertrain`) and one filter too many for this flow — see finding 2 below. Two new pure derivations are needed, both trivial filters over the already-loaded `vehicles` array:

- `getMakesForBodyStyle(vehicles, bodyStyle): string[]` — distinct `make` among vehicles matching `bodyStyle`.
- `getModelsForMakeAndBodyStyle(vehicles, bodyStyle, make): string[]` — distinct `model` among vehicles matching both.

**No new data-layer/API/schema work at all.** `/matchmaker` is a static route — `getLiveVehicles()` already loads the full live batch (1,601 rows as of the last promoted batch) server-side and passes it whole into `<Matchmaker vehicles={vehicles} />`. Every vehicle the standalone tool could ever need to offer is already sitting in the client component's own `vehicles` prop. This is genuinely just array filtering, the same category of derivation as `groupByModel`/`getModelVariants` already are.

**Real make/model counts per body style aren't confirmed yet** — no query access in this session (no direct DB credentials). Proposing to confirm this with real data as part of Step A below, since it determines whether Make selection should render as a pill grid (like `VEHICLE_TYPES`, 9 options) or a taller clickable list (like a trim selector, which this codebase already accepts up to 31 rows for — Ram ProMaster's real trim count, per CLAUDE.md). Not blocking the plan on it, just flagging it's unverified.

### 2. A real gap the confirmed design doesn't address: powertrain

The confirmed design's step 2 is Body Style → Make → Model → (existing trim/drivetrain picker). It doesn't mention Powertrain at all. But `getModelVariants()` — the "existing trim/drivetrain picker" data source — requires a powertrain to know which segment of the model to show, because a single Make+Model can legitimately span multiple powertrains (the Tucson Gas/Hybrid/PHEV case already documented elsewhere in this codebase), each currently treated as a structurally separate group.

Two ways to resolve this, not deciding silently:
- **(a) Recommended:** Skip a powertrain step entirely. Add a new sibling function, `getAllVariantsForModel(vehicles, make, model): MatchmakerVehicle[]` — same shape as `getModelVariants` minus the powertrain filter — and show every trim across every powertrain in one flat list, with each row's label extended to include powertrain when the model actually spans more than one (e.g. `"SE — FWD — Hybrid — $28,545 est."`, otherwise unchanged). Matches the confirmed design's literal 3-step wording and needs no new UI step.
- (b) Add an explicit Powertrain step between Model and Trim, reusing `getModelVariants` as-is.

Recommending (a) — simpler, fewer clicks, and the existing per-row trim label already has room to carry one more field.

### 3. Existing selector UI patterns to reuse

Two visual conventions already exist in `matchmaker.tsx`, both reusable, no new visual language needed:
- **Pill grid** — `QuestionPanel`'s "select" step (Vehicle Type, Powertrain, etc.) and `CompactSelectField` (Vehicle Type/Riders/Powertrain in the live-edit `AnswerPanel`). Good fit for Body Style (9 options, already a closed, small set).
- **Clickable bordered list rows** — the trim/drivetrain selector already built twice (`ModelGroupCard`'s per-card trim list, `ComparisonModal`'s per-column trim list). Good fit for Make/Model once the option count is likely to run higher than a pill grid comfortably holds, and directly reusable as-is for the final Trim step per the confirmed design ("no separate new Trim dropdown, reuse what exists").

Whether Make specifically should render as a pill grid or a list depends on real per-body-style make counts (see finding 1) — proposing to decide this concretely once Step A's data is in hand, defaulting to the list style if any body style's make count runs much past ~12-15 (roughly where `QuestionPanel`'s 3-column pill grid starts feeling cramped based on the existing 9-item Vehicle Type grid).

### 4. Is there any "current answers" state the standalone tool needs to work around?

No — genuinely a blank slate, and this was already true by original design, not something new to build around. `Answers` (`vehicleType`/`useCase`/`familySize`/`powertrain`/`priceRange`/`priorities`) is plain local `useState` inside `Matchmaker()`, and — critically — `flaggedGroups`/`ComparisonModal` were deliberately built to resolve everything from the raw `vehicles` prop, never from `answers` or the answers-filtered `matched` list (this is the whole reason a flag survives an unrelated answer change, per the original comparison-view plan). The only place `answers` currently reaches into the comparison surface is `ComparisonModal`'s `priorities` prop (`answers.priorities`), used solely to compute `comparisonRowOrder()`. That's a narrow, single seam to swap out for the standalone path (see Part 2).

## Part 2 — Proposed Plan

### Two decisions now resolved (2026-09-01)

**1. `flagKey` convention for standalone-originated flags — approved as proposed.** A flagged group's identity key (`flagKey`) is `` `${make}|${model}::${segmentTag}` ``, where `segmentTag` is `"primary"` or `` `alt:${powertrain}` `` on the quiz path — both meaningless for a standalone pick (there's no "preferred powertrain" to be primary/alternate relative to). Standalone-originated flags use a third, disjoint tag namespace: `` `direct:${powertrain}` `` (the picked vehicle's own folded powertrain). This can never collide with a quiz-path flagKey for the same model, and — as an approved, deliberate side effect — lets a customer flag a "Camry Hybrid" from quiz alternates *and* separately add a "Camry Gas" via the standalone tool as two distinct comparison columns, since they're genuinely different variants.

**2. Close behavior — reversed from the original proposal.** Closing the comparison view (from either entry path) now dismisses the modal overlay only — `flaggedGroups` is **preserved**, not cleared. A full reset is its own explicit separate action, not a side effect of closing. This actually simplifies the quiz path too: `ComparisonModal`'s existing `onClose` already only ever set `comparisonOpen` to `false` and never touched `flaggedGroups` — so the quiz path already matched this behavior, and this decision is really about making the *standalone* path consistent with it, not changing existing behavior.

**One new consequence of decision 2, flagged for your review rather than assumed:** since `flaggedGroups` now survives a close on the standalone path too, something has to render *behind* the dismissed modal — on the quiz path that's the full `ResultsList`, which doesn't exist in standalone mode. Proposing a lightweight "standalone home" state: after closing, show a minimal screen with the same `CompareBar` ("Compare (N)," reopens the modal) plus an explicit "Reset comparison" action (clears `flaggedGroups` and returns to the initial Body Style step) — no ranked list, since standalone mode never had one to show. This is new-since-your-message, not something you've confirmed yet — flagging it explicitly before Step C, same as everything else in this doc.

`comparisonRowOrder(priorities, flaggedVehicles)` also needs *some* `priorities: string[]` regardless of entry path. For quiz-originated comparisons this is `answers.priorities`. For a standalone-tool comparison, per the confirmed design's item 3, this defaults to `PRIORITY_HINTS_BY_USE_CASE[USE_CASES_BY_VEHICLE_TYPE[bodyStyle][0]]` — e.g. Sedan → `"Daily commuting"`'s full 9-dimension order — computed once, at the moment the *first* vehicle is picked, and held fixed for that comparison session (not recomputed if a later-added vehicle is a different body style — same "one shared row order across the whole table" principle `comparisonRowOrder` already uses for the quiz path's cross-body-style case). Since flaggedGroups now persist across a close, this computed value needs to persist alongside it too (not be recomputed from scratch on reopen) — a small addition to the state this needs to carry, noted here so it isn't missed during Step C.

### Component structure

- **`getMakesForBodyStyle()` / `getModelsForMakeAndBodyStyle()` / `getAllVariantsForModel()`** — new pure functions, `matchmaker-scoring.ts`, next to `groupByModel`/`getModelVariants`.
- **New `VehiclePickerFlow` component** — one shared, reusable Body Style → Make → Model → Trim stepper, built once and used from both call sites below. Reuses the pill-grid pattern for Body Style and (pending Step A's real counts) either pill-grid or clickable-list for Make/Model, and the existing trim/drivetrain row style verbatim for the final step. Takes an `onSelect(vehicle: MatchmakerVehicle)` callback and an `onCancel()` — stays agnostic to what happens after a pick, so both call sites can use it identically.
- **Standalone entry point** — a secondary link/button on the pre-quiz landing view in `Matchmaker()` (the `!done` branch, e.g. near the intro copy or under `QuestionPanel`/`BuildingVisual`), flipping a new top-level mode. `Matchmaker()` gains a third rendering branch alongside "quiz" and "results," active while in standalone mode.
- **Standalone bootstrap** — runs `VehiclePickerFlow` twice (vehicle 1, then vehicle 2 — matching the existing, unchanged `flaggedGroups.length >= 2` gate that already governs `CompareBar`/`ComparisonModal` everywhere else, so that invariant needs zero changes), computes the fixed default priorities off vehicle 1's body style, and opens `ComparisonModal` with both.
- **"+ Add vehicle" inside `ComparisonModal`** — a new tile/button alongside existing columns, visible whenever `columns.length < FLAG_CAP` (mirrors the existing cap-aware disabled-button convention from Step C). Opens the same `VehiclePickerFlow`; on selection, adds the picked vehicle via a new dedicated add path (mirrors `toggleFlag`'s add branch, still cap-enforced, using the `direct:${powertrain}` tag). Available from *both* origins — a quiz-flagged comparison can also use "+ Add vehicle," not just standalone-originated ones, since nothing about it is standalone-specific once inside the modal.

### Build sequence (stop for review after each, same convention as before)

- **Step A — data layer only.** `getMakesForBodyStyle`, `getModelsForMakeAndBodyStyle`, `getAllVariantsForModel`. Confirms real make/model counts per body style against production data, which settles the Make-selector pill-vs-list question from finding 3.
- **Step B — `VehiclePickerFlow` component**, built and smoke-tested in isolation (not wired to the entry point or the modal yet).
- **Step C — standalone entry point + 2-vehicle bootstrap.** Landing-page link, the new top-level mode, running `VehiclePickerFlow` twice, computing fixed default priorities, opening `ComparisonModal`, and the "standalone home" screen that persists `flaggedGroups`/priorities behind a closed modal (including its "Reset comparison" action).
- **Step D — "+ Add vehicle" inside `ComparisonModal`.** New tile, wired to `VehiclePickerFlow`, cap-enforced, using the `direct:${powertrain}` tag, available from both entry paths.
- **Step E — end-to-end verification.** Real browser pass: full standalone flow (bootstrap 2, add up to cap 5, mixed body styles), quiz-flagged comparison using the new "+ Add vehicle" tile, cap blocking from both origins, and the resolved close/back behavior.

No code written yet — waiting on review, especially the one remaining open item (the proposed "standalone home" screen that persists behind a closed modal, a consequence of the Close-behavior decision) plus the powertrain-step recommendation in finding 2. The `flagKey` convention and Close behavior itself are both now resolved per your instruction.
