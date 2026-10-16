# Configurator research review: Wave 3 (2026-10-15)

Read-only review. Nothing was imported, no CSV was edited and no MarketCheck call was made. Counts come from running the real import parser (`src/lib/configurator-parse.ts`, `blankPriceUnknown` on, as for every make since Wave 1) over each file, not from Cowork's summary. They match the summary exactly. The Matchmaker additions file was compared column by column, and value by value, against `data/matchmaker-vehicle-dataset-2026-v20.csv`.

**Decisions needed are in section 6.** The one finding that changes the plan is in section 4: the Dodge Charger Daytona is already in our Matchmaker dataset.

---

## 1. Inventory

Wave 3 produced 8 files, all untracked until this review's commit. No raw scrapes this time (`data/raw/` is already git-ignored and doesn't exist).

| File | What |
|---|---|
| `data/maserati-configurator-full-2026-10.csv` | Maserati configurator, 13 trims, MY2027 |
| `data/fiat-configurator-full-2026-10.csv` | FIAT configurator, 2 trims, MY2026 |
| `data/matchmaker-additions-wave3-2026-10.csv` | 25 Matchmaker rows (Lexus TZ, BMW XM, Dodge Charger Daytona, FIAT, Maserati) |
| `docs/research/maserati-configurator-notes-2026-10.md` | Maserati notes |
| `docs/research/fiat-configurator-notes-2026-10.md` | FIAT notes |
| `docs/research/vinfast-configurator-notes-2026-10.md` | VinFast eligibility check (no CSV) |
| `docs/research/jaguar-configurator-notes-2026-10.md` | Jaguar status check (no CSV) |
| `docs/research/wave3-summary-2026-10.md` | Cowork's summary and open questions |

### Configurator CSVs

| Make | Rows (= trims) | Models | Options | Unpriced extra-cost options | Dropped package refs | Format vs. Toyota CSV |
|---|---|---|---|---|---|---|
| Maserati | 13 | 5 (Grecale 4, GranTurismo 3, GranCabrio 3, MCPURA 2, GT2 Stradale 1) | 1,638 | 287 (MCPURA 97, MCPURA Cielo 105, GT2 Stradale 66; 19 across the 10 priced trims) | 0 | Identical header (18 columns, same order); every row 18 fields |
| FIAT | 2 | 1 (500e: POP, ICONA) | 61 | 0 | 0 | Identical header; every row 18 fields |

- Every availability value parses exactly. Maserati has 28 deliberately blank availabilities, which import as `unknown` ("Not confirmed"): the standard-equipment checks the configurator leaves out on GranTurismo Folgore, GranCabrio Folgore, GT2 Stradale and part of MCPURA.
- No "forced unavailable" values, no unparseable prices.
- **Format mismatches vs. the Toyota CSV: none.**

---

## 2. Findings from the notes

### VinFast: qualifies on dealers, but skipped
- **Dealer test: passed.** VinFast has sold through independent franchised dealers since 2024 (the first five included VinFast Wichita) and added three more in September 2026. The 2027 VF 8 went on sale at dealers that month. No fixed-price or agency model is reported, and the site says offers vary by dealer.
- **Caveat:** no source says outright that the price is negotiable. Franchised dealers set their own price, so it normally is.
- **Why no file:** VinFast's US configurator is out of date and contradicts VinFast's own current prices:
  - The VF 8 page is coded for 2023 and shows $39,900 / $44,900. The September 2026 release prices the 2027 VF 8 at $40,400 / $45,600.
  - There is no VF 9 configurator at all; its hidden data says $69,800 against "From $62,900" on the site.
  - Building from it would mix model years and stale prices, so Cowork rightly built nothing.
- **Decision needed (V1, section 6).**

