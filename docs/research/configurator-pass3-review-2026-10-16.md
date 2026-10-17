# Configurator pass 3 review (2026-10-16)

Read-only review of Cowork's run of `cowork-pass3-prompt-2026-10-16.md`. The files are committed as received (`4f1c5c5`, on origin since `47fe965`).

## 1. Files

All 16 outputs are present:
- 7 × `data/*-configurator-pass3-2026-10.csv`;
- 7 notes files;
- `data/configurator-engine-facts-pass3-2026-10.csv` (3 rows);
- `docs/research/configurator-pass3-summary-2026-10.md`.

Every Progress line marks every make "done". Nothing is unfinished.

## 2. Integrity (cell by cell against each prices input)

- Every file keeps the same header, 18 fields per row, the same line endings and well-formed option cells.
- Every existing row is still present, in its original order. bmw-mini and mitsubishi-polestar-lucid are byte-identical to their inputs.
- **Nothing changed outside the brief.** Per file:
  - **gmc-buick:**
    - 43 feature re-tags (Standalone → Package-only, with the package or engine named);
    - 59 + 1 prices back to blank;
    - the Acadia AT4 wheel set to Standalone $2,495;
    - 14 engine-choice entries added to package_definitions (Cowork's question 1 below).
  - **cadillac-lincoln:**
    - 21 re-tags to Package-only;
    - 1 to Standard (2026 CT5 Sport red calipers);
    - 7 prices back to blank.
  - **dodge-chrysler-alfa:** the 2026 Durango GT split (below). Every other row is identical.
  - **mercedes:** the 2027 EQE 320 split (below). Every other row is identical.
  - **vw-audi:**
    - ID.4 Pro 20-in. AWD wheel set to Unavailable;
    - 3 Audi paint prices;
    - 2 renames (RS e-tron GT 2026 "Nimbus Gray Pearl Effect", "Bedford Green Metallic", at $595).
- Every changed row has its source URL in `sources`.

**The split rows, each replacing the one row in place:**

| Row | Drivetrain | Engine | Notes |
|---|---|---|---|
| Durango GT 2026 | RWD or AWD (+$2,000) | 3.6L V6 Pentastar | Blacktop $2,595, Trailer-Tow IV $1,195; the HEMI items removed |
| Durango GT HEMI 2026 (new) | AWD | 5.7L HEMI V8 | Blacktop $2,045, Trailer-Tow IV $1,295; GT-only wheels Unavailable |
| EQE SUV EQE 320+ 2027 | RWD | Single-motor electric, 315 hp | `eqe320x` page |
| EQE SUV EQE 320 4MATIC 2027 | AWD | Dual-motor electric, 315 hp combined | `eqe320x4` page |

## 3. Results

- **GM re-tags: 66** (GMC 44, Cadillac 22) Package-only, plus 1 to Standard. 168 were left unchanged and logged (GMC 118, Cadillac 49, Buick 1) because adding the item pulls in other loose options or changes the engine to something not listed.
- **The 67 $0 items: all back to blank.** None is in GM's standard-feature list for its build, and GM publishes no $0 for any of them.
  - That includes **Night Vision on the 6 Escalade / ESV Platinum and V rows**, checked first.
  - Pass 3 writes these blanks itself, so the mapping step's 67 price corrections are retired (`30fe05c`, tested).
- **2027 plain Daytona Scat Pack: not confirmed.** Stellantis' December 2025 release gives $72,495, but Dodge's 2027 configurator offers only the Scat Pack Plus. No row was added.
- **BMW X5 40 sDrive / 50e / 750e (2027) and Eclipse Cross SE Pano / SEL Touring (2026): not added.** Neither BMW USA's model list nor Mitsubishi's 2026 configurator has them.
- **Smaller items:**
  - VW ID.4 Pro 20-in. AWD wheel → Unavailable.
  - Audi paints:
    - RS e-tron GT Ascari Blue, Progressive Red, Bedford Green: $595;
    - RS 6 Avant Sebring Black: $1,095.
  - Audi names fixed (above).
  - Lincoln Dynamic Handling Package: already right. Premiere not offered; Reserve only with Reserve II, unpriced; Black Label $2,500.
  - Buick Encore GX AUX heater: left unchanged (GM asks to confirm a change it doesn't explain).

**Spot-checks against the sources:**
- **Dodge's 2026 Durango feed** (`CUD202611_CVD.json`) matches the split: GT RWD $38,995, GT AWD $40,995, GT AWD HEMI V8 $43,675. It also lists a separate "GT Plus AWD HEMI V8" (Cowork's question 3).
- **Mercedes-Benz USA's EQE SUV page** shows both $64,950 and $67,450.
- **gmc.com, audiusa.com and vw.com** refused or didn't render for automated reads, so the GM re-tags, the Audi paints and the ID.4 wheel weren't re-checked.

## 4. Effects

- **Held models:** no change.
  - The 2027 plain Daytona Scat Pack stays held, since it isn't confirmed.
  - The 2026 Vistiq (4 rows), Volvo EX40 and Maserati MCPURA / Cielo / GT2 Stradale stay held too.
- **Matchmaker v21:** no change needed.
  - v21 already has the EQE SUV split under the same names and prices (EQE 320+ $64,950, EQE 320 4MATIC $67,450).
  - v21 already has the 2026 Durango GT and GT HEMI V8 as separate rows.
  - None of the "missing" rows were added, so nothing to add.
  - Noticed, not changed: v21's 2026 Durango MSRPs look like they include the $1,995 destination (GT $40,990 vs Dodge's $38,995 RWD).
