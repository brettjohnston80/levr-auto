# Feeding the researched dataset into the Matchmaker app — what I did and what's left

## What this delivery contains
- `generated_matchmaker_data.ts` — 493 vehicles (every researched MY2026 trim across Toyota, Honda, Hyundai, Kia, Chevrolet, Ford, Ram, Tesla that had enough data to map into the app's format), exported as `GENERATED_RECOMMENDATIONS: GeneratedVehicle[]`.
- `merged_2026_all.csv` — the full 40-column research dataset behind it (498 rows), for reference/audit.
- `generation_report.md` — exactly which rows were dropped and why.

This type-checks cleanly against the app's real `MockVehicle` type (verified with `tsc --strict`).

## The integration step (one line, in your repo)
`generated_matchmaker_data.ts` imports `MockVehicle` from `./matchmaker-data`, so drop it into `src/lib/` alongside the existing file. Then in `matchmaker.tsx` (or wherever `MOCK_RECOMMENDATIONS` is currently imported), swap the import to `GENERATED_RECOMMENDATIONS` (or concatenate both arrays if you want to keep the 10 hand-written ones too — there's no ID collision). No changes to `fitScore`, `buildFitBullets`, or any type in `matchmaker-data.ts` are required. `GeneratedVehicle` is `MockVehicle & { trim: string }` — the extra field is inert until/unless the UI is updated to show it.

## Decisions I made without asking, and why
- **Trim-level granularity, not model-level.** The app currently has ~10 entries, one per model. The research dataset is one row per trim. Rather than collapsing trims into a single model-level entry (which would throw away most of the real pricing/spec spread — e.g. RAV4 ranges from ~$29k to ~$47k depending on trim), I kept every trim as its own entry and added a `trim` field. This means results lists will show many more cards per model than today (e.g. ~15 RAV4 trims instead of 1). If you'd rather cap it back down to one "best" or "starting" trim per model, that's a filter I can add — say the word.
- **`priorityScores` (the 1-5 ratings per category) are computed, not sourced.** There's no such thing as a sourced "Comfort: 4/5" — the research data only has raw specs (passenger volume, legroom, etc.). I derived each of the 9 scores from real spec fields, ranked against peer vehicles of the same body type (full methodology below). These are defensible heuristics, not facts — treat them as a first pass, not gospel.
- **`rationale` is template-generated from the single strongest real spec** the row has (towing capacity for trucks, EV range, 0-60/hp for performance trims, mpg for economy cars, cargo volume, third-row seating, falling back to price). No marketing language invented — every rationale only states a number that's actually in the CSV.
- **493 of 498 researched rows made it in.** 1 was a stray blank row from the Kia pass (not a real vehicle — no trim, no price, nothing). 4 more (Hyundai Kona Electric SE, Ioniq 6 N, Nexo Standard, Nexo Blue) had no sourced starting price, which the app's type requires as a number — I left them out rather than guess. Full list in `generation_report.md`.
- **Enum mapping is lossy in a couple of places** because the app's enums are narrower than the research schema:
  - `fuel_type`: PHEV → `Hybrid`, Diesel → `Gas`, Hydrogen (Toyota Mirai) → `Electric` (fuel-cell is an electric drivetrain). Only 1 Diesel row and 1 Hydrogen row in the whole dataset, so this affects very few vehicles.
  - `body_style` free text → the app's 9-value `VehicleType` enum via keyword matching (e.g. "3-row SUV", "mid-size SUV", "compact electric SUV" all → `SUV`). No unmapped values came up.

## priorityScores methodology (so you can sanity-check or override it)
For each vehicle, scored against peers that share its `bodyType` (so a truck's cargo score is judged against other trucks, not sedans):
- **Safety** — NHTSA overall stars directly (1-5). Blank (unrated) → neutral 3.
- **Comfort** — passenger volume (or legroom+headroom sum if that's missing), percentile-ranked vs. same-body-type peers.
- **Cargo Space** — cargo volume (trucks use payload capacity instead, since "cargo volume" isn't a truck spec), percentile-ranked vs. peers.
- **Fuel Economy** — EPA combined MPG for Gas/Hybrid, EPA range for Electric, percentile-ranked against same-powertrain peers (comparing an EV's range to other EVs, not to a sedan's MPG).
- **Reliability** — RepairPal rating as sourced, mapped onto 1-5. Blank → neutral 3.
- **Performance** — horsepower + 0-60 time (lower is better), percentile-ranked vs. same-body-type peers.
- **Technology & Features** — the sourced 0-6 standard-tech count, scaled to 1-5.
- **Price/Value** — starting price percentile vs. same-body-type peers, inverted (cheaper-for-its-class scores higher).
- **Resale Value** — resale depreciation %, percentile-ranked and inverted (lower depreciation scores higher). Only 254 of 493 rows have real resale data (MarketCheck's API quota ran out partway through research) — the other 239 default to neutral 3 rather than a guess.

Anywhere a row is missing the underlying spec, it defaults to a neutral middle score (3) instead of being estimated — same honesty rule as the rest of this project, just applied to a field that's inherently derived rather than sourced.

## What's still open
- **Ram and Tesla lineups are still just the original baseline** (Ram 1500, Tesla Model Y) — the Ram 2500/3500/ProMaster and Tesla Model 3/S/X/Cybertruck expansion was paused earlier and hasn't resumed.
- **No live connection to the `levr-auto` GitHub repo or a local clone** is available in this session (no GitHub connector, no device folder connected), so I can't commit this directly — it's delivered as files for you or your engineer to drop in.
- **MY2027 data** exists as a separate, not-yet-expanded dataset (still just the original 20 models) and isn't part of this delivery.
