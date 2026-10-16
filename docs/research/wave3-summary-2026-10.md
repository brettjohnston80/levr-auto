# Wave 3 configurator research + Matchmaker additions: summary (2026-10-15)

New files only; nothing imported and no existing file edited. No MarketCheck calls.

| File | What |
|---|---|
| `data/maserati-configurator-full-2026-10.csv` | 13 trims, MY2027 |
| `data/fiat-configurator-full-2026-10.csv` | 2 trims, MY2026 |
| `data/matchmaker-additions-wave3-2026-10.csv` | 25 Matchmaker rows (46 columns, same as `matchmaker-vehicle-dataset-2026-v20.csv`) |
| `docs/research/maserati-configurator-notes-2026-10.md`, `fiat-...`, `vinfast-...`, `jaguar-...` | Per-make notes |

## Format

- The configurator CSVs copy the Toyota file exactly: same 18 columns in the same order, comma-separated with quoted cells, and the ` | ` / ` ;; ` format inside each option cell (the Toyota file is comma-delimited at the column level; "pipe-delimited" applies to the cells). Base MSRP and destination are stated in `discrepancy_notes` because the Toyota format has no price columns (same as Waves 1–2).
- Both files were run through the real import parser (`src/lib/configurator-parse.ts`, `blankPriceUnknown: true`): header identical to Toyota's, every row 18 fields, 0 dropped package references, 0 "forced unavailable" availability values.
- The Maserati rows were transcribed from the in-browser output and checked against it by SHA-256, row by row (all 13 matched) before the documented clean-up (blank prices instead of "$0" on the no-price models, GranCabrio soft tops moved to `roof_options`).

## What was researched

