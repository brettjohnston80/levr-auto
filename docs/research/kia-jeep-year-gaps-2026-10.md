# Kia Sportage 2026 + Jeep Grand Cherokee 2027 / Limited Reserve 2026: model-year gap fill

**Date:** 2026-10-10 · **Companion file:** `data/kia-jeep-year-gaps-2026-10.csv` (21 rows, same 18 columns as the Toyota reference CSV)

| Request | Result | Rows |
|---|---|---|
| 2026 Kia Sportage, every trim | Gas, Hybrid and Plug-in Hybrid, all from kia.com's MY2026 Build & Price data | 13 |
| 2027 Jeep Grand Cherokee, every trim incl. Limited Reserve | Laredo, Laredo X, Laredo Altitude, Limited, Limited Reserve, Trailhawk, Summit | 7 |
| 2026 Grand Cherokee Limited Reserve | It existed (4WD only, $51,915). Row added | 1 |

All rows are the 2-row Grand Cherokee. Grand Cherokee L is out of scope.

## Method

**Kia.** kia.com's visible Build & Price page now opens on MY2027. Its data service still serves the complete MY2026 configuration, though: `bnpVehicle/{4AC|4AH|4AP}/2026` for gas, Hybrid and PHEV. That feed has trims, model codes, prices, every color/interior combination with its price, and packages with prices and contents. Each trim's MY2026 feature list came from `featuretable/{series}/2026/{trim}/specs`. Both were read in Chrome on 2026-10-10.
- This replaces the earlier assumption that MY2026 Sportage data was gone from kia.com. Package prices that were blank in the 2027 rows are on the 2026 feed. Examples: LX Convenience $800, EX Panoramic Sunroof $1,000, X-Line Premium $1,500, X-Line Technology $2,500.

**Jeep.** I used the same jeep.com Build & Price data feed and method as `jeep-ram-configurator-full-2026-10.csv`:
- Kansas pricing (ZIP 67212), MSRP before the $1,995 destination charge.
- 4x2 and 4x4 variants merged into one row per trim.
- The same Standard / Standalone / Package-only / Unavailable rules.

All 12 variant configurations were fetched with no access blocks.

**Cross-check.** Edmunds trim/FAQ pricing and features-specs pages for every model-year/series.

**Format.** Every option item has 4 pipe-separated parts, and every availability is one of the four allowed values. Every Package-only item names a package that exists in that row's package_definitions. There are no notes inside option names: variant differences and caveats are in confidence_notes. This was checked programmatically before saving.

## Left blank (not guessed): 3 values

1. **2027 Grand Cherokee Limited Reserve, heated front seats.** The 2027 feed has no heated-front-seat item at all: not standard, not optional, not in a package. It does list ventilated front seats, heated second-row seats and a heated steering wheel, and the 2026 Limited Reserve lists heated front seats as standard. It is very likely a feed omission, but it isn't confirmed. Edmunds' 2027 pages don't break features down by trim.
2. **2026 Sportage SX Prestige, wireless charging.** Not in kia.com's SX Prestige feature list (the lower SX lists it).
3. **2026 Sportage X-Pro Prestige, wireless charging.** Same situation.

Worth a dealer window sticker or a jeep.com/kia.com screen check before promoting.

## Discrepancies

**Kia: none on price.** Every 2026 base MSRP matches Edmunds' FAQ exactly, for all 13 trims and both drivetrains. Edmunds' trim-selector figures are those prices plus the $1,495 destination charge.

**Jeep 2027: Edmunds is consistently lower than jeep.com.** Manufacturer figures were used.

| Trim | jeep.com | Edmunds | Diff |
|---|---|---|---|
| Laredo 4x2 / 4x4 | $39,730 / $41,730 | $39,520 / $41,520 | +$210 |
| Laredo X 4x2 / 4x4 | $42,225 / $44,225 | $42,015 / $44,015 | +$210 |
| Laredo Altitude 4x2 / 4x4 | $45,170 / $47,170 | $44,960 / $46,960 | +$210 |
| Limited 4x2 / 4x4 | $45,130 / $47,130 | $44,960 / $46,960 | +$170 |
| Limited Reserve 4x4 | $52,725 | $52,555 | +$170 |
| Trailhawk 4x4 | $53,030 | $53,000 | +$30 |
| Summit 4x4 | $61,130 | $60,900 | +$230 |

