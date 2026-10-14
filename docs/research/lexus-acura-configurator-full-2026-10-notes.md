# Lexus + Acura configurator research: notes (2026-10-10)

Deliverable: `data/lexus-acura-configurator-full-2026-10.csv`. It has 113 rows: Lexus has 95 (64 for 2026, 31 for 2027) and Acura has 18 (all 2026). Columns are the same 18 as the Toyota CSV, in the same order, with one row per trim. FWD/AWD/RWD and transmission choices are folded into `drivetrain_engine_variants`.

Every option item is written as `name | availability | price | package`. Availability is always one of Standard, Standalone, Package-only or Unavailable, and prices are plain numbers.

A format check found 0 errors. Every Package-only item resolves to a package in the same row, and no interior list repeats the exterior names. One cell is left blank on purpose: TX 2026 500h F SPORT Performance Premium `roof_options` (see Known gaps).

## How the data was sourced
- **Lexus:** taken from lexus.com/build (ZIP 67202), which reads from Lexus' own data feed (`api.build.orc.lexus.com/series` and `/configuration`). The feed was pulled for all 125 trim codes on 2026-10-10 and covered:
  - base MSRP and destination
  - paint and interior lists with prices
  - wheels, including which package each package wheel belongs to
  - packages with their contents
  - standalone factory options
  - the standard-feature list

  `package_definitions` holds both the packages and Lexus' standalone factory options, because the Lexus configurator groups them together as "Packages and Options". Dealer accessories are left out.
- **Acura:** taken from acura.com Build & Price, which reads from Acura's own data feed (`/platform/api/v1/vehicles/2026/{model}/powertrains`, `/packages`, `/configurator`). On Acura, each trim is called a "package" and has a fixed list of standard features. Acura has **no factory packages or options**, so `package_definitions` is empty for Acura. Its configurator extras are all dealer accessories, which are left out.

  Because Acura has no factory options, any common feature that is missing from a trim's standard list is marked Unavailable. Edmunds agrees wherever it shows the feature.
- **Edmunds:** used as the cross-check for MSRP, destination, engine displacement and transmission, seat materials, color names, and features the manufacturers don't list. It was checked through the /msrp/, /trims/ and /features-specs/ pages.
- **Prices:** all MSRPs exclude destination. Option, paint, package and wheel prices are deltas over the base MSRP.
- **Destination charges:**
  - Lexus: $1,395 for NX, UX, IS, ES and RZ; $1,550 for RX, GX, TX, LX and TZ.
  - Acura: $1,395 for Integra; $1,550 for SUVs.

## Scope
- **Lexus 2026:** UX, NX (350/350h/450h+), RZ, RX (350/350h/500h/450h+), TX (350/500h/550h+), GX, LX (600/700h), IS, ES (350h/350e/500e).
- **Lexus 2027** (already on sale with live pricing): RX, LX, IS and ES, which have 2026 rows too, plus TZ.
- **Acura 2026:** Integra (including Type S), ADX, RDX, MDX (including Type S Advance).
- **Excluded:**
  - Lexus LC and LS: lexus.com/build/LC and /LS now redirect to retirement pages ("LC line has been retired"; "final few 2026 LS 500 AWD Heritage Edition models"). The Lexus feed still returns 2026 data for both, but there is no live configurator.
  - All Lexus 2025 model years, and the Acura "Previous models: 2025 RDX" builder.
  - Acura TLX, ZDX and RSX: none of them are on the Acura Build & Price page.

## Naming conventions (so import matching works)
- **Lexus:**
  - `model` is the series (RX, NX, ES…) and `trim` is the grade without the series prefix or drivetrain (e.g. `350h Premium`, `500h F SPORT Performance`). This matches the matchmaker dataset.
  - GX trims drop the "550" because there is only one GX engine.
  - Edmunds names the TX 500h trims "500h F SPORT Premium/Luxury", without "Performance".
- **Acura:**
  - `trim` uses Acura's own names: Base, A-Spec, A-Spec with Technology, A-Spec with Advance, Technology, Advance, A-Spec Advance, Type S, Type S Advance.
  - The matchmaker dataset uses different wording ("A-Spec w/Technology Package", "Advance Package", MDX "Type S"), so the import will need an alias map for these.

## Key discrepancies
- **Lexus NX 450h+ (all three trims):** Edmunds' MSRP page is $300 below Lexus base plus destination. Cars.com confirms Lexus' $58,110 base for the Premium, so the Lexus figure is used.
- **Lexus UX 2026:** Edmunds contradicts itself. Its MSRP page is $1,195 over the Lexus base, while its model page matches Lexus base plus $1,395. The Lexus figure is used.
- **Acura ADX:** Edmunds lists the A-Spec $200 lower and the A-Spec with Advance $400 lower than acura.com. This is likely a price increase Edmunds hasn't picked up yet, so the acura.com figure is used.
- **All other 2026 base MSRPs match Edmunds exactly:**
  - Lexus RX, GX, ES, TX, IS (except the Special Appearance Package), RZ, LX, and the NX 350/350h.
  - Every Integra, RDX and MDX trim, plus the ADX Base.
- **Lexus 2027 pricing is Lexus-only.** Edmunds' 2027 RX, ES and LX pages did not load, and its IS and TZ 2027 pages are preview pages with no MSRPs.
- **Lexus TZ seating:** Lexus' feed says 5 seats, but Lexus' own feature list (second-row captain's chairs plus a 50/50 third row) and Edmunds' preview both say 6. 6 is used.
- **2027 Lexus extra-cost paints** are $650 (2026 was $500 or $595); the no-cost paints stay $0. These are recorded per row, not assumed.
- **Lexus drivetrain differences inside merged rows** are listed in discrepancy_notes:
  - IS F SPORT Handling Package is $1,090 RWD vs $700 AWD.
  - UX Special Appearance Package is $165 FWD vs $180 AWD.
  - IS wheels come with summer tires on RWD and all-season tires on AWD.
- **Edmunds data conflicts:**
  - NX 350h displacement: Edmunds gives both 2.4L and 2.5L; 2.5L is used.
  - IS 350 AWD transmission: Edmunds gives both 6-speed and 8-speed, so the transmission is left out of that variant.
- **Interior lists:** none of the Lexus or Acura interior lists repeat the exterior names, in either the OEM data or Edmunds. Acura interiors are tied to specific paints; each row's confidence_notes lists the pairings.

## Known gaps (left blank on purpose, never guessed)
- **TX 2026 500h F SPORT Performance Premium, roof:** Lexus offers no roof as standard, package or option. Edmunds' table says Not Available, but its text says the roof is standard. The roof column and Moonroof feature are left blank.
- **IS 350 (all trims), power trunk:** not confirmed by Lexus or Edmunds, so it is left out.
- **IS 350 F SPORT Design, heated steering wheel:** not confirmed by Lexus or Edmunds, so it is left out.
- **UX 300h base, heated steering wheel:** not confirmed by Lexus or Edmunds, so it is left out.
- **TZ:** horsepower is not published by Lexus (Edmunds' preview says "up to 402 hp").
- **Common features Unavailable on Lexus rows:** these rely on Lexus' standard-feature list together with its complete list of factory packages and options. Where only one source supports a value, the row says so, e.g. NX 350/350h power liftgate is Standard per Edmunds because Lexus' list is silent.

## Next step
Import as an unpromoted batch, review match rate and cleanliness per make, and promote with Brett's go-ahead.
