# Matchmaker: Comparison View for Flagged Vehicles — Investigation + Proposed Plan (2026-09-02)

Investigation only was requested first, then a plan for review. No code has been written — this document is the plan for review, matching the "propose first" pattern used for every other multi-step Matchmaker build in this project.

## Part 1 — Investigation of the current "Flag" feature

1. **What "Flag" does today, in full.** Pure sort-order + cosmetic signal, per-**trim** (keyed by `vehicle.id` in a `Set<string>`). Three effects, nothing more:
   - `groupHasFlaggedVariant()` bubbles a model group to the top of its section if *any* variant in it is flagged.
   - The card's emerald border/background highlight is keyed off `flagged.has(activeVariant.id)` — the *currently displayed trim specifically*, not the group. Switching the card's trim toggle to an unflagged trim makes the highlight disappear even though the group is still sorted to the top.
   - The closing CTA heading swaps between two fixed strings based on `flagged.size > 0` (binary, not a count).

   Nothing else is tracked — no separate list/table, no data passed to `GetStartedButton` (confirmed it's a generic scroll-trigger with zero flag awareness).

2. **Persistence.** Plain `useState<Set<string>>` local to `Matchmaker()`. No `localStorage`/`sessionStorage` anywhere in the matchmaker files. Resets only on `startOver()`; lost on reload.

3. **Existing "N flagged" UI.** None — no counter, no badge, no summary list. Only the binary CTA-heading swap and each card's own highlight.

4. **Survives answer changes?** Yes — none of `setField`/`setPriceRange`/`reorderPriorities` touch `flagged`; only `startOver()` clears it.

### Important addendum found while scoping Part 2, not asked for but load-bearing

`ModelGroup.key` is `` `${make}|${model}` `` only — it does **not** encode which powertrain segment the group came from. A model that legitimately spans multiple powertrains (the Hyundai Tucson Gas/Hybrid/PHEV case, already called out elsewhere in this codebase) renders as **two separate `ModelGroup` objects with the identical key** — one from the primary section, one from an alternative-powertrain section — each a visually distinct card with different specs. If flag identity used raw `group.key`, flagging the Tucson-Gas card would also silently flag the Tucson-Hybrid card. This needs a qualified key (see Part 2, Step B) — flagging it now rather than silently building around it.

## Part 2 — Proposed Build Plan

### Data/state shape

Replace `flagged: Set<string>` with an ordered list, capped at 5:

```ts
type FlaggedGroup = {
  flagKey: string;  // `${make}|${model}::${segmentTag}` -- segmentTag is
                     // "primary" or `alt:${powertrain}`, resolving the
                     // Tucson-collision issue above. Computed once per
                     // rendered card, passed down as a prop instead of
                     // reusing raw ModelGroup.key.
  trimId: string;    // the active variant's id at the moment of flagging --
                     // just the comparison view's starting point, not
                     // synced afterward.
};
```

`flaggedGroups: FlaggedGroup[]` lives in `Matchmaker()`, ordered by flag time (oldest first — supports "don't auto-bump the oldest," and gives the Compare bar/table a stable column order).

**Resolution source is deliberately the raw `vehicles` prop, never `matched`.** `matched` is answers-filtered and can lose a flagged vehicle entirely the moment an unrelated answer changes (e.g. flag a Sedan, then switch Vehicle Type to Truck — the Sedan fails the hard filter and vanishes from `matched`). Since cross-body-style comparison is explicitly required (confirmed-design item 7) and flagged state must survive answer edits (Part 1, confirmed), the comparison view has to look vehicles up in the full, filter-independent `vehicles` array. Two new pure derivations, living next to their closest existing siblings:

- `getModelVariants(vehicles, make, model, powertrain)` — in `matchmaker-scoring.ts` next to `groupByModel`. Filters raw `vehicles` by make+model, then by folded powertrain (`fuelTypeToPowertrain`) matching the flagged segment, independent of current `answers`. Backs the comparison view's own trim/drivetrain toggle.
- `comparisonRowOrder(priorities: string[], flaggedVehicles: MatchmakerVehicle[]): string[]` — in `matchmaker-dimension-indicators.ts` next to `personalizedDimensionOrder`. Returns `priorities` filtered down to the 8 shared labels (drop whichever of Resale Value/Towing & Payload is present), then appends one fixed extra row per *distinct* 9th-dimension type actually present among the flagged vehicles (so 1 row if all flagged vehicles share a type, up to 2 if mixed — never a combinatorial per-vehicle row).

**Assumption flagged for confirmation:** the confirmed design's "each vehicle's unique 9th dimension gets its own fixed extra row" is read here as *one shared extra row per dimension-type present*, not one row per vehicle — since rows are shared table structure across columns, a per-vehicle row wouldn't make sense (it'd be blank for every other column). Cells that don't apply to a given vehicle's body style show a plain `—`, not the colored "No data" badge (distinct concept: not applicable vs. applicable-but-missing).

### Component structure

- **`Matchmaker()`**: owns `flaggedGroups`, `toggleFlag(flagKey, trimId)` (rewritten: group-level add/remove, cap-enforced, no bump), `comparisonOpen: boolean`. `startOver()` gains `setFlaggedGroups([])`.
- **`ModelGroupCard`**: receives a qualified `flagKey` prop (computed by the caller, see below) instead of relying on raw `group.key`; `isFlagged`/highlight becomes `flaggedGroups.some(g => g.flagKey === flagKey)` — group-scoped, which as a side effect fixes the existing "highlight vanishes when you switch trims" quirk from Part 1 (flagging is genuinely group-level now, so the whole card stays highlighted regardless of which trim is toggled active). Also receives `compareLimitReached: boolean` to drive the at-cap button state (see Step C).
- **`ResultsList`**: computes each card's qualified `flagKey` (`` `${group.key}::primary` `` for the primary list, `` `${group.key}::alt:${altGroup.powertrain}` `` for alternatives — uniform formula, no special-casing) and passes it down alongside the existing props.
- **New `CompareBar`**: small persistent trigger, visible once `flaggedGroups.length >= 2`. **Proposal**: a compact floating pill, `fixed bottom-6 right-6`, "Compare (N)" — deliberately *not* the same sticky-panel pattern just removed from `AnswerPanel` (that was a tall, page-length element causing real problems; this is a small fixed pill, a different risk profile). Flagging this specific choice for confirmation since it's the one purely-my-call UI decision in this plan.
- **New `ComparisonModal`**: portaled to `document.body` (same `createPortal` pattern already fixing the stacking-context trap for `VehicleDetailModal`/`mobile-nav-menu`), full-screen overlay, horizontally-scrollable table inside (`overflow-x-auto`), capped at 5 columns so it never needs vertical-only fallback logic.
  - Column header per flagged vehicle: make/model, the same clickable trim/drivetrain list UI already built for results cards (reusing `getModelVariants()` for that model's full variant set), current price, a remove (unflag) action.
  - Rows: `comparisonRowOrder()` output, each rendered via the existing `dimensionIndicator()` + `dimensionDataPoint()` + `INDICATOR_CLASSES`/`INDICATOR_LEVEL_LABEL` — literally the same pieces `DimensionDetailList` and the modal's "How it scores" section already use, just laid out as a table cell per vehicle instead of a single-vehicle row list. No new visual language.

**Open decision to confirm:** if the customer unflags down to 1 remaining while the comparison modal is open, does it auto-close (comparing one thing isn't a comparison) or stay open? Default proposal is auto-close, but flagging it rather than deciding silently.

**Cap-UI approach — recommending, not deciding silently:** two ways to satisfy "attempting to flag a 6th is blocked, show a message":
- (a) *Recommended*: pass `compareLimitReached` down proactively; once at cap, every not-yet-flagged card's Flag button goes into a disabled state with its label swapped to something like "Compare limit reached" (no click ever fires, no separate message state needed).
- (b) Keep the button live; on a blocked click, show a short-lived inline message near that card (reusing the existing `searchClicked`-style local-boolean-→-placeholder-text pattern already in `ModelGroupCard`).

Leaning toward (a) — simpler, no new transient-message state, prevents the dead click entirely — but it's a real UX call, calling it out rather than picking silently.

### Build sequence (stop for review after each, same as every other multi-step build here)

- **Step A — pure data layer only, no UI/behavior change.** Add `getModelVariants()` and `comparisonRowOrder()`. Both independently testable against real data before anything else moves.
- **Step B — flag-state refactor.** Replace `Set<string>` with `FlaggedGroup[]`, qualified `flagKey` plumbing through `ResultsList`/`ModelGroupCard`, cap enforcement (no auto-bump), `startOver()` reset. **This alone changes existing behavior** (group-scoped highlight, capped flagging) before any comparison UI exists — smoke-test and review here first.
- **Step C — Compare bar + cap-reached button state.** Trigger visibility, disabled/blocked Flag button treatment.
- **Step D — `ComparisonModal`.** Table, trim toggling, dimension rows, remove-from-comparison.
- **Step E — wire-up + end-to-end verification.** Real-browser pass: flag 5 across mixed body styles including at least one Truck + one Sedan (proves cross-body-style and the two-extra-row case), verify cap blocking, verify in-modal trim switching, verify unflag-from-modal updates the results list's sort/highlight live, verify Start Over clears everything including an open modal.

No code written yet — waiting on review, especially the three flagged decisions (flagKey qualification approach, Compare-bar placement, cap-UI approach) and the row-ordering interpretation.
