# mercedes configurator re-pass: notes (2026-10-16)

Input `data/mercedes-configurator-full-2026-10.csv` → output `data/mercedes-configurator-repass-2026-10.csv`. Same header, same 61 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

| make | model | trim (old) | model_year | field | old value | new value | source URL |
|---|---|---|---|---|---|---|---|
| Mercedes-Benz | GLE | AMG GLE 53 Hybrid | 2027 | trim | AMG GLE 53 Hybrid | AMG GLE 53 HYBRID | https://www.mbusa.com/en/vehicles/class/gle/suv |
| Mercedes-Benz | GLE Coupe | AMG GLE 53 Hybrid | 2027 | trim | AMG GLE 53 Hybrid | AMG GLE 53 HYBRID | https://www.mbusa.com/en/all-vehicles |
| Mercedes-Benz | G-Class | G 580 with EQ Technology | 2027 | trim | G 580 with EQ Technology | G 580 Electric | https://www.mbusa.com/en/vehicles/class/g-class/suv |
| Mercedes-Benz | C-Class | AMG C 63 S E Performance | 2026 | trim | AMG C 63 S E Performance | AMG C 63 S E PERFORMANCE | https://www.mbusa.com/en/vehicles/class/c-class/sedan |
| Mercedes-Benz | E-Class | AMG E 53 Hybrid | 2027 | trim | AMG E 53 Hybrid | AMG E 53 HYBRID | https://www.mbusa.com/en/all-vehicles |
| Mercedes-Benz | E-Class Wagon | AMG E 53 Hybrid | 2027 | trim | AMG E 53 Hybrid | AMG E 53 HYBRID | https://www.mbusa.com/en/all-vehicles |
| Mercedes-Benz | AMG GT Coupe | AMG GT 43 | 2027 | drivetrain | (blank) | RWD | https://mbusa.com/en/vehicles/model/gt/coupe/amggt43 |
| Mercedes-Benz | AMG GT Coupe | AMG GT 63 S E Performance | 2027 | trim | AMG GT 63 S E Performance | AMG GT 63 S E PERFORMANCE | https://www.mbusa.com/en/vehicles/class/amg-gt/coupe |
| Mercedes-Benz | AMG GT 4-Door Coupe Electric | AMG GT 55 4MATIC+ | 2027 | trim | AMG GT 55 4MATIC+ | AMG GT 55 | https://www.mbusa.com/en/future-vehicles/2027-mercedes-amg-gt-4-door-coupe |

### What was checked

- **A – 8 trim fixes applied:** G-Class 2027 "G 580 with EQ Technology" → "G 580 Electric"; AMG GT 4-Door Coupe Electric 2027 "AMG GT 55 4MATIC+" → "AMG GT 55"; and Mercedes' all-caps styling for HYBRID (GLE, GLE Coupe, E-Class, E-Class Wagon) and E PERFORMANCE (C 63 S, AMG GT 63 S).
- **C4 – AMG GT 43 drivetrain: filled with RWD** (mbusa.com spec: "Drive configuration Rear-wheel drive"). Only drivetrain change in the re-pass.

## Unresolved

- Mercedes-Maybach SL 680 Monogram Series (2027) isn't on mbusa.com's all-vehicles list; name unconfirmed.
- EQE SUV "EQE 320" is one row for two mbusa models ("EQE 320+" RWD and "EQE 320 4MATIC" AWD). Left as is.

## Counts

- Rows: 61 in, 61 out.
- Cells changed: 9 (trim 8, other 1); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 2 (2 with hp, 0 hp blank).
- Prices (section D): not touched in this batch.
