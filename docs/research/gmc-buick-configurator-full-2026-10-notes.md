# GMC + Buick configurator research: notes (2026-10-10)

Companion to `data/gmc-buick-configurator-full-2026-10.csv`: **81 rows** (66 GMC, 15 Buick), one row per trim, in the same 18 columns as the Toyota CSV. Every option column uses `name | availability | price | package` items joined by ` ;; `. All 5,168 option items passed a script check:
- availability is one of the four allowed values
- price is a number or blank
- every Package-only item names a package that exists in that row's `package_definitions`

## Method

- **Primary source:** GM's live Build & Price configurators on gmc.com and buick.com, read through the configurator's own data feed. This is the same feed the site uses to draw each step, with ZIP 67201.
  - `trim` gave the trim list, every cab/bed × drive × engine configuration and its MSRP.
  - `configurator-state` gave colors, interiors, wheels, roof, seats, factory options, dealer (LPO) accessories and packages with contents.
  - `standard-features` gave the trim's standard-equipment list.
- **Representative build:** each row's options were read from one build. Pickups use a crew cab short or standard bed; everything else uses the configurator's default. The build is named in `confidence_notes`. `drivetrain_engine_variants` lists every cab/bed/drive/engine combination, priced as the MSRP difference from the standard build.
- **Prices:** Base MSRPs exclude destination, which is given per row in `discrepancy_notes`. Colors with no surcharge shown in the configurator are recorded as 0 (checked against the rendered Terrain exterior page).
- **Packages:**
  - Where an item sits in several packages, the lowest-cost package is named.
  - Some $0 packages exist only inside a priced package. Those are marked "bundled inside …", and the priced parent package is the one referenced instead.
  - Packages GM lists as standard on a trim appear at 0 with "standard equipment on this trim".
- **Edmunds cross-check:** base MSRP for every trim against each model-year's Edmunds page.
- **Live-screen spot check:** the 2026 Terrain Elevation package prices on the rendered Options page matched the feed exactly: Elevation Premium $2,850, Technology II $945, Black Edition $1,395, Hit the Road $575, Floor Liner $350, Interior Protection $325.

## Coverage

| Make | Model | Years | Trims |
|---|---|---|---|
| GMC | Terrain | 2026, 2027 | Elevation, AT4, Denali |
| GMC | Acadia | 2026, 2027 | Elevation, AT4, Denali, Denali Ultimate |
| GMC | Yukon / Yukon XL | 2026, 2027 | Elevation, AT4, Denali, AT4 Ultimate, Denali Ultimate |
| GMC | Canyon | 2026 | Elevation, AT4, Denali, AT4X |
| GMC | Sierra 1500 | 2026 | Pro, SLE, Elevation, SLT, AT4, Denali, AT4X, Denali Ultimate |
| GMC | Sierra 2500HD | 2026 | Pro, SLE, SLT, AT4, AT4X, Denali, Denali Ultimate |
| GMC | Sierra 3500HD | 2026 | Pro, SLE, SLT, AT4, Denali, Denali Ultimate |
| GMC | Sierra EV | 2026 | Elevation, AT4, Denali (range versions combined) |
| GMC | HUMMER EV Pickup / SUV | 2026 | 2X, 3X |
| Buick | Envista, Encore GX, Envision | 2026 | Preferred, Sport Touring, Avenir |
| Buick | Enclave | 2026, 2027 | Preferred, Sport Touring, Avenir |

**MY2027 rows** were included only where a 2027 configurator is live and dealers have 2027 stock. MarketCheck (2026-10-10) showed new 2027 units for Acadia (10,336), Terrain (10,168), Yukon (4,669), Yukon XL (2,645) and Enclave (7,126). Edmunds also lists these as on sale.

## Exclusions

