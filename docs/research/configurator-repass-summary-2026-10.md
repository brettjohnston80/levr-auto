# Configurator re-pass, batch 1 (sections A, B, C, E, F): summary (2026-10-16)

New files only. Inputs untouched. No MarketCheck or paid APIs. No cookie banners accepted and no browser settings changed this pass. Section D (prices) is **not** in this batch.

## Files

| Output | What |
|---|---|
| `data/<make-group>-configurator-repass-2026-10.csv` (12) | Same header, rows, order, 18 fields, line endings as each `-configurator-full-2026-10.csv`; only the listed cells changed (+ source URL in `sources`) |
| `docs/research/<make-group>-configurator-repass-notes-2026-10.md` (12) | Changes table, what was checked, Unresolved, Counts |
| `data/configurator-engine-facts-2026-10.csv` | 847 rows: one per engine option missing hp, size or cylinder layout |
| `data/matchmaker-additions-wave3-repass-2026-10.csv` | 25 rows, 46 columns; 1 cell changed (BMW XM range) |

## Changes applied (25 cells in 25 rows)

| File | Changes |
|---|---|
| vw-audi | 1: Atlas Cross Sport 2026 "SE w/Technology" → "SE with Technology" (URL was already in `sources`) |
| cadillac-lincoln | 4: Escalade / Escalade ESV "V" → "V-Series" (2026, 2027) |
| mercedes | 9: 8 trim names (G 580 Electric; AMG GT 55; HYBRID / E PERFORMANCE caps) + C4 AMG GT 43 drivetrain → RWD |
| lexus-acura | 2: Integra / ADX "…with Technology/Advance Package" |
| genesis-volvo | 3: Volvo "Ultra Black Edition" → "Black Edition" (XC40, EX40, XC60 T8) |
| dodge-chrysler-alfa | 6: Durango GT HEMI renames (2026, 2027) |
| gmc-buick, bmw-mini, porsche-landrover, mitsubishi-polestar-lucid, maserati, fiat | 0 |

Validation: every output has the same header, the same row count, 18 fields on every row, and the same line endings as its input; only `trim`, `drivetrain` (one cell) and `sources` cells differ. The real import parser (`configurator-parse.ts`, `blankPriceUnknown`) gives identical option totals, 0 dropped package references and 0 forced-unavailable on every file, before and after.

## Check results

| Check | Result |
|---|---|
| A – Audi RS e-tron GT "Performance" | **Not applied.** Audi USA writes "performance" in lowercase (also RS 6 Avant, RS 7, RS Q8). The two RS e-tron GT rows already match; the three capitalised rows don't. Your call on one convention. |
| B – Audi A3, S3, RS 3, SQ7, SQ9 "Base" | Correct: no grade names for 2027. |
| C1 – "Black optic plus", "S line plus" | Kept: real 2027 A3 models in Audi's configurator, in that styling. |
| C2 – A8 "55 TFSI quattro", S8 "4.0 TFSI quattro" | No grade name exists; unchanged. ("4.0" came from Edmunds.) |
| C3 – Escalade / ESV "Base" | **Kept Base.** Cadillac calls the entry version just "ESCALADE" / "Escalade ESV" (1SA), the same pattern as Porsche "Macan". |
| C4 – AMG GT 43 drivetrain | **RWD** (mbusa.com). |
| C5 – Polestar 4 names | Correct as is: "Rear motor", "Dual motor". |
| C6 – Lexus TZ seating | Unchanged (6). Lexus US never states a count; Lexus UK says "six-seat". |
| C7 – Grecale Folgore "automatic" | **Unchanged.** Maserati's configurator data says "auto" for Grecale Folgore but "single-speed" for the GT/GC Folgore, so the file matches Maserati. |
| C8 – Charger Daytona 2027 | Scat Pack Plus is **670 hp** (a package on the 670-hp Scat Pack). A plain 2027 Scat Pack **is** sold ($72,495 / $72,995); no row for it. Notes only. |
| C9 – MCPURA / Cielo / GT2 prices | Still not published. |
| B – all other "Base" rows (Porsche, BMW M, Acura, Alfa, Genesis, Maserati) | Correct. |
| F1 – BMW XM range_mi | 30.0 → **300.0** (EPA total range, fueleconomy.gov 2026 BMW XM Label, id 49761; no 2027 EPA entry exists yet). |
| F2 – Maserati resale | Kept: all six iSeeCars figures re-confirmed as model- and powertrain-specific (gas vs electric); CarEdge brand figure (75.3, 16th of 16) re-confirmed for MCPURA / GT2. Sources: https://www.iseecars.com/resale-value-brands/maserati , https://caredge.com/ranks/depreciation/luxury/5-year/worst |
| F3 – Maserati trims | No change (Base confirmed). |
| F4 – 6 Charger Daytona rows | Unchanged. |

## Engine facts (section E)

847 rows; **611 with hp, 236 hp blank** (blank = no official source reachable, never estimated). Blanks by make: GMC 142, Audi 32, Buick 22, Mitsubishi 16, VW 10, Dodge 8 (drivetrain-only lines), Lincoln 3, Lexus 3 (TZ). Cylinders use only I3, I4, I6, V6, V8, V12, flat-6 or blank. EV hp is the maker's headline "up to" figure where that's all it publishes (Audi launch control, Porsche overboost, Cadillac Velocity Max); notes say so.

## Decisions for Brett

1. Audi "performance" casing: lowercase (Audi) everywhere, or "Performance" everywhere?
2. Cadillac V trims: keep "V" / "V Blackwing" / "V Premium", or use Cadillac's "CT5-V", "LYRIQ-V", "OPTIQ-V"?
3. Escalade / ESV entry trim: Base (current) or "Escalade" / "Escalade ESV"?
4. BMW XM: OK to use the MY2026 EPA total range (300 mi) for the 2027 row, as its MPG figures already do? Otherwise blank.
5. Missing rows found (not added): 2027 Charger Daytona Scat Pack; BMW X5 40 / X5 50e / 750e; Eclipse Cross SE Pano / SEL Touring.
6. Next: section D prices, one make at a time — which make first? (Biggest: GMC 334, Cadillac 104.)
