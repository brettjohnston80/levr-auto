# Mitsubishi + Polestar + Lucid configurator re-research (2026-10-11)

Companion to `data/mitsubishi-polestar-lucid-configurator-full-2026-10.csv`: 33 rows, one per trim, same 18 columns and order as `toyota-configurator-full-2026-09-09.csv`.

## Scope (what's live in each manufacturer's US configurator today)

| Make | Model | MY | Trims (rows) |
|---|---|---|---|
| Mitsubishi | Outlander | 2026 | ES, LE, SE, SEL, Trail Edition, Ralliart, Black Edition (7) |
| Mitsubishi | Outlander PHEV | 2026 | ES, SE, SEL, Black Edition (4) |
| Mitsubishi | Outlander Sport | 2027 | S, ES, LE, SE, SEL, Trail Edition, Ralliart (7) |
| Mitsubishi | Eclipse Cross | 2026 | ES, LE, SE, Black Edition, SEL, Ralliart (6) |
| Polestar | 4 | 2026 | Rear motor, Dual motor (2) |
| Lucid | Air | 2027 | Pure, Touring, Grand Touring, Sapphire (4) |
| Lucid | Gravity | 2027 | Touring, Grand Touring, GT-S (3) |

## Excluded

- **Polestar 3**: the live US configurator only builds MY2025, so there is no MY2026 configurator. It is excluded under the MY2026-only Polestar rule.
- **Polestar 2**: pre-owned only on polestar.com/us, with no configurator.
- **Polestar 5/6, and any MY2027+ Polestar**: not offered (new MY2027+ sales are banned in the US).
- **Mitsubishi Mirage**: only appears on "history" pages, with no configurator.
- **2026 Outlander Sport**: still present in Mitsubishi's data but flagged not selectable. Only the 2027 can be built.
- **Lucid MY2026 Air/Gravity and Gravity Dream Edition**: Lucid's configurator sells MY2027 only. Dream still shows in stale spec data, but it has no price and isn't offered.

## Sources and method

- **Mitsubishi**: mitsubishicars.com configurator. Its data files were read directly: `buildandpricedata-live.mitsubishi.zlthunder.net/us_en/{year}/legacy/{model}_{year}/base.json` (trims, packages, paint and interior compatibility, prices) and `tech.json` (per-trim STD/PKG/– spec sheet).
- **Polestar**: polestar.com/us/configure/polestar-4-coupe. The configurator's own price, rules and feature data were read. Prices in the build script are checked against the saved price data.
- **Lucid**: lucidmotors.com/configure and /configure/gravity. The configurator's embedded data was read (options, per-trim prices, which options each trim offers and which choices remove others, package contents). Three trickier Air Touring cases were confirmed by clicking through the live UI:
  - The 19" Aeronaut wheels are not offered.
  - Leather comes only with 14-way seats.
  - Leather auto-adds the Comfort & Convenience Package, for a total of $85,900.
- **Edmunds** cross-check: per-model msrp/features-specs/review pages. URLs are in each row's `sources` column.
- The raw Mitsubishi and Polestar data files were deleted from ~/Downloads after use, as requested. Chrome did not save the Lucid file (that site's download never landed). Lucid rows were built from the configurator data read in the browser instead.

## Discrepancies worth knowing

- **Mitsubishi destination**: the configurator data says $1,995 for all four models. Edmunds' "with destination" prices imply $1,745 ($1,795 for Outlander Sport). Every trim's base MSRP matches Edmunds exactly once that gap is removed. The configurator value is used.
- **Mitsubishi mandatory port-installed items** are added to the built price but are not factory options. They are noted per row:
  - Tonneau Cover $240 (Outlander, Outlander PHEV, Eclipse Cross)
  - Welcome Package $215 / $260; RALLIART and Trail Welcome $75 / $140 (Outlander Sport, Eclipse Cross)
- **Outlander PHEV top trim**: Edmunds calls it "SEL Black Edition"; the configurator calls it "Black Edition".
- **Polestar 4 trim structure**: Edmunds lists 4 trims (Single/Dual Motor, each with or without Plus). Polestar sells 2 versions with a $5,500 Plus Pack. Prices match exactly ($56,400 / $62,900 + $1,400 destination). Edmunds' review says no full-speed adaptive cruise; the configurator lists ACC as standard.
- **Lucid**: Edmunds' 2027 pages don't load and Edmunds doesn't list GT-S yet, so MY2027 Lucid pricing could not be cross-checked. Edmunds' 2025 data implies the same $1,500 Air destination. Its Gravity "from $81,750" equals $79,900 + $1,850.
- **Lucid Air Sapphire roof**: Lucid's trim data lists only the aluminum roof, but its own interior text says "standard Glass Canopy roof". The roof column follows the trim data.
- **Lucid priced-but-not-selectable options**: some options carry a price but are removed by every appearance or interior choice, so they are tagged Unavailable:
  - Air Touring: 19" Aeronaut wheels ($600), 20-way massage seats ($3,750)
  - Air Grand Touring: 21" Aero Blade wheels

## Import notes

- **Blank availability means "not confirmed"** (parser `unknown`, per the 2026-10-11 decision). It is used only where the manufacturer's own data never mentions the feature at all. 138 items, mostly on Outlander Sport and Eclipse Cross, where Mitsubishi's spec sheet has no row for wireless charging, power liftgate, adaptive cruise and similar features. Edmunds doesn't mention them either.
- **Mitsubishi FWD/AWD** are separate configurator trims. They are folded into one row with drivetrain `FWD/AWD`. Where AWD also adds equipment (Outlander ES adds heated seats; Outlander SE adds MI-PILOT adaptive cruise), the AWD variant and those items point at an `S-AWC Upgrade` package priced at the AWD premium ($1,800).
- **Lucid Gravity's Luxury Seating Package** is defined at $0 because it comes with any upgraded interior. The interior line carries the price.
- **Recommended import flag**: `blankPriceUnknown: true`. Package-only lines leave the price blank because the package price carries it.
- **Validation**: the file was run through the repo's own `src/lib/configurator-parse.ts`. 33 rows parsed, 0 package-only items dropped, 0 option names altered by the parser, and every availability is exact or a deliberate blank.
- **Polestar** rows are MY2026 only, consistent with the locked promotion decision.
