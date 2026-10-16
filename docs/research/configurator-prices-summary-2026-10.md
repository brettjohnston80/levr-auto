# Configurator re-pass, section D: prices summary (2026-10-16)

New files only: 12 `data/<stem>-configurator-prices-2026-10.csv` and 12 `docs/research/<stem>-configurator-prices-notes-2026-10.md`. Inputs (the `-repass-` files) untouched. Official US manufacturer configurators only; no MarketCheck, no paid APIs, no cookie banners accepted.

Every output keeps the input's header, row count and order, 18 fields per row, cell format and line endings. The import parser (`configurator-parse.ts`, `blankPriceUnknown`) reads every file with 0 dropped packages and 0 forced-unavailable; option totals are unchanged except Porsche (+61 = the Paint to Sample options).

## Counts

| Group | Make | Blank prices in | Filled | Package-priced | Still blank | Options added |
|---|---|---|---|---|---|---|
| gmc-buick | GMC | 334 | 57 | 1 | 276 | 0 |
| gmc-buick | Buick | 7 | 3 | 0 | 4 | 0 |
| cadillac-lincoln | Cadillac | 105 (104 + 1 package) | 7 | 0 | 98 | 0 |
| cadillac-lincoln | Lincoln | 47 (37 + 10 packages) | 0 | 0 | 47 | 0 |
| porsche-landrover | Land Rover | 40 (36 roofs) | 0 | 4 | 36 | 0 |
| porsche-landrover | Porsche | 0 | 0 | 0 | 0 | 61 (Paint to Sample) |
| vw-audi | Audi | 157 (20 paints) | 16 | 137 | 4 | 0 |
| vw-audi | Volkswagen | 31 (1 wheel) | 0 | 30 | 1 | 0 |
| maserati | Maserati | 299 (19 on priced trims + MCPURA/Cielo/GT2 + 12 packages) | 0 | 0 | 299 | 0 |
| dodge-chrysler-alfa | Dodge / Chrysler / Alfa Romeo | 94 / 10 / 7 | 0 | all | 0 | 0 |
| confirm-only | Mercedes, BMW, MINI, Lexus, Acura, Genesis, Volvo, Mitsubishi, Polestar, Lucid, Fiat | 0 Standalone; 183 Package-only | 0 | 183 | 0 | 0 |

"Package-priced" = a package-only feature whose package has a price in `package_definitions` (kept blank by rule). Blank availabilities (Volvo, Mitsubishi, Lucid, Maserati) were not touched.

## What was filled, and on what basis

- **GMC 57, Buick 3, Cadillac 7: all $0.** Each blank item was added on its own to the row's own build in GM's configurator (gmc.com / buick.com / cadillac.com feed, ZIP 67201). Filled only when adding it changed nothing else; the configurator's total stayed the same, so it's written as 0. Mostly front license plate brackets/kits, some rubber floor coverings, HUMMER EV skid plate / approach shield / spare, black emblems on some Sierra HD trims, Escalade Platinum/V-Series Night Vision, CT5-V Blackwing "front splitter, none".
- **Audi 16:** A8 2027 five paints $0; RS 6 Avant 2026 Nardo Gray $0 and five paints $595; RS e-tron GT 2026 Arkona White $0 and four paints $595. Read from audiusa.com's configurator with each paint selected.
- **Porsche Paint to Sample added on all 61 rows** (configurator.porsche.com en-US, Standalone): 911 Carrera/T/S/4S/GTS/Targa families and Spirit 70 $15,050; 911 GT3 and Turbo S $17,210; GT3 S/C $24,460; Taycan, Panamera, Macan Electric, Cayenne Electric $13,870; Macan (gas) and Cayenne / Cayenne Coupe $13,620.

## Why most GM/Lincoln/Land Rover blanks stay blank

- **GM (GMC 276, Cadillac 98):** the configurator has no stand-alone price for these items. Adding one pulls in or removes other options (a package, an engine, a paint), or the configurator says another choice is needed first. Many are listed as Standalone in the file but are really package or engine content (Rear Camera Mirror, alternators, block heaters on diesel, Winter Grille Cover, Exhaust Brake, GVWR). Availability was not changed.
- **2026 Vistiq (12 items):** no longer on cadillac.com's configurator ("Unsupported Vehicle").
- **Lincoln (47):** lincoln.com shows none of these themes, packages or features with a price.
- **Land Rover (36):** the White contrast roof and the Defender Bespoke roofs aren't offered on the default builds of these trims on the US configurator, so there is no price to read.
- **Maserati:** unchanged; MCPURA, MCPURA Cielo, GT2 Stradale still unpriced in the US.

## Charger 2027 two-door vs four-door (report only)

| Trim | Two-door | Four-door | Premium |
|---|---|---|---|
| R/T | $49,995 | $51,995 | +$2,000 |
| R/T Plus | $56,285 | $58,285 | +$2,000 |
| Scat Pack | $55,845 | $57,845 | +$2,000 |
| Scat Pack Plus | $60,840 | $62,840 | +$2,000 |
| Daytona Scat Pack Plus (EV) | $77,490 | $77,990 | +$500 |

Destination $1,995. Source: dodge.com Build & Price data (`/hostd/api/cvd/CUD202714/CUD202714_CVD.json`). The gas Charger premium is still $2,000 for 2027, so the file's "4-Door AWD +2000" items are already right. Super Bee Launch Edition is not on Dodge's 2027 configurator.

## Unresolved / needs Brett's decision

1. **$0 fills from GM's configurator.** 67 GM items are written as 0 because adding them leaves GM's total unchanged. GM shows no "$0" label on them. OK to keep, or should they go back to blank?
2. **GM "Standalone" items that are really package or engine content.** About 230 GMC/Cadillac items can't have a price because of this. Re-tag them Package-only in a later pass (not done here; availability changes weren't allowed)?
3. **Night Vision $0** on the 2026 Escalade / ESV Platinum and V-Series rows (6): the configurator total doesn't change. Probably standard equipment shown as an option; check before import.
4. **Borderline items left blank:** Buick Encore GX AUX heater (+$395, but GM asks to confirm a change); Sierra 1500 Pro Alternator 220 amps and AT4/AT4X engine block heater ($0, same confirmation). 2027 Acadia AT4 18-in. Gloss Black wheels: GM lists $2,495, but the file has them as Package-only, so they stay blank.
5. **Audi paints Audi wouldn't let me select** (RS 6 Avant Sebring Black; RS e-tron GT Ascari Blue, Progressive Red, Bedford Green). Also two Audi name differences (Nimbus Gray "pearl effect", Bedford Green "metallic").
6. **VW ID.4 Pro 2026:** the 20-in. AWD wheel isn't offered on the RWD Pro. Mark it Unavailable in a later pass?
7. **Land Rover White contrast roof / Bespoke roofs:** price unpublished; the White roof may only appear with certain paints. Keep them, or drop them at import?
8. **Lincoln Dynamic Handling Package:** $2,500 on Aviator Black Label but unpriced on Reserve (needs Reserve II). Not copied across.
9. **2026 Vistiq:** its configurator is gone. Hold the 4 rows from promotion?
