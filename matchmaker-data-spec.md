# LEVR Auto Matchmaker — Vehicle Dataset Spec

This is the methodology and column reference for the real vehicle dataset backing a future real-inventory-connected Matchmaker (Matchmaker is currently front-end-only with mock data — see `src/lib/matchmaker-data.ts` and the Matchmaker entries in `CLAUDE.md`). The actual data lives in `data/matchmaker-vehicle-dataset-2026.csv`, generated against this spec.

## Coverage

- 142 trim-level rows across 20 models and 8 makes, 2026 model year only.
- A separate 2027 MY pass is planned as a follow-up, not included here.

## Row granularity

One row per make/model/trim, including performance and off-road sub-trims (Raptor, Type R, ZR2, TRD Pro, etc.) as their own rows — not folded into their base trim.

## Honesty rule

Every field is either a real, sourced figure or left blank. Nothing in this dataset is estimated or guessed — a blank cell means that figure genuinely could not be confirmed from an approved source as of the generation date, not that it was skipped.

## Known model-year gaps (real findings, not errors)

- **Kia Telluride** — Kia skipped MY2026 entirely for this nameplate; the redesign launched under the 2027 badge. One placeholder row is included with only `make`/`model`/`body_style`/`doors` filled in.
- **Chevrolet Equinox EV** — launched for MY2024, so it has no MY2023 predecessor; `resale_depreciation_pct` is blank by design, not a gap.
- **Ford Mustang Mach-E Rally** — launched for MY2024, same reason; resale left blank.
- **Ram 1500 TRX** — confirmed to be badged MY2027 (on sale late 2026), so it's excluded from this MY2026 file entirely.

## Sourcing

fueleconomy.gov, nhtsa.gov, manufacturer official spec/build-and-price pages and newsroom releases, repairpal.com (reliability), MarketCheck (resale used-market pricing), and Edmunds / Car and Driver / MotorTrend / KBB as secondary/cross-check sources. No blogs, forums, or content-mill sites were used.

## Resale methodology

```
Depreciation % = (2023 launch MSRP − today's average used asking price) / 2023 launch MSRP × 100
```

Uses MY2023 as a fixed predecessor year. Computed trim-specifically wherever that exact trim existed in 2023; falls back to a model-level blended figure only when it didn't; left blank only when the whole model is genuinely all-new with no 2023 equivalent at any trim.

## Column glossary

| # | Column | Definition |
|---|--------|------------|
| 1 | `make` | Manufacturer / brand. |
| 2 | `model` | Model nameplate. |
| 3 | `trim` | Specific trim level as named by the manufacturer for this model year. |
| 4 | `model_year` | Model year this row's specs and pricing apply to. |
| 5 | `is_performance_trim` | `yes` = a halo/performance sub-trim (e.g. Raptor, Type R, ZR2, TRD Pro, SS); `no` = standard trim ladder. |
| 6 | `body_style` | Sedan, SUV, truck, minivan, hatchback, etc. |
| 7 | `doors` | Number of doors. |
| 8 | `seating_capacity` | Total seating capacity (all rows). |
| 9 | `drivetrain` | FWD / AWD / RWD / 4WD. |
| 10 | `fuel_type` | Gas / Hybrid / PHEV / EV / Diesel. |
| 11 | `msrp` | Manufacturer's Suggested Retail Price for this trim, in USD (excludes destination). |
| 12 | `destination_fee` | Manufacturer destination/freight charge, in USD. |
| 13 | `true_starting_price` | `msrp + destination_fee`. |
| 14 | `epa_city_mpg` | EPA city fuel economy, mpg (blank for EVs — see `range_mi`). |
| 15 | `epa_hwy_mpg` | EPA highway fuel economy, mpg (blank for EVs — see `range_mi`). |
| 16 | `epa_combined_mpg` | EPA combined fuel economy, mpg (blank for EVs — see `range_mi`). |
| 17 | `range_mi` | Single range figure in miles: EPA electric range for EVs, or full-tank road-trip range for gas/hybrid/PHEV. |
| 18 | `nhtsa_overall_stars` | NHTSA overall crash-test safety rating (1–5 stars). Blank = not yet rated by NHTSA for this model/year. |
| 19 | `passenger_volume_cuft` | Total interior passenger volume, cubic feet. |
| 20 | `front_legroom_in` | Front row legroom, inches. |
| 21 | `rear_legroom_in` | Second row legroom, inches. |
| 22 | `headroom_in` | Front headroom, inches. |
| 23 | `has_third_row` | `yes`/`no` — whether this trim offers a third row of seating. |
| 24 | `third_row_legroom_in` | Third row legroom, inches (blank if no third row). |
| 25 | `cargo_volume_seats_up_cuft` | Cargo volume with all seats in use, cubic feet. |
| 26 | `max_cargo_volume_cuft` | Maximum cargo volume with rear seats folded, cubic feet. |
| 27 | `towing_capacity_lbs` | Maximum towing capacity, pounds. |
| 28 | `payload_capacity_lbs` | Maximum payload capacity, pounds. |
| 29 | `reliability_rating` | RepairPal reliability rating (model-level, not trim-specific; RepairPal's 0–5 scale). Blank = no RepairPal rating exists for this model. |
| 30 | `horsepower` | Engine/motor horsepower. |
| 31 | `torque_lbft` | Torque, lb-ft. |
| 32 | `zero_to_60_sec` | 0–60 mph acceleration, seconds, only where a tested figure from an approved source (Edmunds, Car and Driver, MotorTrend) was found for this exact trim. |
| 33 | `top_speed_mph` | Top speed, mph, where published/tested. |
| 34 | `tech_score` | 0–6: count of these **standard** (not optional) features on this trim — wireless CarPlay/Android Auto, an advanced hands-free/highway driving-assist package, digital instrument cluster, head-up display, 360-degree camera, wireless phone charging. Higher = more tech standard. |
| 35 | `warranty_basic_years` | Basic/bumper-to-bumper warranty term, years (brand-level). |
| 36 | `warranty_basic_miles` | Basic/bumper-to-bumper warranty term, miles (brand-level). |
| 37 | `warranty_powertrain_years` | Powertrain warranty term, years (brand-level). |
| 38 | `warranty_powertrain_miles` | Powertrain warranty term, miles (brand-level). |
| 39 | `resale_depreciation_pct` | % depreciation vs. a fixed model-year-2023 predecessor — see Resale methodology above. Trim-specific where that exact trim existed in 2023; falls back to a model-level blended figure when it didn't; blank when the whole model is genuinely all-new with no 2023 equivalent at any trim (e.g. a nameplate that launched in 2024+). |
| 40 | `manufacturer_link` | Link to the official spec/build-and-price page for this trim (or the model page as a fallback) — manufacturer site, fueleconomy.gov, nhtsa.gov, Edmunds, Car and Driver, MotorTrend, or KBB only. |

## Sheets in the source workbook

- **Vehicle Data** — the full 142-row dataset, one row per trim, sortable/filterable. Committed to this repo as `data/matchmaker-vehicle-dataset-2026.csv`.
- **Column Glossary** — plain-English definition of every column (reproduced above).
