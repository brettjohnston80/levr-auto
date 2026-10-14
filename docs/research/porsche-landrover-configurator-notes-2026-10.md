# Porsche + Land Rover configurator data: notes (2026-10-12)

Goes with `data/porsche-landrover-configurator-full-2026-10.csv`. It has 113 trim rows (Porsche 61, Land Rover 52) in the same 18 columns as the Toyota file, and every row passes the format check. Every option item is `name | availability | price | package`, and every Package-only item points to a package in that row's package_definitions.

## Coverage

| Make / model | Model year on configurator | Rows |
|---|---|---|
| Porsche 911 | 2027 (Spirit 70 is 2026) | 19 |
| Porsche Taycan | 2027 | 7 |
| Porsche Panamera | 2027 | 7 |
| Porsche Macan (gas) | 2026 | 4 |
| Porsche Macan Electric | 2027 | 5 |
| Porsche Cayenne / Cayenne Coupe | 2027 | 6 / 7 |
| Porsche Cayenne Electric / Cayenne Coupe Electric | 2027 | 3 / 3 |
| Range Rover (gas and plug-in hybrid) | 2027 | 11 |
| Range Rover Electric | 2027 | 11 |
| Range Rover Sport | 2027 | 7 |
| Range Rover Velar | 2026 (configurator code k2675) | 4 |
| Range Rover Evoque | 2026 (code k2675) | 2 |
| Defender 90 / 110 / 130 | 2027 | 2 / 7 / 4 |
| Discovery | 2027 | 3 |
| Discovery Sport | 2026 (code k265) | 1 |

Each configurator shows only one model year per model, so there are no 2026 + 2027 pairs.

**Range Rover wheelbase:** standard and long-wheelbase versions are separate rows, with the body in the trim name: "SE SWB", "SE LWB 7-Seat", "Autobiography LWB", "SV Ultra LWB", and so on.

## Excluded
- **Porsche 718 Boxster/Cayman (all 10 versions):** shown only as MY2025, with no Configure button.
- **Porsche 911 GT3 90 F.A. Porsche:** listed on Porsche's site but has no configurator. Edmunds lists it at MY2026.
- **Taycan Sport Turismo / Cross Turismo:** not on the current configurator; Taycan is sedan-only.
- **Land Rover hidden products:** the configurator data includes products it hides from shoppers (Range Rover base and Westminster Edition, P360 SWB, EV450 and others). These aren't offered on the configurator, so they're left out.
- **Edmunds-only styles:** these have no row because they aren't on the manufacturer configurator:
  - Range Rover Sport P530 TWENTY Edition
  - Velar Dynamic SE
  - Evoque Dynamic SE
  - Discovery P300 S / Dynamic SE (MY2026)
  - Taycan Black Editions (MY2026)

## Method
- **Source:** each manufacturer's US configurator data, read in your Chrome on 2026-10-11/12.
  - **Porsche:** configurator.porsche.com, one page per model code. The code is in each row's sources.
  - **Land Rover:** the rangerover.com and landroverusa.com Build & Reserve data, one configuration per powertrain/trim product. The product codes are listed in confidence_notes.
- **Prices:** MSRP before destination. Destination is noted per row: Porsche $2,350; Land Rover $1,275–$2,450 depending on model.
- **One row per trim:**
  - Porsche: four configurator variants are merged into their parent trim and appear as a drivetrain_engine_variants item priced as the base-MSRP difference. They are the Carrera S and S Cabriolet "with MT Package" (manual), the GT3 "with Touring Package", and the Taycan Turbo GT "with Weissach Package".
  - Land Rover: engine choices within a trim are merged the same way. For example, Range Rover SE SWB includes the P400, P550e and P530.
  - Cabriolet, Targa and Coupe bodies stay separate rows, because Porsche prices them as separate models.
  - Cayenne Coupe and Cayenne/Macan Electric are separate model names.
- **Availability:**
  - Standard = standard or included.
  - Standalone = individually selectable (0 = no charge).
  - Package-only = only inside the named factory package.
  - Unavailable = the configurator offers the item for this trim only as not selectable.
