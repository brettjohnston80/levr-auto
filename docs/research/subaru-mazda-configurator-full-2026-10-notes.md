# Subaru + Mazda configurator re-research — notes (2026-10-10, browser-verified)

Companion to `subaru-mazda-configurator-full-2026-10.csv`: 118 rows, the same 18 columns as the Toyota CSV, one row per trim per model year. It supersedes the Sept 16 Subaru and Mazda CSVs, whose option columns were prose.

## Format
- Every option column is a list of `name | availability | price | package` items separated by ` ;; `. Availability is one of Standard, Standalone, Package-only or Unavailable. Price is a plain number or blank. Standard items are `0`. Package-only and Unavailable items have a blank price.
- Every Package-only item's package name matches a package in `package_definitions` (`name | price | contents: a, b, c`).
- `common_features` uses the same 12 names in the same order on every row: Leather seating, Heated front seats, Heated rear seats, Ventilated front seats, Heated steering wheel, Power liftgate/trunk, Adaptive cruise control, Wireless phone charging, Moonroof, 360-degree camera, Head-up display, Premium audio.
- The file was run through the repo's own `src/lib/configurator-parse.ts` (with `blankPriceUnknown`):
  - 2,855 options parsed: 1,219 standard, 888 standalone, 48 package-only, 700 unavailable.
  - 0 package references failed to resolve. 0 availabilities were matched by prefix only.
  - 24 items have a deliberately blank availability because the value couldn't be confirmed. The parser treats them as unavailable. Each row's `confidence_notes` explains its blanks. The list is under Known gaps below.
- `confidence_notes` starts with the base MSRP and destination charge, because the schema has no price column. It ends with a "Browser verification" sentence listing what was checked against the live configurator and anything changed as a result.

## Scope
- **Subaru (63 rows):**
  - 2026 only: Crosstrek 7, Impreza 2, Forester 10, Outback 6, WRX 5, Solterra 5.
  - 2026 and 2027: Ascent 5+5, BRZ 2+2, Trailseeker 4+4, Uncharted 3+3.
  - Subaru's configurator lists 2027 for Ascent, BRZ, Trailseeker and Uncharted.
- **Mazda (55 rows):** 2026 only, because the Build & Price feed lists no 2027 models.
  - Mazda3 11 (sedan 5, hatchback 6), CX-30 8, CX-5 5, CX-50 10 (including 3 Hybrid), CX-70 7 (including 2 PHEV), CX-90 9 (including 3 PHEV), MX-5 Miata 3, MX-5 Miata RF 2.
- **Excluded:**
  - Subaru Legacy (discontinued after MY2025).
  - WRX and BRZ Series.Yellow: on Edmunds and in press releases, but not in the live configurator.
  - MY2025 carryover stock that Subaru's configurator still shows.
  - Dealer and port accessories and accessory bundles, such as Subaru "Popular/Convenience/Mirror Package #", Ascent's accessory wireless charger, and the Mazda Weather, Cargo, Accent, Apex and Appearance packages. Each affected row's notes name them.

## Sources and method
- **Subaru — the configurator's own data.** subaru.com Build & Price reads JSON services:
  - lineup: `subaru.com/services/vehicles/models/basicdata`
  - trim lists: `/services/vehicles/trims/<year>/<model code>`
  - per-trim detail: `/services/vehicles/trim/<year>/<model code>/<trim code>` (MSRP, transmissions, option packages with prices and contents, colors with prices and interior pairings, feature groups)

  The first pass read these through a page fetch that cut long responses off. The second pass read every trim's full response in Chrome. All 61 configurator trim codes, which make up the 63 rows, were diffed automatically for exterior colors and paint prices, package prices, and the 12 common features.
- **Mazda — the configurator's own data.** Mazda's Build & Price app reads two feeds:
  - `mazdausa.com/api/bp/ts?m=<model code>` (trims)
  - `mazdausa.com/api/bp?m=<model code>&t=<trim code>` (base price, destination, drivetrain, transmissions, exterior colors with prices, interiors with prices, factory packages, and the per-trim option tree)

  Both were read in Chrome for all 12 model codes. Every Mazda row's base MSRP, drivetrain, colors, paint prices, interiors and packages were diffed against them. The first pass had used mazdausa.com pages, Mazda's newsroom and Edmunds, because the feed couldn't be reached without a browser.
- **Mazda feature availability** (heated seats, HUD, etc.) isn't in Mazda's configurator feed. It still comes from mazdausa.com trim pages, Mazda's releases and Edmunds, and each row says so.
- **Edmunds** (`edmunds.com/<make>/<model>/<year>/features-specs/`, `/trims/` and per-style pages) was the cross-check for every model. Manufacturer data won wherever they disagreed.