- **2027 Sierra 1500:** gmc.com already has a live 2027 configurator with prices (Pro, Elevation, AT4, AT4X, Denali, Denali Ultimate; SLE and SLT are gone). But Edmunds says it is not yet on sale ("Late 2026"), and MarketCheck shows no 2027 Sierra 1500 dealer listings. Left out under the "already on sale" rule. Add it once inventory appears.
- **Savana (Cargo/Passenger):** a commercial van, and gmc.com has no live configurator for it.
- **Sierra HD Chassis Cab:** a commercial variant and not part of the retail HD configurators.
- **Buick Electra (E5/E7) and other 2027 GMC/Buick nameplates:** the configurator rejects them ("Unsupported Vehicle"). No live US configurator.
- **Sierra 2500HD/3500HD Pro** is kept, because it is sold through the retail configurator. The GMC Pro trims are work-oriented, so drop them if the matchmaker should be retail-only.

## Discrepancies

1. **Recurring $300 gap (manufacturer higher than Edmunds):**
   - 2027 Terrain Elevation and AT4
   - 2027 Acadia Elevation and AT4
   - 2027 Yukon and Yukon XL Elevation and AT4
   - 2026 Sierra 1500 Pro, SLE, Elevation, SLT and AT4X
   - 2026 Sierra 2500HD Pro, SLE, SLT, AT4 and AT4X
   - Buick 2026 Envista Sport Touring, Encore GX Preferred and Sport Touring, Envision Preferred and Sport Touring
   - 2027 Enclave Preferred and Sport Touring

   This matches the unexplained $300 gap already logged for 2027 Chevrolet Equinox. It looks like a GM price increase Edmunds hasn't picked up. The configurator figure is used.
2. **2026 Sierra 3500HD:** gaps of $200–$900 above Edmunds on every trim. Pro is +$600, SLE and SLT +$800, AT4 +$900, Denali +$200, Denali Ultimate +$400.
3. **2026 Sierra 1500 AT4:** GMC prices the standard 3.0L Duramax crew cab short bed 4WD at $68,300 ex-destination. Edmunds lists $67,000 (+$1,300).
4. **Diesel priced below the standard V8:** on Yukon/Yukon XL AT4 Ultimate and Denali Ultimate (both years), the diesel is $1,500 cheaper. On 2026 Sierra 1500 Denali Ultimate it is $1,005 cheaper, and on 2027 Yukon/Yukon XL Denali $510 cheaper. So the configurator's trim cards show the lower diesel price. The CSV uses the standard-engine MSRP, which matches Edmunds, and shows the diesel as a negative variant price.
5. **Edmunds pages contradict themselves on destination:** the FAQ says "including destination" while the specs table says "excludes destination". The specs-table figures match GM's ex-destination base prices exactly, so those were used.
6. **HUMMER EV SUV:** Edmunds' 2026 HUMMER EV page lists only the pickup, so the SUV wasn't cross-checked. In GM's configurator both the 2X and 3X are priced the same as the pickup ($97,200 and $105,300 ex-destination).

Every other trim (47 rows) matches Edmunds' base MSRP exactly.

## Known gaps (see each row's confidence_notes)

- **31 rows omit an item (55 in total):** GM's configurator flags these items as "requires another selection" but doesn't name a package that contains them. Common examples are some panoramic sunroofs, Air Ride suspension and Energy Transfer Pro. They are listed by name and price in confidence_notes rather than guessed into a package.
  - Seven `roof_options` cells are blank for this reason: Acadia Elevation (both years), Canyon Elevation, and Sierra Elevation/SLT/AT4 and 2500HD SLT. The sunroof is offered on these trims, but its prerequisite isn't exposed.
- **Key features in common_features:** leather, heated and ventilated seats, heated wheel, power liftgate/tailgate, adaptive cruise, wireless charging, Super Cruise, head-up display, Rear Camera Mirror and HD Surround Vision. Each is tagged Unavailable only when it appears neither in GM's standard-feature list nor as an option or package item for that trim.
  - Leatherette, CoreTec and "leather-alternative" upholstery are not counted as leather.
  - Pickup tailgates with only "power lock & release" (MultiPro, EZ-Lift) are counted as not power-operated.
- **Some package contents** reference RPO codes that the configurator doesn't name. They are written as "RPO XXX (name not exposed by configurator)".
- **Option prices are captured for one build per trim.** Other cab/bed/engine choices can change a few options, for example trailering items on long-bed or diesel trucks.