The gap is uniform by trim, which looks like Edmunds still carries an earlier 2027 price list.

Other Jeep items:
- Summit's Advanced ProTech Group IV is $495 on jeep.com but +$0 on Edmunds.
- Trailhawk's "Starting at" on jeep.com is $53,625 because High-Gloss Black paint ($595) is pre-selected. The base is $53,030.
- Edmunds' 2027 page mentions an "Overland" trim with no price. It isn't on jeep.com's 2027 configurator, so there's no row.

**Jeep 2026 Limited Reserve: exact match.** $51,915 on both.

## Things worth knowing before import

- **Supersedes an earlier row.** The 2027 Limited Reserve row here replaces the one in `jeep-mazda-gap-trims-2026-10.csv`, which was built from Edmunds, cars.com, KBB and one window sticker because jeep.com couldn't be read then. Exclude that older row so the trim isn't duplicated.
  - Price: the old row carried four conflicting prices. jeep.com's own figure is $52,725.
  - Colors: the old row used a union of 7 colors from cars.com and Edmunds. jeep.com offers 6 for 2027: Sting-Gray, Steel Blue, High-Gloss Black, Bright White, Copper Shino, Fathom Blue.
  - 2CR package: the window sticker's "Quick Order Package 2CR $5,595" is shown on jeep.com as the trim's standard $0 Customer Preferred Package 2CR. In other words, its contents are standard on the 2027 Limited Reserve.
- **2027 Grand Cherokee changes vs 2026:**
  - Laredo and Laredo X use the 3.6L Pentastar V6. Laredo Altitude and up use the 2.0L Hurricane 4 Turbo.
  - Trailhawk is new for 2027. It isn't on the 2026 configurator.
  - 85th Anniversary Edition is gone.
  - The 2027 color palette changed.
- **Laredo (2027) shows heated seats, heated wheel, power liftgate and wireless charging as Unavailable.** None of them appear in its equipment, options or packages. That rests on the jeep.com feed alone, because Edmunds doesn't break 2027 features down by trim.
- **Kia common_features use the same 7 checks as the Jeep and Toyota-style rows,** not the longer feature list in the existing 2027 Sportage rows. Leather is Unavailable on every Sportage (SynTex or cloth). For Kia, "Unavailable" means the item isn't in kia.com's trim feature list or packages. That list is a highlights list, which the confidence_notes say.
- **Kia variants that differ by drivetrain** are noted in confidence_notes rather than in option names:
  - LX: heated front seats are standard on AWD and Package-only on FWD.
  - EX: low-profile silver roof rails come on AWD only.
- **X-Pro Prestige two-tone roof:** the $595 shows on both the colors and the package, but it's one charge, not $1,190.
- **X-Line (gas):** the Technology Package requires the Premium Package. The combined uplift is $4,000.

## Sources

- kia.com Build & Price: https://www.kia.com/us/en/sportage/build · /sportage-hybrid/build · /sportage-plug-in-hybrid/build
- kia.com MY2026 data: https://www.kia.com/us/services/en/bnpVehicle/4AC/2026 (also 4AH, 4AP) and https://www.kia.com/us/services/en/featuretable/{series}/2026/{trim}/specs
- jeep.com Build & Price: https://www.jeep.com/vehicle-selector.bmo.html, plus the feeds https://www.jeep.com/hostd/api/cvd/CUJ202720/CUJ202720_CVD.json and CUJ202620, and per-variant configuration, option-detail and equipment-category files
- Edmunds:
  - Sportage 2026: https://www.edmunds.com/kia/sportage/2026/ and /features-specs/
  - Sportage Hybrid 2026: https://www.edmunds.com/kia/sportage-hybrid/2026/ and /features-specs/
  - Sportage Plug-in Hybrid 2026: https://www.edmunds.com/kia/sportage-plug-in-hybrid/2026/ and /features-specs/
  - Grand Cherokee 2027: https://www.edmunds.com/jeep/grand-cherokee/2027/ and /features-specs/
  - Grand Cherokee 2026: https://www.edmunds.com/jeep/grand-cherokee/2026/
