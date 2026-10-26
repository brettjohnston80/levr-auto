# Configurator prices pass review: section D, Paint to Sample, 2027 Charger doors (2026-10-16)

Read-only review of Cowork's run of `cowork-prices-prompt-2026-10-16.md`. Nothing was imported and no MarketCheck call was made. The prices files are committed as received (`ba093db`).

## 1. Files

All 25 expected outputs are present: 12 × `data/*-configurator-prices-2026-10.csv`, 12 × `docs/research/*-configurator-prices-notes-2026-10.md`, and `docs/research/configurator-prices-summary-2026-10.md`.

**Every make is done.** Every notes file's Progress line marks each of its makes "done" (GMC, Buick, Cadillac, Lincoln, Land Rover, Porsche, Audi, Volkswagen, Maserati, Dodge, Chrysler, Alfa Romeo, Mercedes-Benz, BMW, MINI, Lexus, Acura, Genesis, Volvo, Mitsubishi, Polestar, Lucid, Fiat).

## 2. Integrity (checked cell by cell against each re-pass input)

- Every prices file has the same header, the same row count and order, 18 fields on every row, the same line endings, and every option item in `Name | Availability | Price | Package` form.
- **Only prices, Paint to Sample and `sources` changed.** No trim, model, body style, drivetrain, fuel type, availability, option name or option order changed anywhere.
- Changes by file:
  - gmc-buick: 60 prices filled;
  - cadillac-lincoln: 7 prices filled;
  - vw-audi: 16 prices filled;
  - porsche-landrover: one "Paint to Sample" option on each of the 61 Porsche rows. Each is added after the existing paints; nothing was reordered.
  - The other 8 files are byte-identical to their inputs.
- **Source URLs:** every filled or added item has its URL in the notes. The GM fills added it to `sources`. The 3 Audi rows and the 61 Porsche rows already listed that page (audiusa.com build page, configurator.porsche.com model page), so their `sources` cells didn't need to change.

## 3. Results per make

| Make | Blank in | Filled | Package-priced | Still blank, and why |
|---|---|---|---|---|
| GMC | 334 | 57 (all $0) | 1 | 276: other items needed first 134, not published 95, already in the default build 24, no usable price 14, not in today's data 6, GM asks to confirm a change 3 |
| Buick | 7 | 3 (all $0) | 0 | 4: not published 2, not in today's data 1, AUX heater +$395 needs a confirmed change 1 |
| Cadillac | 105 | 7 (all $0) | 0 | 98: other items needed first 71, **site blocked 12** (2026 Vistiq no longer on cadillac.com), no usable price 9, not published 3, not in today's data 3 |
| Lincoln | 47 | 0 | 10 | 37 not published |
| Land Rover | 40 | 0 | 4 | 36 not published (White contrast / Bespoke roofs not offered on the default US builds) |
| Audi | 157 | 16 | 137 | 4 (paints Audi's configurator wouldn't let Cowork select) |
| Volkswagen | 31 | 0 | 30 | 1 (ID.4 Pro 20-in. AWD wheel, not offered on the RWD Pro) |
| Maserati | 299 | 0 | 0 | 299 not published |
| Dodge / Chrysler / Alfa Romeo | 94 / 10 / 7 | 0 | all | 0 |
| Confirm-only (Mercedes, BMW, MINI, Lexus, Acura, Genesis, Volvo, Mitsubishi, Polestar, Lucid, Fiat) | 0 Standalone; 183 Package-only | 0 | 183 | 0 |

- The Audi fills:
  - A8 2027: five paints at $0;
  - RS 6 Avant 2026: Nardo Gray at $0 and five paints at $595;
  - RS e-tron GT 2026: Arkona White at $0 and four paints at $595.
- **All 67 GM fills are $0.** Cowork added each item on its own in GM's configurator and saw the total stay the same. GM doesn't label them "$0" (Unresolved 1).

