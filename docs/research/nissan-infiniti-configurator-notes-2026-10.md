# Nissan + INFINITI configurator research: notes (2026-10-10)

This file goes with `nissan-infiniti-configurator-full-2026-10.csv`. The CSV has 84 rows, one per trim, in the same 18 columns as the Toyota file. It replaces `nissan-infiniti-configurator-full-2026-09-16.csv`.

## Scope

**Nissan: 74 rows**
- **2026 (11 models):**
  - Kicks: 3 trims
  - Sentra: 4 trims
  - Altima: 4 trims (SV, SV Special Edition, SR, SR Midnight Edition)
  - Rogue: 5 trims (Nissan calls it the "2026.5" Rogue; recorded as 2026)
  - Rogue Plug-In Hybrid: 2 trims
  - Murano: 3 trims
  - Pathfinder: 4 trims
  - Armada: 6 trims
  - Frontier: 5 trims
  - Z: 4 trims (including the Heritage Edition)
  - LEAF: 3 trims
- **2027 (7 models already on sale):**
  - Kicks: 4 trims (adds Rock Creek)
  - Sentra: 5 trims (adds SR Midnight Edition)
  - Rogue: 5 trims
  - Murano: 3 trims (SL, Dark Armor, Platinum)
  - Armada: 5 trims (SL, Platinum, PRO-4X Premium, Platinum Reserve, NISMO)
  - Frontier: 6 trims (adds Sport Edition)
  - Z: 3 trims

Nissan's live Build & Price offers 2026 models through its "previous year" pages and 2027 models as current. Where both years are live, each year has its own rows.

**INFINITI: 10 rows (all 2027)**
- QX60: LUXE, SPORT, AUTOGRAPH
- QX65: LUXE, SPORT, AUTOGRAPH
- QX80: PURE, LUXE, SPORT, AUTOGRAPH

INFINITI's configurator has no 2026 or previous-year models.

**Excluded.** None of these appear in Nissan's or INFINITI's live Build & Price on 2026-10-10:
- Versa
- Titan
- Ariya
- Kicks Play
- NV and NV200 commercial vans
- QX50 and QX55
- QX60 PURE
- 2026 Pathfinder S
- 2026.5 Rogue SL
- 2027 Altima, Pathfinder and LEAF (not yet configurable)

## Sources

**Manufacturer data**
- Nissan and INFINITI Build & Price: nissanusa.com/shopping-tools/build-price and infinitiusa.com/shopping-tools/build-price.
  - The pages' own data feed, read in the browser, gives every trim and drivetrain version, the base MSRP, colors and interiors with prices, packages with prices and contents, and dealer accessories.
  - Package dependencies were found by selecting each color, interior and package and recording which packages the configurator then auto-adds.
- Nissan and INFINITI spec and trim-comparison pages, requested with each version's code:
  - Nissan: nissanusa.com/vehicles/.../specs-trims.html?compare=...
  - INFINITI: infinitiusa.com/vehicles/.../models-specs.html?compare=...
  - These are the source for common_features, the standard wheel and tire, roof, seating, transmission and destination charge.

**Edmunds cross-check**
- edmunds.com/{make}/{model}/{year}/ and the .../features-specs/ page for every model-year.
- Each row's `sources` column lists the exact URLs.

**Spot-checked through the live configurator screens** (a separate path from the data feed):
- **2027 Kicks SR FWD:** the configurator screen showed $27,595 and the same color list and prices. The total of $29,170 equals the base price plus the $1,575 destination charge.
- **2026 Frontier SV:** choosing Boulder Gray Pearl auto-included the Dark Armor Package, and the total went to $38,415.

## Format decisions
- **Item format.** Every option-column item is `name | availability | price | package`.
  - Availability is always one of Standard, Standalone, Package-only or Unavailable.
  - **Price is a plain USD number with no $ sign, unlike the Toyota file.** It is the option's MSRP addition. It is blank for Unavailable items and for Package-only features, because the cost sits in the package.
  - A paint color that needs a package keeps its own paint surcharge. Its package is named in the fourth field.
- **Package-only.** Every Package-only item names a package listed in that row's `package_definitions`. A validator checked this for all 84 rows and found 0 errors.
- **Package notes.** `package_definitions` follows the Toyota pattern: `Name | $price | contents: ...`.
  - A note is added when a package is pre-selected on every build of the trim. These $0 packages, such as the Dark Armor Package on Frontier Dark Armor, are treated as standard content.
  - A note is added when a package auto-adds another package.
  - A note is added when a package is offered only on one drivetrain variant.
- **Variant prices.** `drivetrain_engine_variants` lists each version of the trim with its price difference from the cheapest version. Frontier entries include cab and bed (for example "Crew Cab Long Bed, 4x4 | Standalone | 3800").
  - Frontier `seating_configuration` lists the cab choices with their passenger counts.
  - Base MSRP per version and the destination charge are in `confidence_notes`.
- **common_features** uses the same 7 items as the Toyota file.
  - "Leather seating" means genuine leather or semi-aniline only. TailorFit, Prima-Tex and leatherette count as Unavailable.
  - "Power liftgate/trunk" uses the spec sheet's Rear Cargo Door entry.
  - Where AWD or 4x4 versions differ from the base version, `confidence_notes` says how.
- **Dealer accessories.** Accessory wheels and roof crossbars are tagged Standalone with their configurator accessory price, and "(dealer accessory)" appears in the name.

## Discrepancies worth knowing
- **INFINITI prices.** Edmunds is $580–$695 below INFINITI's configurator on the QX60 AUTOGRAPH, the QX65 AUTOGRAPH and every QX80 trim except PURE. Edmunds still lists a QX60 PURE.
- **2026 and 2027 Kicks SR.** Edmunds is $605 below Nissan's configurator. Edmunds also lists a 2027 Kicks S AWD that Nissan does not offer.
- **2026 Pathfinder.** Edmunds still lists an S trim. Its SV is $90 below Nissan's configurator.
- **2027 Rogue.** Edmunds' 2027 page describes a new-generation Rogue Hybrid. Nissan's live configurator shows the gas VC-Turbo Rogue. Treat the 2027 Rogue rows as manufacturer-confirmed only.
- **No Edmunds data yet** for the 2027 Sentra, Armada and Frontier (estimates only), so they could not be cross-checked.
- **Destination charge.** Edmunds' implied destination differs from Nissan's and INFINITI's spec sheets by $30–$50 on several models.
- **2026 LEAF battery.** The configurator says 75 kWh; Edmunds says 72 kWh.
- **Package names Nissan's spec sheets cite but its configurator does not offer:**
  - 2027 Sentra SR "Cold Weather Package (SR)". Mapped to the configurator's All-Weather Package (SR), which lists the same heated features.
  - 2027 Armada SL 4x4 "Dark Armor Package". Left as a note.
- **Pathfinder premium packages.** Their contents begin with "Available Spring 2026", copied from Nissan's own text.

## Known limitations
- **QX65 SPORT.** The package-dependency check failed for three options (Deep Emerald, Mineral Black and the Stone Gray interior). These are tagged from the listing alone and noted in that row.
- **Common features for each trim** come from its cheapest version. Where other versions differ, `confidence_notes` says so.
- **Pipeline.** This is raw research material. It still needs to go through `matchmaker_scoring_pipeline.py` and be imported with `promote = false` before anything is promoted.
