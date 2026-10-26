# Matchmaker v22: score changes vs the live v21 (2026-10-25)

**LIVE since 2026-10-25 (Brett's go):** imported as batch `3b86a2af-8f6a-4028-8346-65c1e839792f` (2,287 rows, verified by paging), promoted 2026-10-26 02:33:26 UTC, redeployed after promotion (`levr-auto-c7a39j1w9`) and checked on www (screenshots in `~/Downloads/levr-matchmaker-v22-2026-10-25/`). The v21 rollback (`9b458ac3…`) is kept until about 2026-11-01. `data/matchmaker-vehicle-dataset-2026-v22.csv` is built by `scripts/build-matchmaker-v22.py` from v21. It's scored with `data/matchmaker_scoring_pipeline.py` into `…-v22-scored.csv`. Brett's decisions: `docs/research/tesla-rivian-configurator-review-2026-10-25.md`, section 8.

- **The pipeline was checked first:** it reproduces the live `v21-scored` byte for byte.

## Rows: 2,276 → 2,287

- **Added (12):**
  - **Tesla Model 3 2027 (4)** and **Model Y 2027 (6):** copies of the 2026 rows, same prices. Tesla's configurator builds them as 2027.
  - **Rivian R1T and R1S "Premium Long Range" 2027 (2):** $86,990 and $90,990 before the $1,895 destination. Range "up to 420 miles" (rivian.com builder, Compare panel, 2026-10-25; the link is in `manufacturer_link`).
- **Removed (1, held):** Rivian R2 Performance 2027. It's added to `data/held-models.json`; held until Rivian opens public ordering.
- **Kept as is:**
  - the Tesla Model 3 and Model Y 2026 rows, and every Rivian 2026 R1 row (Launch Editions included), which the site offers only while 2026 inventory lasts;
  - the Rivian 2026 destination, left blank (not researched).
- **Renamed (2):** Cybertruck "Dual Motor All-Wheel Drive" → "Dual Motor AWD", "Premium All-Wheel Drive" → "Premium AWD". Their scores are unchanged.
- **Horsepower blanked (2):** Cybertruck Dual Motor AWD and Premium AWD (600 hp, a KBB figure). **No score moves:** Performance is scored on 0–60 time, not horsepower.

## Price fixes → Price Value score (9 rows; no other score moves, no other make or row changes)

| Rows | Starting price change | Price Value |
|---|---|---|
| Cybertruck Dual Motor AWD, Premium AWD, Cyberbeast 2026 | destination $1,390 → $1,995 (+$605): $76,985 / $86,985 / $101,985 | −0.33 each (73.92 → 73.59, 68.44 → 68.10, 60.21 → 59.88) |
| Rivian R1T Premium, Performance, Quad 2027 | destination $1,895 added (was blank): $81,885 / $102,885 / $117,885 | −1.04 each (71.94 → 70.90, 60.42 → 59.38, 52.19 → 51.15) |
| Rivian R1S Premium, Performance, Quad 2027 | the same: $85,885 / $108,885 / $123,885 | −0.39 each (87.18 → 86.79, 82.41 → 82.02, 79.30 → 78.91) |

## The new rows' scores

- **Tesla 2027 rows:** every score is identical to the matching 2026 row.
- **Rivian Premium Long Range** compared with the 2027 Premium (other scores the same):

| Row | Fuel Economy (range) | Price Value |
|---|---|---|
| R1T Premium Long Range | 85.27 (Premium 62.15; 420 vs 329 mi) | 67.06 (Premium 70.90) |
| R1S Premium Long Range | 92.31 (Premium 74.81) | 85.34 (Premium 86.79) |
