# Jeep + Ram configurator data: notes (2026-10-10)

Goes with `jeep-ram-configurator-full-2026-10.csv`. It has 78 trim rows in the same 18 columns as the Toyota file.

## Coverage
The manufacturer configurators blocked further data requests ("Access Denied") after about 140 configurations. They were still blocking when rechecked at the end of the session. Rows were built only from data that was actually fetched. Nothing was filled in by guesswork.

| Model | Years on configurator | Configurator variants | Fetched | Rows |
|---|---|---|---|---|
| Jeep Compass | 2026 | 6 | 6 | 6 |
| Jeep Cherokee | 2026 / 2027 | 6 / 5 | all | 6 / 5 |
| Jeep Wrangler (2-door and 4-door merged per trim) | 2026 / 2027 | 17 / 16 | all | 12 / 10 |
| Jeep Grand Cherokee + Grand Cherokee L | 2026 | 22 | 14 | 4 + 6 |
| Jeep Grand Cherokee + Grand Cherokee L | 2027 | 21 | 0 | 0 |
| Jeep Gladiator | 2026 | 13 | 0 | 0 |
| Jeep Grand Wagoneer + Grand Wagoneer L | 2026 / 2027 | 19 / 17 | 0 | 0 |
| Jeep Recon (Moab) | 2026 | 1 | 0 | 0 |
| Ram 1500 | 2026 / 2027 | 35 / 37 | all | 11 / 13 |
| Ram 2500 | 2026 | 40 | 6 | 5 |
| Ram 2500 | 2027 | 40 | 0 | 0 |
| Ram 3500 | 2026 / 2027 | 33 / 32 | 0 | 0 |

**Not yet collected (no row):**
- Grand Cherokee 2026: Laredo X, Laredo Altitude, Limited Reserve.
- Grand Cherokee L 2026: 85th Anniversary Edition.
- All of these: Grand Cherokee and Grand Cherokee L 2027 (including the new Trailhawk), Gladiator 2026, Grand Wagoneer and Grand Wagoneer L 2026/2027, and Recon 2026.
- Ram 2500 2026: Black Express, Big Horn, Warlock, Rebel, Limited.
- All of Ram 2500 2027 and Ram 3500 2026/2027.