- **Known corrections:** the 67 GM price reverts are retired. The other 11 still apply and are still needed:
  - MINI SE ALL4 × 4;
  - Audi "performance" × 3;
  - Cadillac Escalade/ESV "V" × 4.

## 5. Mapping dry run on the final inputs

The inputs are pass 3 for its 7 files and the prices files for the other 5, with both engine-facts files and `data/held-models.json`.

| File | Rows in → out | Collisions | Held | Corrections | Left unchanged (prices → final) |
|---|---|---|---|---|---|
| gmc-buick | 81 → 81 | 0 | 0 | 0 | 265 → 265 |
| cadillac-lincoln | 95 → 94 | 0 | 4 (2026 Vistiq) | 4 | 13 → 13 |
| dodge-chrysler-alfa | 42 → 53 | 0 | 0 | 0 | 8 → 7 |
| bmw-mini | 72 → 72 | 0 | 0 | 4 | 0 → 0 |
| mercedes | 62 → 62 | 0 | 0 | 0 | 0 → 0 |
| mitsubishi-polestar-lucid | 33 → 33 | 0 | 0 | 0 | 16 → 16 |
| vw-audi | 90 → 90 | 0 | 0 | 3 | 42 → 42 |
| porsche-landrover | 113 → 113 | 0 | 0 | 0 | 23 → 23 |
| lexus-acura | 113 → 113 | 0 | 0 | 0 | 3 → 3 |
| genesis-volvo | 89 → 87 | 0 | 2 (EX40) | 0 | 23 → 23 |
| maserati | 13 → 10 | 0 | 3 | 0 | 0 → 0 |
| fiat | 2 → 2 | 0 | 0 | 0 | 0 → 0 |
| **Total** | **805 → 810** | **0** | **9** | **11** | **393 → 392** |

**GM:** pass 3 didn't change GM's engine lines, so the 265 GMC/Buick items left unchanged are all rule 4 engine lines.
- 193 of them are the GMC cab/bed lines ("Crew Cab, Short Bed, 4WD, 6.2L EcoTec3 V8 …"), which shoppers would see as engine choices.
- The rest have no published horsepower (gmc.com refused automated reads).

## 6. Unresolved, and decisions for Brett

1. **The 14 engine-choice entries Cowork added to package_definitions** (GMC Sierra; named exactly like the engine choice, with its price and the linked items as contents). They let the 31 engine-linked items survive import as Package-only. Keep them, or drop them and leave those items "Price not confirmed"?
2. **Package links the configurator adds, though the package contents don't name the item.** The least certain is six 2026 Cadillac XT5 items linked to the Driver Assist Package.
3. **Durango GT Plus 2026** also mixes the V6 and HEMI; Dodge's feed lists "GT Plus AWD HEMI V8" separately. Split it in a later pass?
4. **GMC cab/bed engine lines (193)** stay as received. A later pass or a mapping rule could separate cab/bed from the engine. Needed before GMC is promoted?
5. **GM item names containing " -- "** (7 Sierra HD rows). That's GM's name, and the parser reads it fine. Leave it?
6. **v21 2026 Durango MSRPs** appear to include destination. Check and fix in v21?