**Spot-checks against the sources:**
- **Porsche:** confirmed on the live configurator pages: 911 Carrera 2027 $15,050 and Taycan 2027 $13,870. On both pages, Paint to Sample Plus is $32,940 and $31,670, the same as the files' existing items.
- **Dodge:** every figure in the Charger table matches Dodge's Build & Price data (section 5).
- **Audi:** audiusa.com refused the automated read (403), so the $595 / $0 paints weren't re-checked.
- **GM:** the $0 fills are a configurator behaviour (the total doesn't move), so there's no printed price to compare.

## 4. Porsche Paint to Sample

Added on **all 61 Porsche rows**, Standalone, from configurator.porsche.com (en-US). It was "not offered" nowhere.

| Model (year) | Trims | Price |
|---|---|---|
| 911 (2027), Carrera, T, S, 4S, GTS, 4 GTS, Cabriolet and Targa versions; Spirit 70 (2026) | 15 | $15,050 |
| 911 GT3, Turbo S, Turbo S Cabriolet (2027) | 3 | $17,210 |
| 911 GT3 S/C (2027) | 1 | $24,460 |
| Taycan (2027) | 7 | $13,870 |
| Panamera (2027) | 7 | $13,870 |
| Macan Electric (2027) | 5 | $13,870 |
| Cayenne Electric, Cayenne Coupe Electric (2027) | 3 + 3 | $13,870 |
| Macan, gas (2026) | 4 | $13,620 |
| Cayenne, Cayenne Coupe (2027) | 6 + 7 | $13,620 |

## 5. 2027 Charger two-door vs four-door

From Dodge's Build & Price data (`dodge.com/hostd/api/cvd/CUD202714/CUD202714_CVD.json`, "starting at" MSRP, destination $1,995), re-read 2026-10-16:

| Trim | Two-door | Four-door | Four-door premium |
|---|---|---|---|
| R/T | $49,995 | $51,995 | +$2,000 |
| R/T Plus | $56,285 | $58,285 | +$2,000 |
| Scat Pack | $55,845 | $57,845 | +$2,000 |
| Scat Pack Plus | $60,840 | $62,840 | +$2,000 |
| Daytona Scat Pack Plus (EV) | $77,490 | $77,990 | +$500 |

Super Bee Launch Edition isn't on Dodge's 2027 Build & Price.

**Configurator data:**
- **Already right; no change.** The 2027 gas rows' "4-Door AWD" items are +$2,000, and the Daytona's is +$500.
- After the mapping step, each 2027 Sedan row carries the difference as a standard item, so the configurator shows it:
  - R/T, R/T Plus, Scat Pack, Scat Pack Plus: `4-door sedan body | Standard | 2000`;
  - Daytona Scat Pack Plus: `4-door sedan body | Standard | 500`.
- The Coupe rows carry no body item.

**Matchmaker v21:**
- The 2027 gas sedans now carry +$2,000; before, they were priced the same as the coupes.
- `scripts/build-matchmaker-v21.py` now has one per-trim premium table, and the build fails on a 2027 Charger sedan trim without an entry.

| 2027 Charger Sedan | MSRP before | MSRP after | True starting price before → after |
|---|---|---|---|
| R/T | $49,995 | $51,995 | $51,990 → $53,990 |
| R/T Plus | $54,990 | $56,990 | $56,985 → $58,985 |
| Scat Pack | $54,995 | $56,995 | $56,990 → $58,990 |
| Scat Pack Plus | $59,990 | $61,990 | $61,985 → $63,985 |
| Daytona Scat Pack | $72,995 | unchanged | $74,990 |
| Daytona Scat Pack Plus | $77,990 | unchanged | $79,985 |

v21 is still 2,282 rows; it now differs from v20 in 6 Charger lines plus the appended Wave 3 rows. It's raw only: not scored, imported or promoted.

**Found while checking, not changed (decisions 3 and 4):**
- **2027 gas coupe base prices differ from Dodge's:**
  - Scat Pack: v20 $54,995, Dodge $55,845;
  - Scat Pack Plus: v20 $59,990, Dodge $60,840;
  - R/T Plus: v20 $54,990, Dodge $56,285. Cowork notes Dodge's R/T Plus "starting at" includes a priced item in the default build.
  - R/T and the Daytona Scat Pack Plus match.
- **No plain 2027 Daytona Scat Pack:** Dodge's 2027 Build & Price lists only the Daytona Scat Pack Plus. The first re-pass reported a plain Scat Pack at $72,495 / $72,995, and v20/v21 have 2027 rows for it.

## 6. Mapping dry run (prices files + engine facts + held models)

| File | Rows in → out | Collisions | Held | Corrections | Left unchanged (re-pass → prices) |
|---|---|---|---|---|---|
| bmw-mini | 72 → 72 | 0 | 0 | 4 | 0 → 0 |
| cadillac-lincoln | 95 → 98 | 0 | 0 | 4 | 13 → 13 |
| dodge-chrysler-alfa | 41 → 52 | 0 | 0 | 0 | 8 → 8 |
| fiat | 2 → 2 | 0 | 0 | 0 | 0 → 0 |
| genesis-volvo | 89 → 87 | 0 | 2 (EX40) | 0 | 23 → 23 |
| gmc-buick | 81 → 81 | 0 | 0 | 0 | 265 → 265 |
| lexus-acura | 113 → 113 | 0 | 0 | 0 | 3 → 3 |
| maserati | 13 → 10 | 0 | 3 (MCPURA, MCPURA Cielo, GT2 Stradale) | 0 | 0 → 0 |
| mercedes | 61 → 61 | 0 | 0 | 0 | 0 → 0 |
| mitsubishi-polestar-lucid | 33 → 33 | 0 | 0 | 0 | 16 → 16 |
| porsche-landrover | 113 → 113 | 0 | 0 | 0 | 23 → 23 |
| vw-audi | 90 → 90 | 0 | 0 | 3 | 42 → 42 |
| **Total** | **803 → 812** | **0** | **5** | **11** | **393 → 393** |

The prices pass didn't touch anything the mapping step reads. Each file's list of untouched items is identical to the re-pass run's. (393, not the earlier 391, because this run includes the known corrections and the held models.)

## 7. Unresolved, and decisions for Brett

1. **GM $0 fills (67 items: GMC 57, Buick 3, Cadillac 7).** They're $0 only because GM's total doesn't change when the item is added. Keep them as $0, or put them back to blank ("Price not confirmed")? This includes **Night Vision on the 2026 Escalade / ESV Platinum and V rows (6)**, which is probably standard equipment shown as an option.
2. **About 230 GM "Standalone" items are really package or engine content.** Examples: Rear Camera Mirror, alternators, diesel block heaters, Winter Grille Cover, Exhaust Brake, GVWR. Re-tag them Package-only in the later Cowork pass? Until then they import as "Price not confirmed".
3. **2027 Charger gas coupe base prices** (section 5): update v21 to Dodge's 2027 starting prices (Scat Pack and Scat Pack Plus +$850; R/T Plus to be checked), or leave them?
4. **2027 Daytona plain Scat Pack:** Dodge's 2027 Build & Price doesn't list it. Hold the two 2027 v21 rows, or ask Cowork to settle it in the later pass (it's already on that list as a missing configurator row)?
5. **2026 Cadillac Vistiq:** no longer on cadillac.com (12 items, 4 rows). Add it to `data/held-models.json`?
6. **Land Rover White contrast / Bespoke roofs (36):** unpriced and not offered on the default US builds. Keep them as "Price not confirmed", or leave them out at import?
7. **Smaller items, for the later pass:**
   - VW ID.4 Pro 2026 20-in. AWD wheel: mark it Unavailable?
   - The 4 Audi paints Cowork couldn't select;
   - Audi name differences: Nimbus Gray "pearl effect", Bedford Green "metallic";
   - Lincoln Dynamic Handling Package: priced on the Aviator Black Label, unpriced on the Reserve;
   - 2027 Acadia AT4 18-in. Gloss Black wheels: GM lists $2,495, but the file has them Package-only;
   - Sierra 1500 Pro alternator and AT4/AT4X block heater: GM asks to confirm a change.
8. **Maserati:** all 299 blanks are still unpublished (the 19 on priced trims, the 12 packages, and the held MCPURA, Cielo and GT2 Stradale).

## 8. Brett's decisions (2026-10-16)

1. **GM $0 fills: all 67 go back to blank.** A configurator total not changing isn't the manufacturer saying "no charge".
   - Done as 67 logged price corrections in the mapping step (branch `configurator-mapping`, `1129986`, tested); the prices files stay as received.
   - Pass 3 marks any that are really standard equipment (Night Vision on the Escalade/ESV Platinum and V first) as Standard, and writes the rest blank itself. The corrections are then retired.
2. **The ~230 GM package/engine-content items** are re-tagged Package-only in pass 3.
3. **2027 gas Charger coupes in v21 take Dodge's prices, and sedans +$2,000** (`b818a2b`). True starting prices are MSRP + $1,995.

   | Trim | Coupe | Sedan |
   |---|---|---|
   | R/T | $49,995 (unchanged) | $51,995 |
   | R/T Plus | $56,285 | $58,285 |
   | Scat Pack | $55,845 | $57,845 |
   | Scat Pack Plus | $60,840 | $62,840 |

4. **The 2027 plain Daytona Scat Pack is held** (`data/held-models.json`, trim + model year) until pass 3 settles it.
   - It removes the 2 v21 rows.
   - The configurator files have no 2027 row for it, so nothing is held there today; the entry also covers one if pass 3 adds it.
5. **The 2026 Cadillac Vistiq is held; 2027 is not.**
   - Held-model entries may now name a `trim` and/or a `model_year`, and an unknown key is refused (tested).
   - It removes 4 configurator rows and 4 v21 rows (2026 Luxury, Sport, Premium Luxury, Platinum).
6. **Land Rover White contrast / Bespoke roofs** stay as "Price not confirmed".
7. **The smaller items go to pass 3:** `docs/research/cowork-pass3-prompt-2026-10-16.md` (drafted, not started).

**After these:**
- v21 is 2,276 rows (2,260 from v20 + 16 Wave 3).
- Dry run on the prices files: 803 → 808 rows, 0 collisions, 9 held rows, 78 corrections (67 of them the GM prices), and 393 items left unchanged.