| Make | Result | Rows | Options | Unpriced extra-cost options |
|---|---|---|---|---|
| **Maserati** | Researched (Maserati US configurator; MY2027 is the only year on it) | 13: Grecale ×4, GranTurismo ×3, GranCabrio ×3, MCPURA ×2, GT2 Stradale ×1 | 1,638 | 287: 268 on MCPURA / MCPURA Cielo / GT2 Stradale (97 / 105 / 66; no prices published at all) and 19 across the 10 priced trims (choices the configurator shows without a price) |
| **FIAT** | Researched (2026 500e is the only vehicle on FIAT's Build & Price) | 2: 500e POP, ICONA | 61 | 0 |
| **VinFast** | Passes the dealer test, **not researched**: its US configurator is stale and contradicts VinFast's current prices | 0 | – | – |
| **Jaguar** | **Nothing orderable.** US site shows only the Type 01 teaser; no configurator, no prices | 0 | – | – |

Exact per-row unpriced counts are in the per-make notes.

## VinFast finding

- **Dealers:** yes. VinFast has sold through independent franchised dealers since 2024 (first five included VinFast Wichita) and signed three more in September 2026; the 2027 VF 8 went on sale at dealers that month. No fixed-price or agency model is reported; the site sends buyers to dealers and says offers vary by dealer. No source explicitly says "negotiable".
- **Why no file:** the VF 8 configurator is a 2023-coded page showing $39,900 / $44,900 (hidden data says Plus $52,400) while VinFast's September 2026 release prices the 2027 VF 8 at $40,400 / $45,600; the VF 9 has no configurator (link redirects), and its hidden data says $69,800 versus "From $62,900" on the site.
- **Decision needed:** hold VinFast, or source it from a dealer order guide, or add Matchmaker rows only. Details in `vinfast-configurator-notes-2026-10.md`.

## Jaguar finding

The F-PACE, Jaguar's last model, ended production 2025-12-19. jaguar.com/en-us shows only the Type 01 electric GT with no price or order path; reported US price is $130,500 with orders expected early 2027 and deliveries in the second half of 2027. Re-check when orders open.

## Matchmaker additions (25 rows)

| Vehicle | Rows | Key sources |
|---|---|---|
| Lexus TZ 2027 (450e Premium, Premium Touring, Luxury) | 3 | Lexus pressroom (prices, $1,550 delivery, range 253/315/279 mi, 308 hp); Lexus dealer pages and Edmunds hands-on (6 seats, 13.8 cu ft cargo, towing with Convenience Package); wireless charging and adaptive cruise standard per the Wave 2 Lexus configurator file |
| BMW XM Label 2027 | 1 | bmwusa.com (738 hp/738 lb-ft, 0–60 3.6 s, 155 mph, 30-mile EV range); Edmunds ($159,600 + $1,550, 12/17/14 mpg); KBB/dealer data (dimensions, payload, tank) |
| Dodge Charger Daytona (2026 Scat Pack and Scat Pack Plus; 2027 Scat Pack Plus), each as Coupe and Sedan rows like the gas Charger | 6 | Prices from the Wave 2 Dodge configurator file; EPA 93/79/86 MPGe and 267 mi via an EPA-data mirror (fueleconomy.gov blocks automated reads); KBB and MoparInsiders for specs |
| FIAT 500e 2026 (POP, ICONA) | 2 | FIAT configurator (prices, tires, features); fiatusa.com (117 hp, 4 seats); EPA via mirror; iSeeCars (dimensions); KBB (warranty, top speed) |
| Maserati 2027 (all 13 configurator trims) | 13 | Maserati configurator (prices, destination, hp, torque, 0–60, top speed, tank, standard equipment for tech_score); Maserati model pages (seats, cargo); KBB (warranty 4 yr/50k); iSeeCars brand page (model-level depreciation); CarEdge (brand-level for MCPURA/GT2) |

Conventions followed: `true_starting_price` = MSRP + destination; EV MPG columns are MPGe and `range_mi` is EPA range; `tech_score` counts only features **confirmed standard** (so it can understate where a feature couldn't be checked: Lexus TZ head-up display and panoramic camera, 2027 Charger Daytona equipment); reliability and resale use the same RepairPal/CarEdge/iSeeCars wording as the existing dataset; numbers written in the dataset's own style (e.g. `62500.0`).

**Deliberate blanks (no estimates):**
- **All 13 Maserati rows:** no EPA figures (no MY2027 EPA entries exist yet; Folgore ranges are "homologation ongoing"), no NHTSA rating, no interior dimensions, no RepairPal rating.
- **MCPURA, MCPURA Cielo, GT2 Stradale:** no price, seats, doors or tank (Maserati's tank figures conflict); tech_score blank for GT2 Stradale and both Folgore coupes/convertibles, whose configurator data omits standard equipment.
- **Lexus TZ:** no EPA MPGe, interior dimensions, torque, 0–60 or NHTSA rating yet (new model).
- **2027 Charger Daytona:** cargo, 0–60, top speed and tech_score (no 2027-specific source; 2026 values were not carried over).
- **NHTSA stars blank on all 25 rows** (none rated, or NHTSA unreachable); `safety_source` left blank to match.

## Open questions for Brett

1. **VinFast:** hold, dealer order guide, or Matchmaker-only (above).
2. **MCPURA, MCPURA Cielo, GT2 Stradale** have no published US prices. Import them unpromoted like the rest, or hold them until prices exist? Every option shows "Price not confirmed".
3. **Fuoriserie (bespoke) options** are kept as normal options (paints up to $21,420). Keep them customer-visible, or filter Fuoriserie items out at import?
4. **Trofeo horsepower:** 582 hp (Maserati's MY2027 figure) is used although the configurator's tech sheet still says 542. OK?
5. **MCPURA Cielo as a trim** of `MCPURA` (D3 style) rather than its own model. OK? (EPA calls it "MCPURA Spyder".)
6. **New makes for MarketCheck:** Maserati and Fiat aren't in the dataset yet, so the ~42-call name check from Wave 2 should add them (about 4 more calls) before import.
7. **Matchmaker:** the Maserati rows have no EPA, NHTSA or dimension data, so they'll score on few dimensions; re-run when MY2027 EPA data appears.

## One thing to know

While opening Maserati's configurator, one click landed on the site's cookie banner and accepted its cookies in your Chrome (maserati.com only). You can reset it from the "Manage preferences" link on maserati.com.
