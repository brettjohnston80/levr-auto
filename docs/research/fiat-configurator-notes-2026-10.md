# FIAT configurator data: notes (2026-10-15)

Goes with `data/fiat-configurator-full-2026-10.csv`: 2 trim rows (500e POP, 500e ICONA, MY2026), same 18 columns and cell format as the Toyota file. Matchmaker rows for both trims are in `data/matchmaker-additions-wave3-2026-10.csv`.

## Coverage

FIAT's US Build & Price selector shows **one vehicle: the 2026 500e**, with two trims. No 2027 model is on it.

| Trim | Base MSRP | Destination | Standard tires | Notes |
|---|---|---|---|---|
| POP | $35,700 | $1,995 | 205/45R17 all-season | Comfort Group $600 (floor console with armrest, heated front seats, "500" steering wheel; switches to summer tires) |
| ICONA | $37,700 | $1,995 | 205/45R17 summer | Heated seats and wireless charging standard; Active Driving Assist $1,250; JBL audio $750 |

Paint: Glacier White no charge, every other color +$700 on both trims. Choosing Red by (RED) adds the no-cost (RED) Signature Items Package.

Parser check (`configurator-parse.ts`, `blankPriceUnknown`): 61 options, 0 dropped, 0 unpriced extra-cost options.

## Sources

- FIAT Build & Price: https://www.fiatusa.com/shopping-tools/bmo.fiat_500e#/models/2026/fiat_500e (Kansas pricing, ZIP 67212)
- Its data feeds, read in Chrome (same Stellantis feeds used for Dodge/Chrysler in Wave 2): `https://www.fiatusa.com/hostd/api/cvd/CUX202604/CUX202604_CVD.json`, the per-trim configure, option-detail and equipment-category feeds (URLs in each row's `sources`). Package contents come from the configurator's own "Includes" pop-up.
- Horsepower (117 hp): https://www.fiatusa.com/fiat-world/fiat-life/whats-new-for-2026-Fiat-500e. The configurator itself lists only "400V Front Electric Drive Motor" and "Front-Offset 1-Speed Gearbox".
- Backup only: KBB 2026 500e specs (https://www.kbb.com/fiat/500e/2026/specs/) to cross-check prices ($37,695 / $39,695 including destination, which match).

## Rules applied

- Trim names use FIAT's styling: `POP`, `ICONA` (all caps, as on fiatusa.com).
- Engine line: `Electric, 117 hp, single-speed, FWD`.
- Body `Hatchback`, fuel `EV`, drivetrain `FWD`.
- Paint names drop FIAT's "Exterior Paint" suffix (e.g. "Tennis Ball Clear-Coat Exterior Paint" → "Tennis Ball Clear-Coat").
- Unavailable = not in the trim's configurator option or equipment data (same rule as the Wave 2 Dodge file): no moonroof, power liftgate or heated steering wheel on either trim; no adaptive cruise on POP.

## Could not confirm

- **Matchmaker EPA figures depend on tires.** EPA lists the 500e twice: 127/104/116 MPGe and 149 mi on standard tires, 121/100/110 MPGe and 141 mi on all-season tires. FIAT's configurator shows POP comes with all-season tires and ICONA with summer tires, so POP gets 121/100/110 and 141 mi, ICONA 127/104/116 and 149 mi. That mapping is ours (from the tire fitment); the EPA data itself doesn't name trims.
- **Warranty.** The configurator's spec data gives 48 months / 50,000 miles basic. KBB gives 4/50k powertrain as well; JD Power says 3/40k basic and 5/60k powertrain. KBB/configurator figures are used.
- **Seating 4, doors 2:** from fiatusa.com and KBB.

## Deliberately excluded

- **FIAT Topolino.** fiatusa.com sells it as a low-speed vehicle ("Urban Microcar & Low-Speed Vehicle"; a street-legal conversion kit is "expected fall 2026"). It isn't on Build & Price and isn't a highway car for the Matchmaker.
- **500e Giorgio Armani Collector's Edition.** Still has a page on fiatusa.com but isn't on the 2026 Build & Price selector.
- **FIAT 500 Hybrid.** Not sold in the US.

## Possible naming mismatches with MarketCheck

- **Make spelling:** stored as `Fiat` (EPA and most data sources). FIAT brands itself "FIAT", and MarketCheck may too; the sync's case-insensitive make handling (Fix B) should cover it.
- **Trims:** MarketCheck may return "Pop"/"Icona" (title case) or nothing (500e listings often have no trim). Case-only differences are handled by the case-insensitive trim lookup.