- **Common features:** seven checks: leather seating, heated front seats, ventilated front seats, heated steering wheel, power liftgate, adaptive cruise, and wireless charging. When the configurator data doesn't itemize a feature for a trim, it is **left out** rather than guessed, and confidence_notes says so. Examples are power liftgate on 911/Taycan/Defender and ACC on Panamera.
- **Land Rover packages:** dealer accessory packages (protection, handover, emergency) are left out of package_definitions; only factory packs are listed.
- **Choices Land Rover marks as not selectable:** colors, interiors, wheels and seats that Land Rover marks "excluded" for a trim's default build are left out, and the count is noted per row.

## Edmunds cross-check
- **Porsche, exact matches:** Panamera MY2027 matches exactly. 911, Macan/Macan Electric, Cayenne/Cayenne Coupe/Cayenne Electric match exactly, comparing the configurator's MY2027 (Macan gas MY2026) prices against Edmunds' MY2026 listing, because Edmunds has no MY2027 pricing yet for those models.
- **Porsche, real differences (configurator used):**
  - Taycan Base: Porsche $111,900 vs Edmunds MY2026 $105,800.
  - Taycan 4: $116,000 vs $109,900.
  - Taycan 4S: $131,800 vs $125,900.
  - These are a year apart; GTS and above match.
- **Not on Edmunds:** 911 GT3 S/C (new for 2027), the MT Package variants, and the Range Rover Electric (all 11 rows).
- **Land Rover:** all Range Rover gas/PHEV styles, all Range Rover Sport, Velar, Evoque and Discovery Sport styles match exactly, with one exception: **Range Rover SV Ultra SWB is $252,800 on Land Rover vs $252,900 on Edmunds.**
- **Defender and Discovery:** Edmunds has no MY2027 pricing. Rows note the closest same-named MY2026 Edmunds figure. For example, Defender 110 X is $96,000 (2027) vs $95,600 (2026), and OCTA is $158,800 vs $158,300.
- **Naming differences:**
  - Defender "Vertex" (code XS) is new and not on Edmunds.
  - Discovery 2027 trims are S / Landmark / Tempest, vs Edmunds 2026 S / Dynamic SE / Gemini / Tempest.
  - Edmunds labels Land Rover drivetrains "4WD"; the configurator says "All Wheel Drive", and the CSV uses AWD.
  - Edmunds lists the base Cayenne Electric / Cayenne Coupe Electric without an AWD tag. Porsche's configurator lists a motor on both axles, so the rows use AWD.

## Known gaps
- **Paint to Sample (non-Plus):** missing from the Porsche data extract, so only "Paint to Sample Plus" appears.
- **Drivetrain source for gas Macan and Cayenne:** these show AWD, taken from Edmunds because Porsche's configurator data doesn't name the drivetrain for those models.
- **Land Rover option columns:** these combine all merged engine products. A trim can show two Standard wheels when the V8 and six-cylinder versions come with different standard wheels.

## Sources
- Porsche configurator: https://configurator.porsche.com/en-US/ (model list: https://www.porsche.com/usa/models/)
- Range Rover configurator: https://www.rangerover.com/en-us/build-your-own/range-rover.html
- Defender / Discovery configurators: https://www.landroverusa.com/lr/en_us/l663/ipr/personalise/ , https://www.landroverusa.com/lr/en_us/l462/ipr/personalise/ , https://www.landroverusa.com/lr/en_us/l550/ipr/personalise/
- Edmunds:
  - https://www.edmunds.com/porsche/911/2026/
  - https://www.edmunds.com/porsche/911/2027/
  - https://www.edmunds.com/porsche/taycan/2026/
  - https://www.edmunds.com/porsche/panamera/2027/
  - https://www.edmunds.com/porsche/macan/2026/
  - https://www.edmunds.com/porsche/cayenne/2026/
  - https://www.edmunds.com/porsche/cayenne-coupe/2026/
  - https://www.edmunds.com/land-rover/range-rover/2027/
  - https://www.edmunds.com/land-rover/range-rover-sport/2027/
  - https://www.edmunds.com/land-rover/range-rover-velar/2026/
  - https://www.edmunds.com/land-rover/range-rover-evoque/2026/
  - https://www.edmunds.com/land-rover/defender/2026/
  - https://www.edmunds.com/land-rover/discovery/2026/
  - https://www.edmunds.com/land-rover/discovery-sport/2026/
