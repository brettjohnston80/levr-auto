# Dodge + Chrysler + Alfa Romeo configurator data: notes (2026-10-11)

Goes with `data/dodge-chrysler-alfa-configurator-full-2026-10.csv`. It has 41 trim rows in the same 18 columns as the Toyota file. This replaces the 2026-09-16 Dodge/Chrysler/Alfa rows, which came from secondary sources and had no colors.

## Coverage
Every model and year shown on each brand's live Build & Price selector was collected in full. All 63 configurator variants were fetched, and none were blocked.

| Make | Model | Years | Configurator variants | Rows |
|---|---|---|---|---|
| Dodge | Charger (gas) | 2026 / 2027 | 8 / 8 | 4 / 4 |
| Dodge | Charger Daytona (electric) | 2026 / 2027 | 4 / 2 | 2 / 1 |
| Dodge | Durango | 2026 / 2027 | 12 / 9 | 9 / 8 |
| Chrysler | Pacifica | 2026 / 2027 | 6 / 7 | 3 / 4 |
| Chrysler | Voyager | 2026 | 1 | 1 |
| Alfa Romeo | Giulia | 2026 | 2 | 1 |
| Alfa Romeo | Stelvio | 2026 | 1 | 1 |
| Alfa Romeo | Tonale | 2026 | 3 | 3 |

**Gas vs electric Charger.** They are kept separate by model name: `Charger` (fuel_type Gas, 3.0L Twin Turbo Sixpack) and `Charger Daytona` (fuel_type Electric, 400V dual motors). This matches the earlier pass.

## Exclusions
- **Dodge Hornet:** not on Dodge's live selector, which shows only Charger and Durango.
- **Chrysler Pacifica Plug-in Hybrid (2026):** a data file exists for it, but it has no card on the live Pacifica selector, which shows only Select, Limited and Pinnacle. Edmunds still lists the PHEV trims.
- **Alfa Romeo 2025 models:** out of scope. There is no 2027 Alfa on the selector.
- **Charger Daytona Scat Pack (non-Plus) 2027:** Edmunds lists it at $74,490, but it isn't on Dodge's 2027 configurator.

## Method
- **Source:** the dodge.com, chrysler.com and alfaromeousa.com Build & Price data feeds, read in your Chrome. For each variant that meant the configuration file, the option-detail file, the equipment list and the spec file. Pricing state is Kansas (ZIP 67212).
- **Prices:** all MSRP before destination ($1,995 for Dodge and Chrysler, $3,250 for Alfa). The Alfa destination figure is derived from the configurator's own totals.
- **One row per trim:** body, drive and engine variants are merged, for example Charger 2-door/4-door, Durango GT RWD/AWD/HEMI V8, and Pacifica FWD/AWD. They are listed first in drivetrain_engine_variants, priced as the difference vs the cheapest variant. The America250 and Launch Edition Durangos keep their own rows because the configurator sells them as separate models.
- **Availability** comes straight from the configurator's own option states:
  - **Standard:** included.
  - **Standalone:** a priced or no-charge pick.
  - **Package-only:** the configurator marks the item "packaged with" a package. Every named package appears in package_definitions, and the build script checks this.
  - **Unavailable:** not anywhere in the trim's equipment or option data.
- **Variant differences:** where variants differ, the row shows the most-available state and the lowest price, and the difference is spelled out in confidence_notes.
- **common_features:** checks the same seven items as the Jeep/Ram file (leather seating, heated front seats, ventilated front seats, heated steering wheel, power liftgate/trunk, adaptive cruise, wireless charging). confidence_notes names the configurator item each one matched.
- **Package contents** come from the configurator's own "Includes" lists. Dealer-installed Mopar accessories, the SRT driving-school voucher, paint protection film and service contracts are left out.
- **Transcription check:** every row was checked against the in-browser output by hash, and all 41 matched.