**Rows marked INCOMPLETE in confidence_notes** (some variants of the trim weren't fetched):
- Grand Cherokee L 2026 Laredo and Limited: the 4x4 variant is missing.
- All five Ram 2500 2026 rows: only one cab/bed/drive variant each, two for Limited Longhorn.

## Exclusions
- **Commercial:** Ram ProMaster, ProMaster EV, and 3500–5500 Chassis Cab.
- **Not on a live configurator:**
  - Wagoneer S: only MY2025 is on the configurator.
  - Grand Cherokee 4xe: a 2026 data file exists, but it has no price and no selector card, and Edmunds says it's discontinued.
  - Wrangler 4xe: discontinued.
  - Wrangler Sport RHD: on Edmunds only.
  - Cherokee 2027 Trailhawk: Edmunds lists it at $42,630, but it isn't on Jeep's 2027 configurator.
  - Grand Wagoneer 2027 REEV: Edmunds describes it, but there's no configurator variant.

## Method
- **Source:** the jeep.com and ramtrucks.com Build & Price data feeds (vehicle list file plus per-variant equipment, option-detail and price-configuration files), read in your Chrome. Pricing state is Kansas (ZIP 67212).
- **Prices:** all MSRP before the $1,995 destination charge. The base price is the configuration's own base. The configurator's "Starting at" figure can add default options; where that is what matches Edmunds, it's noted.
- **One row per trim:** cab, bed, door and drive variants are merged. They're listed first in drivetrain_engine_variants, with price = base-price difference vs the cheapest variant. Engine, transmission and transfer-case items follow.
- **Availability:**
  - Standard = standard on this trim.
  - Standalone = individually selectable (0 = no charge).
  - Package-only = only available inside the named package, which always appears in package_definitions.
  - Unavailable = not in the trim's equipment or option list.
- **Varies by variant:** when availability or price differs between a trim's variants, the most-available state and the cheapest price are shown. The details are in confidence_notes.
- **common_features** checks seven items: leather seating, heated front seats, ventilated front seats, heated steering wheel, power liftgate/tailgate, adaptive cruise, and wireless charging. confidence_notes names the configurator item each one was matched to. Where the only match is a dealer-installed Mopar accessory, that is flagged.
- **Cleanup:**
  - Removed: the trailing "Paint" in some color names, "Interior Colors" filler text, "(Late Availability)" tags (noted in confidence_notes), and wheel center-hub line items.
  - Roof: trims with no roof or sunroof item anywhere in their data show "Sunroof | Unavailable".
- **Edmunds cross-check:** Edmunds trim pages and FAQ base prices, fetched 2026-10-10, compared with the cheapest variant's base price.

## Discrepancies found
- **Configurator "Starting at" adds a required option:** Wrangler 2026 85th Anniversary has a base of $44,740, but its as-configured start is $47,240, which is what Edmunds shows.
- **Real price differences (manufacturer figure used):**
  - Wrangler 2026 Willys '41: Jeep $46,240 base vs Edmunds $48,740.
  - Wrangler 2026 Rewind: Jeep $48,435 vs Edmunds $50,935.
  - Wrangler 2027 Sport S 2-door: Jeep $39,035 vs Edmunds $39,785.
  - Wrangler 2027 Willys 2-door: Jeep $43,230 vs Edmunds $43,855.
  - Wrangler 2027 Rubicon 2-door: Jeep $46,935 vs Edmunds $46,710.
  - Wrangler 2027 Rewind: Jeep $49,380 vs Edmunds $51,535.
  - Wrangler 2027 Rubicon X 2-door: Jeep $57,030 vs Edmunds $56,560.
- **Naming and listing:**
  - Wrangler 2027 Moab is called "Moab 392" on Edmunds.
  - Wrangler 2027 California Edition and Smoky Mountain are on Jeep's configurator but not on Edmunds.
- **Ram cab coverage on Edmunds:** Edmunds prices Ram only for Crew Cab, so the cheaper 1500 Quad Cab variants can't be cross-checked. For example, Tradesman 2026 starts at $42,025 on the configurator; Edmunds' lowest is $44,775, which is the Crew Cab RWD 5'7" figure and matches the configurator.
- **Ram 2500 2026:** each fetched variant matches Edmunds for the same variant. Lower-priced RWD variants exist but weren't fetched. Drivetrain shows "RWD or 4WD" based on Edmunds, and this is noted in the row.
- **No Edmunds pricing yet:** Ram 1500 2027 rows couldn't be price-checked.
- **One correction to the raw data:** Ram 2500 2026 Lone Star sells heated seats and heated wheel only as the "Heated Steering Wheel and Seats Group" ($445). Both are recorded as Package-only in that group.
- **Matched exactly:** all 2026 Compass, Cherokee 2026/2027, Grand Cherokee/L 2026 rows, Ram 1500 2026 Warlock through Tungsten, and Ram 2500 2026 Power Wagon.

## Sources
- Jeep Build & Price: https://www.jeep.com/vehicle-selector.bmo.html
- Ram Build & Price: https://www.ramtrucks.com/vehicle-selector.bmo.html
- Configurator data files (pattern; each row lists its own): `https://www.jeep.com/hostd/api/cvd/<vehicle>/<vehicle>_CVD.json` and `https://www.jeep.com/hostd/api/configure/EN/states/KS/models/<config>/lowerLevelPackages/<package>/configurations/standard.json` (the same paths on ramtrucks.com)
- Edmunds:
  - https://www.edmunds.com/jeep/compass/2026/
  - https://www.edmunds.com/jeep/cherokee/2026/
  - https://www.edmunds.com/jeep/cherokee/2027/
  - https://www.edmunds.com/jeep/wrangler/2026/
  - https://www.edmunds.com/jeep/wrangler/2027/
  - https://www.edmunds.com/jeep/grand-cherokee/2026/
  - https://www.edmunds.com/jeep/grand-cherokee-l/2026/
  - https://www.edmunds.com/ram/1500/2026/
  - https://www.edmunds.com/ram/1500/2027/
  - https://www.edmunds.com/ram/2500/2026/

## To finish
When the configurator stops blocking, the missing variants can be fetched slowly (about one every 10 seconds) and added as rows. The Edmunds prices for those models are already collected: Gladiator, Grand Wagoneer/L, Grand Cherokee/L 2027, Recon, and Ram 2500/3500.
