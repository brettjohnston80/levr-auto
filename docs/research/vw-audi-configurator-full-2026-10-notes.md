# VW + Audi configurator research — notes (2026-10-10)

Deliverable: `vw-audi-configurator-full-2026-10.csv`, 90 rows (VW 31, Audi 59): one row per trim per model year, in the same 18 columns as the Toyota CSV. Every option column uses `name | availability | price | package`. Availability is always Standard, Standalone, Package-only or Unavailable, and prices are plain numbers. Validator result: 0 errors. 38 rows leave out one or more of the 7 common features on purpose because the feature couldn't be confirmed, and each row's confidence_notes says which and why.

All prices are MSRP deltas that exclude destination. Base MSRPs and destination charges for each row are in its notes columns.

## How the data was sourced
- **Audi.** All 59 rows come from the live audiusa.com Build & Price, read from the configurator's own data feed (omnigraph.audi.com). That feed gives every model's base price, destination, and each paint, wheel, interior, package (with Audi's contents list) and option, with its availability and price. A copy of each configurator page's data was saved as evidence; the exceptions are A8, RS 6 Avant and RS e-tron GT 2026, which were read from the visible page because the script failed there. Edmunds was the cross-check and the source for standard features the feed doesn't expose, such as power liftgate and wireless charging.
  - Automated check: 435 paint prices and 171 package and wheel prices in the CSV were re-compared against those saved copies, with 0 mismatches.
- **VW.** Rows come from the live vw.com builder, checked trim by trim. Every paint, interior, wheel and package price was clicked through, and model year and destination were read from the builder's as-built totals. Edmunds, VW order guides and KBB were the cross-check and the source for standard equipment, since the builder doesn't list standard features.

## Model years (as served by each live configurator on 2026-10-10)
- **VW 2027:** Taos, Jetta, Jetta GLI.
- **VW 2026:** Tiguan, Atlas, Atlas Cross Sport, Golf GTI, Golf R, ID.4.
- **Audi 2027:** A3, S3, RS 3, A5, S5, A6 sedan, A8, S8, Q3, Q5, Q5 Sportback, SQ5, SQ5 Sportback, Q6 / Q6 Sportback / SQ6 / SQ6 Sportback e-tron, A6 / S6 Sportback e-tron, Q7, SQ7, Q8, SQ8, RS Q8, Q9, SQ9, RS e-tron GT.
- **Audi 2026:** RS 7, RS 6 Avant, Q4 e-tron, Q4 Sportback e-tron, S e-tron GT, plus Q7 / SQ7 and RS e-tron GT, which are configurable in both years and have rows for both.

## Excluded
- **VW ID. Buzz:** the vw.com builder serves only MY2025 (`modelYear-app=2025`). The 2027 Buzz is announced but has no builder or pricing yet.
- **Audi A6 allroad:** the 2026 build page shows only a maintenance message, the 2027 page returns a 404, and the model isn't on audiusa.com's models list.
- **Audi RS 5 (2027):** no US configurator was found. The build URL tried, which was inferred from Audi's URL pattern, returned a 404.
- **Audi Nuvolari:** listed on audiusa.com but has no Build link.
- **Commercial / discontinued:**
  - No VW or Audi commercial vehicles are configurable in the US.
  - Discontinued and not configurable: VW base Golf, VW Arteon, Audi A4 / S4 / A7 / S7 / gas S6, Q8 e-tron, 2025-only Q5 plug-in hybrid, S e-tron GT 2027.
- **Dealer accessories** (mats, splash guards, VW Care, telematics) are excluded. Factory options with no column of their own, such as the trailer hitch and B&O audio, are listed in package_definitions or the notes.

## Key discrepancies (manufacturer configurator vs Edmunds / earlier data)
- **Audi model years run ahead of third-party sites.** Edmunds and earlier research still showed 2026 for A3 / S3 / RS 3 and the Q5 family. audiusa.com configures only 2027, and the 2027 lineups are restructured:
  - A3: three priced versions (base, Black optic plus, S line plus) replace Premium / Premium Plus.
  - Q5, Q5 Sportback, SQ5 and SQ5 Sportback: a single Premium trim each.
  - Q3: a single trim.
- **Audi destination is $1,395 on every model.** Edmunds and KBB figures implied $1,295 for some models.
- **Audi base-price differences vs Edmunds:**
  - Q6 and Q6 Sportback e-tron Premium Plus / Prestige are $600 higher on audiusa.com.
  - A6 Sportback e-tron Premium Plus / Prestige are $600 higher.
  - 2026 Q7 55 TFSI versions are $200–$500 higher.
- **RS 7 price conflict resolved:** the configurator gives $132,700. The $130,700 on the RS 7 overview page is the RS 6 price.
- **Paint and interior surcharges** that Edmunds doesn't publish are now filled in from the configurators:
  - Audi: generally $595 for metallic / pearl paint and $0 for solid colors. S8 has 8 standard paints at $0 and 31 Audi exclusive paints at $7,900.
  - VW 2027 Jetta, GLI and Taos paints are $495, up from the MY2026 $455.
- **VW:**
  - Taos AWD is an 8-speed DSG per vw.com; Edmunds says 8-speed automatic.
  - GLI is DSG-only for 2027.
  - GLI black-roof two-tones require the $650 Black Package.
  - Atlas SE Silver Mist is $0; it was blank in the first pass.
- **Audi configurator quirks** (kept out of the data, and explained in the affected rows):
  - The feed flags some generic items as "unavailable" even where the trim highlights list them, for example the plain adaptive-cruise code alongside standard "adaptive cruise assist".
  - SQ7 and SQ9 are labelled front-wheel drive in Audi's data. This is an error; they are recorded as AWD.

## Known gaps (left blank or omitted, never guessed)
- **Standard features with no confirming source**, mostly Audi power liftgate and wireless charging, and Q5-family heated steering wheel. These are omitted per row.
- **Paint prices still blank:**
  - Audi A8: 5 of 6 paint prices.
  - Audi RS 6 Avant: 7 of 8 paint prices.
  - Audi RS e-tron GT 2026: 8 paint prices.
  - In all three cases the configurator script failed and only the default build's color price was visible. A8 and RS 6 package contents come from Cars.com instead.
- **Engine detail:** engine displacement and horsepower for Audi come from Edmunds, because the configurator labels engines only by name, such as "TFSI".
- **ID.4:** production ended in April 2026, and the 2026 cars are still in the vw.com builder. Drop these rows if the builder is pulled.

## Sources
- Manufacturer: https://www.vw.com/en/builder.html (model apps `/__app/<model>.app`); https://www.audiusa.com/en/models/ and each `/en/models/<line>/<model>/<year>/overview/build/` page. Exact URLs are in each row's `sources` column.
- Cross-check: Edmunds features-specs and style pages for each model/year (in each row's sources). VW 2026 dealer order guides, KBB and Cars.com were used only where cited in a row's notes.