## Discrepancies found
- **Matched Edmunds exactly (28 rows):** all 2026 Charger and Charger Daytona trims, all 2026 Durango trims (including the separate Edmunds HEMI V8 listings), 2026 Pacifica, Voyager, 2027 Charger R/T, R/T Plus and Daytona Scat Pack Plus, 2027 Pacifica Pinnacle, and every Alfa row.
- **Configurator higher than Edmunds (manufacturer figure used):**
  - 2027 Charger Scat Pack and Scat Pack Plus: +$850 each.
  - 2027 Durango GT, GT Plus and GT Premium: +$200 each.
  - 2027 Durango R/T 392 and R/T 392 Premium: +$750 each.
  - 2027 Durango R/T 392 Plus: +$1,050.
  - 2027 Durango SRT Hellcat and Jailbreak: +$1,000 each.
  - 2027 Pacifica LX, Select and Limited: +$100 each.
- **"Starting at" vs base:** 2027 Charger R/T Plus has a base of $54,990, but its "Starting at" price is $56,285 because the default build adds a priced item. Edmunds shows the base.
- **Naming:**
  - Giulia and Stelvio have one configurator card each, titled just with the model name. Edmunds calls the trim "Base", and the CSV uses "Base".
  - Veloce is now a $1,625–$2,025 package on these models, not a separate trim as in the 09-16 pass.
  - Edmunds calls the Durango R/T 392 Premium Launch Edition "R/T 392 Launch Edition Premium".
- **Possible data gaps to verify before promoting:**
  - **Durango GT Plus, GT Premium, America250 and 2027 R/T 392 Plus/Premium:** the equipment lists show "Ventilated Front Seats" but no separate heated-front-seat item, so heated front seats show as Unavailable. They are probably combined heated and ventilated seats.
  - **Durango SRT Hellcat:** has no adaptive-cruise item at all. On Jailbreak, adaptive cruise is in the Premium Group.
  - **Durango R/T 392 and America250 seats:** described only as "SRT Performance Seats" or "Anniversary Ed SRT Seat", so leather is tagged Unavailable.
- **Seating sources:**
  - Charger, Giulia and Stelvio capacity come from the configurator spec data.
  - Tonale (5) and the base Pacifica/Voyager standard 7-passenger come from Edmunds.
  - Durango capacity comes from the configurator's "N-Passenger Seating" items. Hellcat trims are 5-passenger standard, with 7-passenger via the 3rd Row Seating Group.
  - The Pacifica configurator spec field reports 8, which is the maximum with the option, so it was not used.

## Sources
- Dodge Build & Price: https://www.dodge.com/vehicle-selector.bmo.html
- Chrysler Build & Price: https://www.chrysler.com/vehicle-selector.bmo.html
- Alfa Romeo Build & Price: https://www.alfaromeousa.com/vehicle-selector.bmo.html
- Configurator data files (pattern; each row lists its own):
  - `https://<brand site>/hostd/api/cvd/<vehicle>/<vehicle>_CVD.json`
  - `https://<brand site>/hostd/api/configure/EN/states/KS/models/<config>/lowerLevelPackages/<package>/configurations/standard.json`
  - The matching `catalog-option/EN/details/...` and `equipment-categories/...` files.
- Vehicle codes: Charger CUD202614 / CUD202714, Durango CUD202611 / CUD202711, Pacifica CUC202605 / CUC202705, Voyager CUC202613, Giulia CUY202603, Stelvio CUY202604, Tonale CUY202605.
- Edmunds, fetched 2026-10-11:
  - https://www.edmunds.com/dodge/charger/2026/
  - https://www.edmunds.com/dodge/charger/2027/
  - https://www.edmunds.com/dodge/durango/2026/
  - https://www.edmunds.com/dodge/durango/2027/
  - https://www.edmunds.com/chrysler/pacifica/2026/
  - https://www.edmunds.com/chrysler/pacifica/2027/
  - https://www.edmunds.com/chrysler/voyager/2026/
  - https://www.edmunds.com/alfa-romeo/giulia/2026/
  - https://www.edmunds.com/alfa-romeo/stelvio/2026/
  - https://www.edmunds.com/alfa-romeo/tonale/2026/
  - The features-specs pages for Tonale, Pacifica and Voyager (seating).
