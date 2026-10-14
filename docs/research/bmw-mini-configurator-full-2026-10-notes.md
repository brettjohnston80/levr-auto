# BMW + MINI configurator research — notes (2026-10-11)

Deliverable: `data/bmw-mini-configurator-full-2026-10.csv`, **72 rows** (BMW 42, MINI 30). One row per trim per model year, in the same 18 columns as the Toyota CSV. Every option column uses `name | availability | price | package`. Availability is always Standard, Standalone, Package-only or Unavailable, prices are plain numbers, and every Package-only item names a package in that row's `package_definitions`. Validator result: 0 errors.

All prices are MSRP deltas that exclude destination. Each row's base MSRP and destination charge are in its confidence_notes.

## How the data was sourced
- **Manufacturer data:** live bmwusa.com and miniusa.com Build Your Own configurators, read from their own data services (`configure.bmwusa.com/UBYOConfigurator/v4` and `configure.miniusa.com/.../US_EN_MI`), harvested 2026-10-11.
  - Each model's start configuration gives every paint, upholstery, wheel, roof/top, line/style, package and option with its price.
- **How availability was decided:** every non-default item was added to a fresh configurator session.
  - **Standalone:** the item priced on its own.
  - **Package-only:** adding it pulled in a package or line (BMW Sport/M Sport/xLine; MINI Styles). The package it pulled in is the one named.
  - **Unavailable (MINI):** adding it forced a different trim (Signature → Signature Plus/Iconic), so it is marked Unavailable on that trim.
- **BMW standard equipment:** taken from BMW's own per-model standard-features pages (`bmwusa.com/standard-features.iframe.standard-features.<code>.html`) and the configurator's standard flags.
- **Edmunds cross-check:** pages for every trim (URLs in each row's `sources`). Used for:
  - base MSRP comparison
  - seating capacity
  - filling a common feature *only* when Edmunds says Standard or Not available and the manufacturer data is silent

## Data-quality issue found and fixed during the harvest
The first BMW pass checked each item by adding it and then using the configurator's "undo." Spot checks showed undo does not fully reset the session. For example, on 230i, Vegas Red and Mineral White wrongly appeared to require M Sport; on a fresh session they are $650 standalone. That pass was discarded. Both makes were re-harvested with a fresh session for every item, and the MINI harvest was redone the same way.

## Model years (as served by each live configurator on 2026-10-11)
- **BMW 2026:** 230i, 330i, M340i, X3 30 xDrive, X3 M50 xDrive.
- **BMW 2027:** everything else, including 2 Series Gran Coupe, M240i, M2 (now with an M xDrive AWD version), 4 Series, M3/M4, 5 Series, M5 / M5 Touring, i5, 7 Series (740 / 740 xDrive), i7 (50 xDrive / 60 xDrive), X1, X2, X5 (new generation, 40 xDrive only), X6, X6 M, X7, XM Label and iX3 50 xDrive.
- **MINI 2027 only:** Cooper 2 Door, Cooper 4 Door, Cooper Convertible and Countryman (S, JCW, SE). MINI USA no longer configures any 2026 models.

## Row and naming conventions
- **Drivetrain variants share one row.** RWD/FWD and xDrive versions of the same trim are merged, e.g. 230i = 230i + 230i xDrive, and i5 "eDrive40 / xDrive40".
  - The drivetrain column reads `RWD/AWD` or `FWD/AWD`.
  - The xDrive price premium is in `drivetrain_engine_variants`.
  - Where an option's availability differs by drivetrain, the row shows the most available status and the difference is spelled out in confidence_notes (7 rows).
- **Names match the existing matchmaker dataset**, e.g. M3 "Base"/"Competition", and MINI "S Signature" / "JCW Iconic".
- **MINI Cooper C:** MINI USA now calls the base car "Cooper C". Its trims are kept as Signature/Signature Plus/Iconic to match existing LEVR rows, with a note in each row.
- **MINI trim prices:** taken from the configurator with that trim selected; destination ($1,350) is excluded.

## Excluded
- **BMW i3 50 xDrive (2027):** the configurator shows it as reservation-only (production starts Nov 2026), so it is not on sale yet.
- **Not in BMW USA's configurator any more (also no 2027 on Edmunds):** i4, iX, Z4, 8 Series / M8, X4, X5 M, ALPINA XB7, and the 2026-generation X5 variants (sDrive40i, xDrive50e, M60i). The new 2027 X5 is configurable only as the 40 xDrive. Edmunds mentions a 50e and an iX5 coming "by the end of the year".
- **M2 CS:** not in the configurator.
- **MINI:**
  - **Oxford Edition** (Cooper and Countryman) is listed on Edmunds but not in MINI's configurator.
  - **Countryman Signature** (the base trim) is not offered; Countryman starts at Signature Plus.
  - **JCW 4 Door, Clubman, Aceman and Cooper Electric** are not configurable in the US.
- Dealer accessories and BMW Ultimate Care maintenance plans are not included.

## Discrepancies (configurator vs Edmunds)
- **Base MSRPs:** all 72 match Edmunds' "base MSRP excluding destination." Edmunds' own pricing section adds destination ($1,350 / $1,450 / $1,550), but its FAQ calls that same lower figure "including destination." The manufacturer figure is used.
- **Common features where Edmunds disagrees with BMW's own data (BMW data kept, note in the row):**
  - **M3 Base / Competition:** heated steering wheel and power trunk. BMW's configurator flags them standard; Edmunds says optional. M3's BMW standard-features page was empty.
  - **X6 M Competition:** heated front seats. BMW's standard-features page lists "Heated Front Seats, Armrests and Steering Wheel"; Edmunds says optional.
- **XM Label:** Edmunds' trims page says the sunroof is not available, but its features page differs. Details are in the row.
- **MINI color and wheel availability is trim-dependent and strict.**
  - Most paints, roof colors and JCW/18" wheels are Unavailable on Signature.
  - Some Iconic roof colors come only with the Paul Smith Edition.

## Known gaps (left out, never guessed)
- **Common features left out:**
  - Omitted from a row when neither the manufacturer data nor a definitive Edmunds entry shows how they're sold. Each row's confidence_notes names them.
  - Most often power liftgate/trunk (40 rows, mostly MINI), heated steering wheel (29) and adaptive cruise (19).
- **Seating base item blank:** 8 rows have no base seating item because Edmunds didn't state capacity: MINI 4 Door (6 rows), M5 Touring, M4 Convertible.
- **Package contents:** taken from the configurator's own package data. A few MINI Styles list no contents because the configurator gives none.
- **Edmunds feature data is thin for 2027 MINI convertibles and the 4 Series coupe:** Edmunds' trims page mixes coupe and convertible data.

## Sources
- BMW: https://www.bmwusa.com/build-your-own.html ; configurator data `https://configure.bmwusa.com/UBYOConfigurator/v4/configuration/start/<model code>` ; standard features `https://www.bmwusa.com/standard-features.iframe.standard-features.<model code>.html`
- MINI: https://www.miniusa.com/build-your-own.html ; configurator data `https://configure.miniusa.com/configurator/mini/live/market/US_EN_MI/configuration/start/<model code>`
- Edmunds: model, trims and features-specs pages per model/year, e.g. https://www.edmunds.com/bmw/x5/2027/ and https://www.edmunds.com/mini/cooper/2027/. Exact URLs are in each row's `sources`.