### Jaguar: nothing to research
- Jaguar's last model, the F-PACE, ended production on 2025-12-19.
- The US site shows only the Type 01 electric GT, with no configurator, price or order path. Reported price is $130,500; orders are expected early 2027 and deliveries in the second half of 2027.
- Leftover dealer stock is out of scope. Re-check when Type 01 orders open.

---

## 3. The D2 rules on the Wave 3 configurator files

Cowork applied the rules itself this time, so both files are much cleaner than Wave 2.

| Rule | Maserati | FIAT | Still needs |
|---|---|---|---|
| 1. Trim styling as the maker writes it | Maserati's own names: `V6`, `Modena V6`, `Trofeo V6`, `Folgore`, `Trofeo`, `Cielo` | `POP`, `ICONA` (all caps, as fiatusa.com) | Nothing |
| 2. `Base` only where the maker has no name | GranTurismo and GranCabrio entry versions, MCPURA and GT2 Stradale | n/a | **Check:** the 2027 entry GranTurismo/GranCabrio were "Modena" until MY2026. `Base` is right if Maserati really dropped the name; listings will say "Modena" (M2) |
| 3. Designations | n/a | n/a | Nothing |
| 4. Engine format | One short line per row, e.g. `3.0L twin-turbo V6, 385 hp, automatic, AWD`. No gear counts (Maserati doesn't publish them) | `Electric, 117 hp, single-speed, FWD` | **Small inconsistency:** Grecale Folgore says `Electric, 542 hp, automatic, AWD`, while the other two Folgores say `single-speed`. The mapping step can't decide which is right; Cowork re-pass (R1) |
| 5. Unpriced options | 287 left blank on purpose, so they show "Price not confirmed" | 0 | Decision M1 on the three unpriced models |
| 6. Body style list | `SUV`, `Coupe`, `Convertible` (GranCabrio corrected from Maserati's "Coupé") | `Hatchback` | Nothing |
| 7. One drivetrain per row | AWD or RWD, one per row | FWD | Nothing |
| 8. Fuel list | `Gas`, `EV` | `EV` | Nothing |
| 9. Model names = our dataset's | **Maserati isn't in our dataset at all** | **FIAT isn't in our dataset at all** | Both makes need their Matchmaker rows added first (section 4), like D4 |

**Other manufacturer checks Cowork flagged:**
- **Trofeo horsepower:** 582 hp, Maserati's MY2027 figure, although the configurator's tech sheet still says 542 (M4).
- **GranTurismo Folgore horsepower:** 751 hp, taken from the GranCabrio Folgore page and assumed to be the same powertrain.
- **Two Grecale Modena Fuoriserie items** are left blank instead of the $0 in Maserati's data (they cost $2,020 and $1,070 on other Grecales). That's correct handling.

**For the mapping step: nothing new from Wave 3 itself.** The one mapping item this wave uncovers belongs to the Wave 2 Dodge file (section 4).

**MarketCheck naming (D5 check, ~4 more calls):**
- Grecale entry is likely "GT" on older listings.
- "Modena V6" / "Trofeo V6" are likely "Modena" / "Trofeo".
- MCPURA is often "MCPura", and its predecessor is "MC20" / "MC20 Cielo".
- FIAT is likely "Pop" / "Icona" or no trim at all. Case-only differences are already handled.

---

## 4. Matchmaker additions file

**Columns: exact match.** Same 46 column names, in the same order, as `matchmaker-vehicle-dataset-2026-v20.csv`, and every row has 46 fields. The dataset's own number style is followed (`62500.0`, `4.0`, warranty years as integers).

**Coverage: complete.** 25 rows:
- Lexus TZ, 3 rows;
- BMW XM, 1 row;
- Dodge Charger Daytona, 6 rows (2026 Scat Pack and Scat Pack Plus, 2027 Scat Pack Plus, each as Coupe and Sedan);
- FIAT 500e, 2 rows;
- all 13 Maserati trims.

Trim names match the configurator files exactly. For every priced row, `true_starting_price` = `msrp` + `destination_fee`.

### ⚠ The Charger Daytona is already in our dataset
- The dataset already has the Charger Daytona as model **`Charger`**, with trims **`Daytona Scat Pack`** and **`Daytona Scat Pack Plus`**. These cover 2026 and 2027, Coupe and Sedan, as EV: 8 rows.
- The Wave 2 review said it wasn't in the dataset. That was wrong: I checked model names, not trims.
- So the 6 "Charger Daytona" addition rows **duplicate existing vehicles under a second model name**. The 2026 rows match the existing ones on price, range and horsepower, but disagree elsewhere:

| Field | Existing dataset (`Charger` / `Daytona …`) | Wave 3 additions (`Charger Daytona`) |
|---|---|---|
| 2027 horsepower | 670 | 630 |
| 2027 Scat Pack (non-Plus) | present, $72,495 | absent (Wave 2 configurator has only the 2027 Scat Pack Plus) |
| tech_score | 1 (Scat Pack) / 2 (Plus) | 3 / 5 |
| resale_depreciation_pct | 47.9 coupe / 49.9 sedan (2026) | 61.8 (brand-level) |
| top_speed_mph | blank | 135 |

- **Recommendation (C1):**
  - drop the 6 Charger Daytona addition rows;
  - in the configurator import, map Wave 2's model `Charger Daytona` → `Charger` and its trims to `Daytona Scat Pack` / `Daytona Scat Pack Plus` (a rule 9 entry in the mapping step);
  - release the Charger Daytona from the D4 hold, since it needs no dataset change.
- **Separately:** someone should check which 2027 horsepower is right (630 or 670), and whether 2027 has a plain Scat Pack. The existing dataset says yes; the Wave 2 configurator file says no.

### Blank or suspicious values
- **Deliberate blanks, documented by Cowork:**
  - NHTSA stars on all 25 rows (not rated yet);
  - every Maserati row: no EPA figures, interior dimensions or reliability rating;
  - MCPURA, MCPURA Cielo and GT2 Stradale: no price, seats, doors or tank;
  - Lexus TZ: no EPA, torque, 0–60 or dimensions;
  - 2027 Charger Daytona: no cargo, 0–60, top speed or tech_score.

  Nothing was estimated.
- **Effect of those blanks:**
  - Matchmaker scores a dimension with no data as 50, the bottom of the scale. So Maserati and the Lexus TZ will rank low on Fuel Economy, Safety and Comfort until data exists.
  - The three unpriced Maserati models drop out whenever a customer sets a price range.
- **⚠ BMW XM range:** `range_mi` = 30 is the electric-only range. Our dataset's PHEV rows store the total range (gas + electric): RAV4 PHEV 594, Tucson PHEV 388. The scoring pipeline compares range within each fuel type, so the XM would rank as the worst PHEV on range by mistake.
  - Fix: Cowork supplies the EPA total range (X1), or the row leaves `range_mi` blank.
- **⚠ Maserati resale is inconsistent.** Rows labelled "model-specific" give GranTurismo 31.8%, GranCabrio 42.8% and Grecale 53.2% depreciation. MCPURA and GT2 Stradale use the brand-level figure, 75.3% (the worst of 16 luxury brands).
  - A GranTurismo losing only 31.8% when the brand average is 75.3% needs its source checked (X2).
  - These are 2027 models, so a "model-specific" figure can only come from earlier model years.
- **FIAT warranty:** 4 years/50,000 miles basic, from the configurator and KBB. JD Power says 3/36k, and Cowork flagged the conflict itself (X3; low stakes).
- **Lexus TZ:** cargo 13.8 cu ft (behind the third row) is the same on all trims, and towing is 2,400 / 3,500 lb. Plausible.
- **BMW XM:** 12/17/14 mpg is gas-only, which matches our other PHEV rows' style.
- **Format note:** the additions are in the **raw** 46-column format, the same as `v20.csv`. The Matchmaker import reads the **scored** file (67 columns, made by `data/matchmaker_scoring_pipeline.py`). So adding them means building `v21` (v20 plus these rows), re-running the pipeline, importing, promoting, then redeploying, because `/matchmaker` is a static page.

---

## 5. Fit with the Wave 2 plan (D1 pipeline)

**Same pipeline, with three differences.** Wave 3 goes through the same steps: the tested mapping step at import, the Cowork re-pass for manufacturer checks, the D5 name check, an unpromoted import per make, then review and promotion.

1. **Less work in the mapping step.** Wave 3's files already follow rules 4, 6, 7 and 8. The one mapping entry this wave adds is the Wave 2 Dodge one: `Charger Daytona` → `Charger` / `Daytona …` (section 4).
2. **Matchmaker rows come first for two whole new makes.** Maserati and FIAT have no rows in our vehicle dataset, so intake can't offer them. Their configurator data can't meet a customer until `v21` is built, scored, imported, promoted and the site redeployed. It's the same as the D4 hold, but for whole makes. The Lexus TZ and BMW XM ride in the same `v21`.
3. **A smaller re-pass.** For Wave 3 it's only M2 (`Base` vs "Modena"), R1 (Grecale Folgore transmission), M4 (Trofeo hp, if Brett wants it confirmed), and X1–X3 for the Matchmaker rows. The MarketCheck name check adds about 4 calls (Maserati, FIAT).

Unlike Lucid and Polestar (D8), Maserati and FIAT sell through franchised dealers, so the guarantee and the negotiation wording fit as they are.

---

## 6. Decisions for Brett

| # | Decision | Recommendation |
|---|---|---|
| V1 | VinFast: (a) hold until its configurator is current, (b) build from a dealer order guide, or (c) Matchmaker rows only | **(a) hold**, re-check monthly. Its own configurator contradicts its current prices, and (b) needs a source we can cite |
| C1 | Charger Daytona already in the dataset as `Charger` / `Daytona …` | **Drop the 6 addition rows; map the Wave 2 configurator's `Charger Daytona` → `Charger` in the mapping step**; release it from D4. Also check the 2027 horsepower (630 vs 670) and whether a 2027 plain Scat Pack exists |
| M1 | MCPURA, MCPURA Cielo, GT2 Stradale have no US prices (every option "Price not confirmed") | **Import unpromoted with the rest, but leave these three out of promotion** until prices are published |
| M2 | GranTurismo / GranCabrio entry trim `Base` (Maserati dropped "Modena" for 2027) | Keep `Base` if the re-pass confirms it; add `Modena` → `Base` in `TRIM_EQUIVALENTS` if listings use it |
| R1 | Grecale Folgore engine line says `automatic`; the other Folgores say `single-speed` | Cowork re-pass confirms the transmission wording |
| M3 | Fuoriserie (bespoke) options visible to customers (paints up to $21,420) | Keep them; they're real factory options with real prices |
| M4 | Trofeo 582 hp (MY2027) vs. the configurator tech sheet's 542 | Accept 582 (Maserati's own model card says it; dealer coverage confirms) |
| M5 | MCPURA Cielo as a trim of `MCPURA` (EPA calls it "MCPURA Spyder") | Accept (consistent with D3: one model name) |
| X1 | BMW XM `range_mi` is electric-only (30), but the dataset stores PHEV total range | Cowork re-pass for the EPA total range; until then leave it blank rather than 30 |
| X2 | Maserati "model-specific" depreciation (GranTurismo 31.8% against a 75.3% brand figure) | Cowork re-pass to confirm the source, or use the brand figure for all Maserati rows |
| X3 | FIAT 500e warranty, 4/50k vs JD Power's 3/36k | Accept 4/50k (it's the configurator's own figure) |
| N1 | MarketCheck name check | Add Maserati and FIAT to the D5 check (~4 calls), run with the Wave 2 makes |
