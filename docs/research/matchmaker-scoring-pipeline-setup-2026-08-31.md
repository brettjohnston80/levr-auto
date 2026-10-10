# Scoring pipeline adopted as standing methodology, + one corruption fixed (2026-08-31)

`matchmaker-vehicle-dataset-2026-v18.csv` — 1,601 rows, 45 columns. Your `matchmaker_scoring_pipeline.py` is now saved to the project (`claude/matchmaker_scoring_pipeline.py`) as the definitive scoring methodology, and it's now a standing step: run before every future delivery, full report included in the delivery notes, per your instructions.

## First run — against v17 (before this fix)

```
Loaded 1601 rows from matchmaker-vehicle-dataset-2026-v17.csv

⚠ 1 embedded-text values found in columns that should be pure numeric (excluding reliability_rating, already handled above). Needs manual review:
    ('front_headroom_in', 'Hyundai', 'Ioniq 6', 'N', '40.2 f / 36.7 r')

=== Body style breakdown ===
body_style
SUV            928
Sedan          228
Truck          191
Coupe            77
Hatchback        61
Cargo Van        38
Convertible      37
Minivan          27
Wagon            14

=== Score coverage (should be 100% everywhere — floor covers missing data) ===
  Safety Score: 1601/1601
  Comfort Score: 1601/1601
  Cargo Score: 1601/1601
  Fuel Economy Score: 1601/1601
  Reliability Score: 1601/1601
  Technology & Features Score: 1601/1601
  Price Value Score: 1601/1601
  Resale Value Score: 1601/1601
  Performance Score: 1601/1601
```

**No unmapped body_style values** — every one of the 1,601 rows' body_style values already matches an entry in `BODY_STYLE_MAP`, so nothing silently dropped.

**One real corruption caught, exactly as designed**: `Hyundai Ioniq 6 N` — `front_headroom_in` held `"40.2 f / 36.7 r"`, both front and rear headroom crammed into one cell, with `rear_headroom_in` left blank. This is a genuine data-entry error from an earlier research pass, not a formatting quirk — the value itself spells out the correct split.

## Fixed at the source, then re-run — v18 is clean

Since the pipeline's own flagged value made the correct split unambiguous (`40.2 f / 36.7 r` → front=40.2, rear=36.7, with rear previously blank), I applied that fix directly to the master dataset rather than just noting it: `front_headroom_in` → `40.2`, `rear_headroom_in` → `36.7`. Verified the only cells that moved were these two, on that one row.

```
Loaded 1601 rows from matchmaker-vehicle-dataset-2026-v18.csv

✓ No embedded-text corruption found in any numeric column.

=== Body style breakdown ===
body_style
SUV            928
Sedan          228
Truck          191
Coupe            77
Hatchback        61
Cargo Van        38
Convertible      37
Minivan          27
Wagon            14

=== Score coverage (should be 100% everywhere — floor covers missing data) ===
  Safety Score: 1601/1601
  Comfort Score: 1601/1601
  Cargo Score: 1601/1601
  Fuel Economy Score: 1601/1601
  Reliability Score: 1601/1601
  Technology & Features Score: 1601/1601
  Price Value Score: 1601/1601
  Resale Value Score: 1601/1601
  Performance Score: 1601/1601
```

Clean report: zero embedded-text corruption, zero unmapped body styles, all 9 dimension scores computed for all 1,601 rows.

## What's in this delivery
- `matchmaker-vehicle-dataset-2026-v18.csv` — the master research dataset, unscored (same shape as v17 plus the one Ioniq 6 N fix), for continued research passes.
- `matchmaker-vehicle-dataset-2026-v18-scored.csv` — the pipeline's output: every raw column plus the 9 computed Matchmaker dimension scores, for reference/spot-checking. Not a replacement for v18 as the working research file — future passes should keep patching v18-style raw data and re-run the pipeline fresh each time, since scores need to be recomputed from current raw values, not carried forward.

## Standing process, going forward
Saved `matchmaker_scoring_pipeline.py` to the project (`claude/matchmaker_scoring_pipeline.py`) as the definitive scoring methodology — the fixed NHTSA/IIHS safety scale, fuel-type-grouped fuel economy comparison, the Performance fix (0-60 missing floors Performance at 50 regardless of trim flag), and the now-confirmed Comfort (75% front/rear + 25% third-row) and Cargo (75% seats-up + 25% max) weightings. Before every future delivery — 2027 research included — I'll run it against the final output and include the printed report in the delivery notes: unmapped body styles get flagged (not guessed at), any embedded-text corruption gets flagged with the specific make/model/trim (and fixed at the source when the fix is unambiguous, as with Ioniq 6 N above; left for your input when it isn't), and score coverage gets confirmed at 100% across all 9 dimensions. If a scoring rule needs to change, that comes as an update to the script itself, not a workaround.
