# Genesis + Volvo configurator research: notes (2026-10-11)

This file goes with `data/genesis-volvo-configurator-full-2026-10.csv`. The CSV has 89 rows, one per trim, in the same 18 columns as the Toyota file. It replaces the September files `genesis-configurator-full-2026-09-16` and `volvo-polestar-configurator-full-2026-09-16`. Polestar is now covered by the Mitsubishi/Polestar/Lucid prompt instead.

## Scope

**Genesis: 62 rows**
- **2026 (7 models, 31 rows):**
  - G70: 4 trims
  - G80: 5 trims
  - G90: 3 trims
  - GV60: 3 trims
  - GV70: 6 trims
  - GV80: 7 trims
  - GV80 Coupe: 3 trims
- **2027 (8 models, 31 rows):**
  - G70: 4 trims
  - G80: 5 trims
  - GV60: 3 trims, including the Magma
  - GV70: 6 trims
  - Electrified GV70: 3 trims
  - GV80: 7 trims
  - GV80 Coupe: 3 trims

**Volvo: 27 rows** (Volvo's configurator offers one model year per model)
- **2026:**
  - XC40: Core, Plus, Ultra, Ultra Black Edition
  - EX40: Plus, Ultra Black Edition
  - XC90: Core, Plus, Ultra, T8 Core, T8 Plus, T8 Ultra
  - EX90: Plus, Ultra
  - V60 Cross Country: Plus, Ultra (2026 is its final model year, but it is still live in the configurator)
- **2027:**
  - XC60: Core, Plus, Ultra, T8 Plus, T8 Ultra, T8 Ultra Black Edition
  - EX30: Plus, Ultra
  - EX30 Cross Country: Ultra
  - EX60: Plus, Ultra (new model, on sale with a live configurator)

**Excluded.** None of these have a live US configurator on 2026-10-11:
- 2026 Electrified GV70. Edmunds still lists it and says it is effectively sold out.
- 2026 GV60 Magma (only 2027 is configurable)
- GV90 (arrives early 2027 as a 2028 model)
- Electrified G80
- 2026 XC60 and its T8 Core and T8 Polestar Engineered trims (Volvo now builds only the 2027 XC60)
- 2026 EX30 (Volvo builds the 2027)
- XC90 Ultra Dark
- ES90
- S60, S90 and EC40

## Sources

**Genesis**
- genesis.com/us/en/build-and-price/{year}/{model}. The page embeds its own vehicle data, which was read in the browser. It gives every trim and drivetrain version, the base MSRP, horsepower, range, seats, paint with prices, interiors, the paint-to-interior pairings and the destination charge.
- Each trim's "View All Features" panel is Genesis's complete standard-feature list. Seat material, wheels, roof and every common feature come from it.
- Genesis trims are fixed equipment levels: there are no factory packages or standalone options, only paint, interior and (on some trims) RWD/AWD.
- Paint the data feed left unpriced (Alta White, Vatna Gray) shows as $0 on the configurator screen; spot-checked on the 2026 G70.

**Volvo**
- volvocars.com/us/build/{model}. The page's own data was read for every edition and level. It gives the level price, powertrains with price differences, paint, wheels, interiors, seat choice and factory options with package contents.
- Volvo shows each level's highlighted features, not a full standard-equipment list. Standard features therefore come from those highlights plus Edmunds' features-specs and trims pages.

**Edmunds cross-check**
- edmunds.com/{make}/{model}/{year}/ for every model-year, plus features-specs pages for every Volvo level Edmunds has. Each row's `sources` column lists the URLs.

## Discrepancies and findings

- **Prices match exactly.** Every Genesis base MSRP matches Edmunds' ex-destination MSRP, and every Volvo price matches Edmunds' price including destination.
- **Volvo prices include destination; Genesis prices do not.** Each row's `discrepancy_notes` gives the base MSRP without destination and the destination charge:
  - Genesis destination: $1,395 to $1,595, depending on model and year.
  - Volvo destination: $1,395; V60 Cross Country $1,295.
- **Edmunds lists trims Volvo no longer builds.** XC90 Ultra Dark, 2026 XC60 T8 Core and T8 Polestar Engineered are not in Volvo's live configurator, so they are not included.
- **Settled from September:**
  - **EX90 horsepower:** Volvo lists the Twin Motor Performance at 670 hp, so that figure was real. The Twin Motor is 449 hp. The new Single Motor Plus is 329 hp.
  - **GV60 range:** Genesis's data gives 306 / 282 / 267 / 252 miles for RWD / AWD / Advanced or Prestige / Performance, with the same figures for 2026 and 2027 where those trims exist.
  - **GV80 seating:** 2026 base, Select and Prestige Black have 5 seats; Advanced and Prestige have 7. For 2027, every GV80 except the Prestige Black has 7 seats.
  - **EX30 structure:** Volvo builds Plus (Single Motor Extended Range or Twin Motor Performance, +$6,000), Ultra (Twin Motor Performance only) and the Cross Country edition (Ultra only).
- **Drivetrain-only differences on Genesis.** On the 2026 G70 2.5T, 2027 G70 2.5T and 2027 GV80 2.5T, the heated steering wheel comes only with AWD. It is marked Unavailable (the base RWD version lacks it) and noted in each row.
- **EX30 Cross Country heated steering wheel.** Edmunds lists it as standard, but Volvo still offers the $500 Climate Package on that trim without listing its contents. Left blank.
- **EX60.** Edmunds has only a first-drive article. Its prices match Volvo's, but there is no feature list to cross-check.

## Format decisions

- **Item format.** Every option-column item is `name | availability | price | package`.
  - Price is a plain USD number with no $ sign, matching the Nissan/INFINITI file.
  - Availability is Standard, Standalone, Package-only or Unavailable.
  - **Blank availability** means neither source confirms the item. The importer reads it as "Not confirmed". It is used only for Volvo items such as heated front seats on the EX30 and EX60, and power liftgate on the XC40, EX90, EX60 and V60 Cross Country.
- **Package references.** Every Package-only item names a package in that row's `package_definitions`. A validator checked all 89 rows (four fields per item, allowed availability values, numeric prices, package references) and found 0 errors.
- **One row per trim.**
  - Genesis RWD/AWD versions and Volvo powertrain choices (B4/B5, B5/B6, Single/Twin Motor, P6/P10) are in `drivetrain_engine_variants`, priced as the difference from the base version.
  - Volvo's T8 plug-in hybrids are their own rows ("T8 Plus" and so on) with fuel_type PHEV, because Volvo builds them on separate pages at different prices.
- **Paint and interiors.**
  - All paint and interior choices are Standalone with their surcharge, or 0.
  - Genesis interior names add the trim's seat material from Genesis's feature list (for example "Obsidian Black Leatherette").
  - Genesis restricts some paint-and-interior combinations; the lists show everything offered on the trim.
- **Left out of the Volvo rows:**
  - Dealer or port-installed accessories (marked * by Volvo), mud flaps, the Home Charging Bundle, the CCS1-to-NACS adapter and complimentary maintenance.
  - The one exception is accessory wheels Volvo offers at the wheel step (22-inch XC90, 21-inch XC40 Black Edition). They are included and noted.
- **Volvo's two cold-weather packages.** The Climate package and the Climate Pro package both include the heated steering wheel. The Climate package is named as its source, and the row notes say so.
