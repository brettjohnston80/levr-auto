# Mercedes-Benz configurator data — 2026-10 re-research

**File:** `data/mercedes-configurator-full-2026-10.csv`. It has 61 rows, one per trim, across 26 model lines, in the same 18 columns as the Toyota CSV.
**Pulled:** 2026-10-11, from the mbusa.com Build & Price configurator. Prices were cross-checked against Edmunds the same day.
**Status:** raw research. It goes through `matchmaker_scoring_pipeline.py`, then import as an unpromoted batch, then review. Nothing has been promoted.

## How the data was gathered

- Every value comes from the configurator's own data feed (`nafta-service.mbusa.com/api/byo/v1/publish/en_us/build/…`). This is the feed the Build & Price pages load. For each model code it returns three things:
  - **content**: option names, standard-feature highlights, package contents and key specs.
  - **option tree**: which options this exact model can take, with prices.
  - **constraints**: which options require a package.
- The lineup is every model with a live build page in mbusa.com's own vehicle menu, using whichever model year that page is currently selling. That gives 52 trims at MY2027 and 9 still at MY2026: GLA, GLB, C-Class, G 550 and Maybach GLS 600.
- I spot-checked the live UI against the data:
  - The 2027 GLC 300 wheel list and prices match the page exactly, including the duplicate-named AMG wheels.
  - An AMG wheel at $0 really can be selected without AMG Line. The "MSRP as Built" stayed at $53,850, which is base plus destination.
- An Edmunds cross-check covered every model line. Results are below and in each row's `discrepancy_notes`.

## Format decisions

- **One row per trim.** Where a trim comes in both 2WD and 4MATIC (GLA 250, GLB 250, GLC 300, C 300, E 350, EQE 320), the row is named without "4MATIC". The 4MATIC version is a `Standalone` line in `drivetrain_engine_variants`, priced at the MSRP difference: +$2,000, or +$2,500 for the EQE.
  - Option columns come from the base drivetrain's configurator. Any color, wheel or package differences on the 4MATIC version are listed in `confidence_notes`. For example, the GLC 300 4MATIC doesn't show the Winter Package.
- **Coupe and SUV-coupe variants are separate models:** GLC vs. GLC Coupe, GLE vs. GLE Coupe, CLE Coupe vs. CLE Cabriolet, E-Class vs. E-Class Wagon.
  - The GLC 400 4MATIC with EQ Technology is its own model, **GLC Electric**.
  - The CLA is split into **CLA**, the 220 Hybrid, and **CLA Electric**, the 250+ and 350 4MATIC. This keeps the split used in the September pass.
  - The 2-door **AMG GT Coupe** and the new electric **AMG GT 4-Door Coupe Electric** are separate models.
  - Maybach models are their own model lines: Maybach GLS, Maybach S-Class and Maybach SL.
- **Availability rules:**
  - Colors are always `Standalone` at their price, which is $0 for standard paints.
  - The default upholstery and wheel are `Standard`.
  - Anything the configurator's constraints tie to a package is `Package-only` with that package's name. Its price is its own surcharge on top of the package, which is usually 0.
  - Package contents come straight from the configurator. Commas inside item names were changed to " - " so the importer's comma split doesn't break them apart.
- **Common features** use a fixed list on every row: leather, heated seats, ventilated seats, heated wheel, power liftgate/trunk, adaptive cruise, wireless charging, HUD, surround camera, Burmester and keyless entry.
  - `Standard` means it appears in the configurator's standard-feature list.
  - `Standalone` means it is an orderable option.
  - `Package-only` names the cheapest package that contains it.
  - **Blank** means it wasn't found anywhere. There are 35 such items. The standard-feature list is a highlights list, not a full spec sheet, so these were left blank (shown as "Not confirmed") rather than marked `Unavailable`.
- Dealer-installed accessories are excluded. Option names with duplicates in the configurator, such as two different "19-inch AMG 5-spoke w/black accents" wheels, have the Mercedes option code appended so they stay distinct.

## Excluded

