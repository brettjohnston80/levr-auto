# Truck Cargo formula — bed_length_ft cutover, verification report

**Date:** 2026-08-31
**New batch id:** `e0f184c3-dfa3-40a6-be6d-ad5385759427`
**Source CSV:** `data/matchmaker-vehicle-dataset-2026-v19-scored-truckbed.csv` (raw input: `matchmaker-vehicle-dataset-2026-v19.csv`, same v19 raw source as the currently-live batch)
**Rows inserted:** 1,601
**Promoted:** No — `promoted: false` in the import response, confirmed. Currently-live batch is unchanged: `38ff7925-5458-49a5-9217-cfe97ebbc859`.

## What changed in the pipeline

Diffed the new `matchmaker_scoring_pipeline.py` against the version already in the repo. The change is exactly as scoped, nothing else:

- `bed_length_ft` added to `NUMERIC_COLUMNS`.
- New constant `CARGO_BED_LENGTH_BODY_STYLES = ['Truck']`.
- `score_cargo()` now checks Truck first and returns `floor_rescale(cls['bed_length_ft'])` for it, before falling through to the existing dual-value (seats-up/max, 75/25) or single-value logic every other body style still uses unchanged.

## Verification 1 — Cargo Score changed for Truck only, zero collateral changes

Joined old (`matchmaker-vehicle-dataset-2026-v19-scored.csv`, the currently-live formula's output) against new on the full distinguishing key (`make, model, trim, model_year, body_style, drivetrain, fuel_type` — the same key used in the earlier Performance Score verification, since `make/model/trim/model_year` alone under-matches on the 132 known duplicate-tuple pairs).

- Total rows with a Cargo Score change: **179**
- Body styles among changed rows: **`['Truck']`** — nothing else touched
- Non-Truck rows with a Cargo Score change: **0**
- Truck rows changed: **179 of 191** (the remaining 12 are the no-bed-data Ram Chassis Cabs, see below)

## Verification 2 — the 12 Ram Chassis Cab rows floor at exactly 50.0

All 12 Ram Chassis Cab rows (3500/4500/5500 × Tradesman/Big Horn × 2 drivetrain variants each) have `bed_length_ft = NaN` (they ship without a factory bed) and were the only Truck rows with **no** Cargo Score change between old and new:

```
make  model              trim        bed_length_ft  Cargo Score (new)
Ram   Chassis Cab 3500   Tradesman   NaN            50.0
Ram   Chassis Cab 3500   Big Horn    NaN            50.0
Ram   Chassis Cab 4500   Tradesman   NaN            50.0
Ram   Chassis Cab 4500   Big Horn    NaN            50.0
Ram   Chassis Cab 5500   Tradesman   NaN            50.0
Ram   Chassis Cab 5500   Big Horn    NaN            50.0
```
(each ×2 for drivetrain variant = 12 rows)

Confirmed both in the CSV and by direct DB query against the new batch: `cargo_score = 50` for every one, `safety_score = 50` and `performance_score = 50` too (these trucks are missing that data as well — expected, unrelated to this change).

## Verification 3 — all 8 other dimension scores unchanged, every body style

Checked `Safety, Comfort, Fuel Economy, Reliability, Technology & Features, Price Value, Resale Value, Performance, Towing & Payload` Scores across all 1,601 rows, old vs. new:

```
Safety Score: 0 changed (byte-identical)
Comfort Score: 0 changed (byte-identical)
Fuel Economy Score: 0 changed (byte-identical)
Reliability Score: 0 changed (byte-identical)
Technology & Features Score: 0 changed (byte-identical)
Price Value Score: 0 changed (byte-identical)
Resale Value Score: 0 changed (byte-identical)
Performance Score: 0 changed (byte-identical)
Towing & Payload Score: 0 changed (byte-identical)
```

Zero unexpected changes anywhere. Only `Cargo Score`, only `Truck`, only the 179 rows with real bed-length data.

## Verification 4 — Truck Cargo Score spot-checks against `bed_length_ft`

Truck class range: `bed_length_ft` min 4.3 ft, max 8.2 ft. Formula: `score = 50 + (bed_length_ft - 4.3) / (8.2 - 4.3) * 50`.

- **Shortest bed in class:** Hyundai Santa Cruz, all trims, 4.3 ft → **50.0** (class floor, correct — it's the shortest real bed, not missing data)
- **Longest bed in class:** GMC Sierra 3500HD, all trims, 8.2 ft → **100.0** (class best)
- **Ford F-150** (all trims), 5.5 ft → **65.38**
- **Chevrolet Silverado 1500** (all trims), 5.8 ft → **69.23**
- **Toyota Tacoma**: 5.0 ft trims → **58.97**; TRD PreRunner (6.1 ft) → **73.08** — correctly differentiates the one trim with a longer bed
- **Toyota Tundra**: SR/SR5 (6.5 ft) → **78.21**; all other trims (5.5 ft) → **65.38**

Manual recompute on Chevrolet Silverado 1500 WT: `50 + (5.8 - 4.3) / (8.2 - 4.3) * 50 = 69.2308` — matches the pipeline's output exactly (69.2308).

Every value moves monotonically with bed length within a model, and no truck scores below 50 or above 100 — consistent with `floor_rescale`'s guarantees.

## Verification 5 — DB import matches the CSV

Queried the new batch (`e0f184c3-dfa3-40a6-be6d-ad5385759427`) directly via a scratch route, then deleted it (confirmed via grep — `api/internal/` again contains only the legitimate `sync-listings` and `import-vehicle-dataset` routes):

- Row count in DB: **1,601** — matches the CSV and the import response.
- `currentLiveBatchId` still `38ff7925-5458-49a5-9217-cfe97ebbc859` — **untouched**.
- Sample Chassis Cab 3500 / Sierra 3500HD rows pulled straight from the new batch match the CSV-level numbers exactly (Chassis Cab → `cargo_score: 50`, Sierra 3500HD → `cargo_score: 100`).

## Not done (by design, per your instruction)

- **Not promoted.** The new batch sits alongside the live one, inert, exactly like every prior batch import in this project.
- **Not pushed.** No source files were changed this round other than `data/matchmaker_scoring_pipeline.py` (replaced with your pasted version) and the new scored CSV — nothing in `src/` changed, so there's nothing pending a deploy either way. Still holding until you say so, per standing instruction.