## What the browser verification changed
- **Subaru:**
  - Paint prices that had been left blank are now confirmed: Forester Dark Mahogany Pearl $0 and Touring Hybrid two-tones $495; Outback Premium Sapphire Blue $0; 2027 Ascent Limited/Touring Magnetite Gray $0.
  - Missing colors added: Outback Limited XT Sapphire Blue Pearl, and 2026 Uncharted GT Coastal Wolf Gray Two Tone ($970).
  - Outback Limited and Limited XT wireless charging confirmed Standard.
  - Forester Touring power rear gate confirmed Standard.
  - Ascent wireless charging is Unavailable as a factory feature. The configurator lists it only as an accessory.
  - Wireless charging changed from Standard to blank on 5 Crosstrek trims and 3 Forester hybrids. Subaru's full feature lists for those trims never name a charger, which conflicts with the Edmunds and press values used before.
  - On Solterra Touring XT, Trailseeker Touring and Uncharted GT, "Moonroof" is now blank. Subaru lists a "Panoramic glass roof with power sunshade", which stays in `roof_options`, and doesn't say whether it opens.
- **Mazda:**
  - All 55 base MSRPs, drivetrains, color lists and paint prices matched the configurator, with one exception: the CX-30 Carbon Edition's only color, Polymetal Gray, costs $595, not $0.
  - The Mazda3 Carbon Edition MSRP question is settled. The configurator shows $29,815 (sedan) and $30,965 (hatchback), matching mazdausa.com, not the lower newsroom figures.
  - MX-5 automatic surcharges confirmed: +$920 soft top, +$970 RF.
  - CX-30 Premium and Turbo Premium Plus: black is leatherette and white is leather, so Leather seating is now a no-cost choice (Standalone 0), not Standard.
  - CX-50 2.5 S Preferred: white leatherette is a no-cost choice there, so the $200 package was removed. On Premium, Turbo and Turbo Premium Plus, White Leather is confirmed at +$200.
  - CX-90 3.3 Turbo Preferred: the captain's-chair option is Unavailable, because the configurator offers it ($0) only from Premium Sport up.
  - Interior and color names were aligned to Mazda's configurator wording.

## Discrepancies worth knowing
- **Destination charges** (Mazda's and Subaru's figures used):
  - Subaru Crosstrek: Subaru's release says $1,420; Edmunds implies $1,450.
  - Mazda's configurator says $1,595 (CX-30/CX-5/CX-50), $1,645 (CX-70/CX-90) and $1,315 (Mazda3/MX-5). Edmunds shows $1,495, $1,530 and $1,235.
- **MX-5 RF Club:**
  - Mazda's configurator conflicts with itself. Its trim summary says BBS wheels, Recaro seats and Alcantara are included at $42,200. Its data also carries a $4,900 "Brembo/BBS RECARO Package (Recaro replaces Cloth)" and a plain "Black Leather" interior code.
  - The row treats the equipment as standard. Check this one before it goes customer-facing.
- **MX-5 / RF pricing vs press:** the configurator is $300 higher on every trim than the January 2026 release and Edmunds. The configurator price is used.
- **Mazda's May 4, 2026 price increase** ($200–500), announced in press releases, does not show in the configurator. Configurator prices are used.
- **Forester:**
  - Sport Onyx Edition is a $1,700 package on Sport in the configurator, but a separate $36,495 line in the February release. It is kept as a package.
  - Limited Hybrid upholstery: Subaru says StarTex, Edmunds says leather. Subaru is used.
- **Leather:** StarTex is synthetic, so it is not counted as leather. Subaru calls WRX Limited/GT/tS and BRZ seats "Ultrasuede and leather-trimmed", so they count as leather. Edmunds calls the WRX seats leatherette.
- **Solterra and 2026 Uncharted GT horsepower:** Subaru's JSON shows 388 hp at the top level, but its own feature text and Edmunds say 338 hp.

## Known gaps (left blank, not guessed)
- **Wireless charging:**
  - 5 Crosstrek trims and 4 Forester trims (the 3 hybrids above plus Sport Hybrid).
  - Outback Touring, Touring XT and Wilderness, because Subaru's full feature list for those trims doesn't name a charger and Edmunds lists one.
- **Moonroof:** 8 Subaru EV rows with a panoramic glass roof whose opening isn't stated.
- **CX-30:** heated steering wheel on the 2.5 Turbo Aire Edition; power liftgate and head-up display on the 2.5 Turbo Premium Plus.
- **Forester Limited Hybrid heated steering wheel:** Subaru and Edmunds conflict.
- **Mazda:** color/interior pairing restrictions exist in the option tree but weren't itemized into the CSV. Some wheel finishes are listed by size only.

**Next step:** the usual pipeline — import as a new batch with `promote = false`, verify, then promote deliberately. Nothing was imported from here.