| Model | Why |
|---|---|
| Sprinter, Metris | Commercial vans, excluded by the brief |
| EQB | Discontinued after MY2025. mbusa shows MY2025 with "Build Coming Soon". Edmunds, InsideEVs and Motor1 confirm it is discontinued. |
| EQE Sedan (MY2026) | No live configurator: "Build Coming Soon" on all three trims. Edmunds still lists the 2026 model. |
| CLA Coupe, old generation (MY2026: CLA 250, AMG CLA 35/45 S) | No live configurator: "Build Coming Soon". It has been replaced by the new CLA sedan. |
| Mercedes-Maybach EQS 680 SUV (MY2026) | No live configurator: "Build Coming Soon". Edmunds still lists it at $180,000. |
| Gas AMG GT 4-door (MY2026: 43/53/63/63 S E Perf) | No mbusa build page. Edmunds still lists the 2026 model. |
| AMG SL 63 S E Performance, S 580e, CLA 220 4MATIC | Edmunds mentions these, but none is on mbusa.com's configurator yet |

## Discrepancies vs. Edmunds

- **Prices.** Every trim Edmunds prices for the same model year matches mbusa.com to the dollar: 47 trim variants. Edmunds' trim-picker prices are higher by the destination charge, $1,350 for MY2026 and $1,450 for MY2027.
- **Edmunds is a model year behind** on several lines. mbusa MY2027 is higher than Edmunds MY2026 on all of them except one:
  - G 580: +$550
  - Maybach S 580 and S 680: +$3,050
  - AMG GT 43, 63, 63 S E Perf and 63 PRO: +$2,350 to +$2,800
  - SL 43, 55 and 63: about +$2,350 to +$2,650
  - **The exception is the AMG GT 55.** Edmunds MY2026 is $138,150, which is $700 *above* mbusa MY2027 at $137,450. This is unresolved.
- **No MSRP on either source:** AMG GLE 63 S (SUV and Coupe), GLS 580, AMG GLS 63 and the electric AMG GT 55 4-door all show "Price Coming Soon" on mbusa. Their MSRP is recorded as not published. Option and package prices are still the configurator's.
- **No Edmunds price to compare:** GLS 450, which Edmunds gives only as an estimate, and the CLE Coupe trims, whose Edmunds 2027 page failed to load.
- **AMG GT 43 drivetrain is left blank.** mbusa MY2027 doesn't list 4MATIC for it, though it does for the GT 55 and 63. Edmunds MY2026 says AWD.
- **Drivetrains taken from Edmunds,** because mbusa's feature list doesn't state them: GLC 300 RWD, C 300 RWD, E 350 RWD, CLA 220 Hybrid FWD and SL 43 RWD.

## Known gaps and judgment calls

- **AMG G 63.** mbusa publishes only 16 standard-feature highlights for it, so 9 of its 11 common features are blank. It's worth a targeted follow-up before promotion.
- **MANUFAKTUR upholstery at $0.** Several upholsteries priced at $0 have no package requirement attached on GLS, GLE 63, AMG GT and Maybach S. That's what the configurator shows. I couldn't confirm it by selecting one in the live tool, and each affected row says so.
- **Digital Extras.** On some trims, adaptive cruise and the 360° camera appear as Mercedes "Digital Extras", which are subscription software after any trial. They are marked Standard with a note.
- **Maybach S-Class.** Passenger capacity isn't published in its configurator specs, so the base seating line is blank.
- **CLA 220 Hybrid.** It is coded as gasoline in mbusa's data. It's recorded as `Hybrid` with a note.

## Sources

- mbusa.com Build & Price, one page per trim. The URLs are in each row's `sources` column, for example https://www.mbusa.com/en/vehicles/build/glc/suv/glc300w.
- mbusa.com All Vehicles: https://www.mbusa.com/en/all-vehicles
- Edmunds model pages, listed per row. For example: https://www.edmunds.com/mercedes-benz/glc/2027/, https://www.edmunds.com/mercedes-benz/gle/2027/, https://www.edmunds.com/mercedes-benz/amg-gt/2026/, https://www.edmunds.com/mercedes-benz/eqb/
- EQB discontinuation: https://insideevs.com/news/774141/mercedes-benz-eqb-discontinued/
