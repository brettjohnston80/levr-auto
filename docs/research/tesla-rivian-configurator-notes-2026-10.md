# Tesla + Rivian configurator re-research (2026-10-25)

Replaces the September 2026 Tesla (`tesla-configurator-full-2026-09-16`) and Rivian (`rivian-lucid-configurator-full-2026-09-16`, Rivian rows only) research.

- **Output:** `data/tesla-rivian-configurator-full-2026-10.csv`. It has 17 rows (one per trim) in the same 18 columns, in the same order, as the Toyota CSV.
- **Cell format:** option cells use `Name | Availability | Price | Package`, joined with ` ;; `.
- **Prices:** plain numbers, excluding destination. Trim base price and fees are in `confidence_notes`, because the template has no price or destination column.
- **Sources:** each manufacturer's live US configurator, read 2026-10-25 in a browser.
  - **Tesla:** the configurator's own option and price data (lexicon effective 2026-10-23; Cybertruck 2026-10-06), checked against what the page shows with Cash selected.
  - **Rivian:** the configurator ruleset (R1 version R2C_26.0, effective 2026-10-21; R2 version R2C_2.4, effective 2026-09-22), plus the builder summary and Compare panels.
  - **Cross-check:** Edmunds and KBB.
- **MarketCheck:** not used.
- **Validation:** the CSV was checked by script. Every row has 18 fields, every option item has 4 parts, availability is one of the four allowed values, prices are numbers or blank, and every Package-only item names a package in that row's `package_definitions`.

## Rows (17)

| Make | Model | Trim | MY | Base price | Destination | Order fee |
|---|---|---|---|---|---|---|
| Tesla | Model 3 | Standard (RWD) | 2027 | 36,990 | 1,390 | 250 |
| Tesla | Model 3 | Premium (RWD; AWD +5,000) | 2027 | 42,490 | 1,390 | 250 |
| Tesla | Model 3 | Performance | 2027 | 54,990 | 1,390 | 250 |
| Tesla | Model Y | Standard (RWD; AWD +2,000) | 2027 | 39,990 | 1,390 | 250 |
| Tesla | Model Y | Premium (RWD; AWD +4,000) | 2027 | 45,990 | 1,390 | 250 |
| Tesla | Model Y | Performance | 2027 | 57,990 | 1,390 | 250 |
| Tesla | Model Y L | Premium (Launch Series) | 2027 | 61,990 | 1,390 | 250 |
| Tesla | Cybertruck | Dual Motor AWD | 2026 | 74,990 | 1,995 | 250 |
| Tesla | Cybertruck | Premium AWD | 2026 | 84,990 | 1,995 | 250 |
| Tesla | Cybertruck | Cyberbeast | 2026 | 99,990 | 1,995 | 250 |
| Rivian | R1T | Premium (Long Range +7,000) | 2027 | 79,990 | 1,895 | — ($500 deposit) |
| Rivian | R1T | Performance | 2027 | 100,990 | 1,895 | — ($500 deposit) |
| Rivian | R1T | Quad | 2027 | 115,990 | 1,895 | — ($500 deposit) |
| Rivian | R1S | Premium (Long Range +7,000) | 2027 | 83,990 | 1,895 | — ($500 deposit) |
| Rivian | R1S | Performance | 2027 | 106,990 | 1,895 | — ($500 deposit) |
| Rivian | R1S | Quad | 2027 | 121,990 | 1,895 | — ($500 deposit) |
| Rivian | R2 | Performance | 2027 | 57,990 | 1,495 | — |

**Full sticker total = base price + options + destination (+ the Tesla order fee).**

- **Tesla:** the $1,640 (Model 3/Y) and $2,245 (Cybertruck) fee totals are confirmed on tesla.com.
  - Model 3 "starts at $38,630", Model Y L "$63,630" and Cybertruck Premium AWD "$87,235", each "including Destination and Order Fees".
  - The split between destination ($1,390 / $1,995) and order fee comes from Edmunds, KBB and Cars.com. The $250 order fee itself also appears in Tesla's configurator data, marked non-refundable.
- **Rivian:** destination is shown in the configurator summary. The $500 order deposit is non-refundable but is applied to the vehicle price, so it is not an extra fee. Neither maker shows a documentation fee.

## Model availability answers

**Tesla Model S and Model X are not orderable new in the US.**
- `tesla.com/models/design` and `tesla.com/modelx/design` both redirect to the new Model Y inventory page.
- The new-inventory model filter offers only Model 3, Model Y and Cybertruck.
- Press coverage agrees: InsideEVs (2026-04-01) reported custom orders closed; Not a Tesla App (2026-04-02) reported US Model X inventory sold out and Model S nearly gone.
- Both are excluded.

**Tesla model years.**
- Tesla's configurator does not show a model year on screen. Its data sets the default year to 2027 for Model 3 and Model Y and to 2026 for Cybertruck, so those are recorded.
- Edmunds' 2027 Model 3 and Model Y pages exist but have no per-trim prices yet ("Late 2026").
- KBB already has a 2027 Cybertruck page; the configurator still says 2026.

**Rivian R1T and R1S: only model year 2027 is configurable.**
- The model-year group in the ruleset contains only 2027.
- 2027 replaced the 2026 Dual/Tri/Quad names with three builds: Premium (dual motor, Large battery or $7,000 Long Range/Max battery), Performance (tri motor) and Quad.
- New 2026 R1s are still sold from inventory only (see offers below), so they are not included as rows.

**Rivian R2: only Performance is orderable today.**

| R2 trim | Status on the configurator | Price | Rivian's spec |
|---|---|---|---|
| Performance | "Available now" — included | 57,990 | 656 hp, 330 mi |
| Premium | "Coming late 2026" (flagged as future in the ruleset) | 53,990 | 450 hp, 330 mi EPA est. |
| Standard | "Coming spring 2027" (flagged as future in the ruleset) | 44,990 | 350 hp, 275 mi est., single-motor RWD; Long Range RWD +3,500 and AWD Long Range +7,000 shown as options |

- Even for Performance, checkout requires an existing R2 reservation; anyone else can only reserve and join the waitlist.

**Rivian R3 / R3X: not included.** `rivian.com/configurations/builder/r3` redirects to the R1S builder. There is no R3 configurator and no prices.

## Current manufacturer offers (checked 2026-10-25; NOT subtracted from any price)

**Tesla** (tesla.com/current-offers and configurator banners):
- **Model 3 financing:** 1.99% APR up to 72 months on Performance; 2.49% on Premium RWD and Premium AWD. For orders on or after 2026-09-28, well-qualified buyers, 5% down.
- **Model 3 lease:** from $439/mo with $3,000 down, 36 months, 10k mi/yr, $695 acquisition fee. Applications after 2026-10-22.
- **Model Y financing:** 2.49% APR up to 72 months on RWD, AWD, Premium RWD and Premium AWD; 3.99% on Performance. For orders on or after 2026-10-22.
- **Model Y lease:** from $499/mo with $3,000 down.
- **Model Y L Premium Launch Series:** one year each of free FSD (Supervised), Premium Connectivity and Supercharging, plus "Free Interior and Exterior Options" and Launch Series badging.
  - The configurator still lists option prices for the Model Y L, so the CSV keeps them. See the discrepancies section.
- **Cybertruck:** lease from $1,129/mo with $5,000 down, based on Premium AWD. Section 179 business deduction up to $31,300 (a tax benefit, not a Tesla discount).
- **All models:**
  - 2,000 free Supercharging miles with a gas or hybrid trade-in.
  - $500 off for American Heroes: military, first responders, healthcare workers, teachers and students, verified through ID.me.
  - FSD (Supervised) subscription at $99/mo with a 30-day trial.
  - Premium Connectivity trial: 30 days on Model 3 and Model Y, one year on Cybertruck.
  - Federal auto-loan interest deduction up to $10,000 (a tax item, not a Tesla offer).
- The configurator also shows state incentives by ZIP code. These are state programs, not Tesla offers.

**Rivian** (offers loaded by the configurator, all valid 2026-10-01 to 2026-11-02 for an approved offer, with delivery by 2026-11-30 unless noted):
- 1.99% APR for 60 months on 2026 R1 Dual Standard, Dual Large, Dual Max and Tri (inventory).
- 3.99% APR for 60 months on 2027 R1 Premium and Performance.
- 3.99% APR for 60 months on 2026 R1 Quad (inventory).
- $1,500 lease bonus on 2026 R1 Dual or Tri, 24- or 36-month lease.
- **California only:** MyFirstEV credit of $3,500 on a new vehicle or $1,750 on a pre-owned vehicle (no end date).
- **Example 2027 leases:**
  - R1T Premium: $1,199/mo, 36 months, $9,094 due at signing.
  - R1T Performance: $1,649/mo.
  - R1T Quad: $2,049/mo.
  - R1S Premium: $1,209/mo.
  - R1S Performance: $1,689/mo.
  - R1S Quad: $2,099/mo.
  - All include a $7,000 cap-cost reduction, an $895 acquisition fee and a $495 disposition fee.
- **R2:** the Launch Package (Autonomy+, Tow Package, Launch key fob, Launch Green paint access) is included free "for a limited time". It is recorded as a $0 package because the configurator prices it at $0.

## Software add-ons

- **Tesla Full Self-Driving (Supervised):** subscription-only at $99/mo. The $8,000 one-time purchase ended 2026-02-14.
  - It is listed in each Tesla row's common features as Standalone with a blank price, because there is no purchase price.
  - A February 2026 report says the Cyberbeast includes lifetime FSD through a "Premium Package". The configurator shows only the subscription, so the CSV doesn't record lifetime FSD.
- **Tesla Premium Connectivity:** included free on Model 3 Performance, Model Y Performance and Cyberbeast according to the configurator data. Otherwise it is a trial, then a subscription.
- **Rivian Autonomy+:** $2,500 one-time purchase on every 2027 R1 build, Standalone. It transfers with the vehicle. On the R2 Performance it is included in the Launch Package.
- **Rivian Connect+:** 60-day trial only. The "Connect+ Lifetime Upgrade" option is hidden on all 2027 R1 builds, so the CSV marks it Unavailable; after the trial it is a subscription.

## Discrepancies (manufacturer site used in every case)

1. **Edmunds and KBB add fees differently.** Edmunds' "with destination" figures add destination only. KBB's Tesla prices add destination plus the $250 order fee. Every configurator base price matches one of them after removing those fees.
2. **Stale third-party Tesla pages:**
   - Edmunds' 2026 Model Y page shows Premium 44,990 / 48,990 and Performance 57,490. The configurator shows 45,990 / 49,990 and 57,990.
   - KBB's 2026 Model Y and 2026 Cybertruck pages show older bases: Cybertruck AWD 79,990 and Cyberbeast 114,990, with no Premium AWD.
   - Edmunds' Cybertruck pricing section still lists a "Base" at 81,985.
   - Cybertruck prices rose about 2026-08-26, from 69,990 / 79,990 to 74,990 / 84,990. The Cyberbeast stayed at 99,990.
3. **Trims missing from KBB:** no Model 3 Premium AWD, no Model Y Standard AWD, no Model Y Premium AWD, no Model Y L.
4. **Model Y L option prices.** Tesla's offers page says the Launch Series includes free interior and exterior options, but the configurator data prices them: Zen Grey interior +1,000, 20-in wheels +2,000, paints up to +2,000. The listed prices are kept.
5. **Horsepower and battery.**
   - Tesla publishes horsepower only for Model 3 Performance (528 hp) and Cyberbeast (845 hp), and battery size only for Cybertruck (123 kWh). Those are the only Tesla figures in the drivetrain lines.
   - KBB shows "0 hp" placeholders for Tesla, 600 hp for the Cybertruck Dual Motor, and conflicting 62/75/82 kWh figures for Model 3/Y. None of these were used.
   - Rivian does not publish kWh. KBB lists 92.5 / 108.5 / 140 kWh for 2026 R1 packs and 87.9 kWh for R2. These were not used.
6. **Cyberbeast EPA range:** 320 mi on the Tesla configurator and Cars.com, 325 mi on KBB.
7. **R1T Premium range:** the builder shows 300 mi on 20-in wheels; the Compare panel shows 329–420 mi (22-in wheels and Long Range). Both are recorded in notes.
8. **R1S Quad 0-60:** Rivian's Compare panel headline says 2.6 s, but its footnote says 2.5 s with 22-in Super Sport wheels.
9. **R2 Standard (not orderable, not in CSV):**
   - Price: Rivian 44,990; KBB 46,495 including destination, implying 45,000; EVWire 44,990. KBB's 2027 page labels 49,985 as "Standard" when it is the Standard Long Range price.
   - Timing: Rivian says spring 2027; KBB said early or late 2027 depending on the version.
   - September research recorded Rivian 44,990 / 275 mi vs KBB 49,985 / 345 mi. KBB's figures belong to the Long Range variant.
10. **2026 R1 history:** InsideEVs gave the old R1T Dual Standard as 72,990; Edmunds and RivianTrackr say 70,990. The trim is discontinued and irrelevant to the 2027 rows.

## Gaps and judgment calls (also in each row's confidence_notes)

- **Model Y L naming:** recorded as model "Model Y L", trim "Premium". Tesla shows it as a separate tile on the Model Y configurator. Change the model to "Model Y" if the matchmaker should keep it under Model Y.
- **Features not confirmed are left out rather than guessed:**
  - Tesla's site doesn't state glass roof, wireless charging or seat material for several trims.
  - Tesla's configurator doesn't show heated or ventilated seats on Cybertruck Premium AWD or Cyberbeast.
  - Rivian's configurator doesn't list heated seats or adaptive cruise for the R1.
- **Model Y Premium features from Edmunds:** ventilated front seats, synthetic leather and wireless charging come from Edmunds' listing for the former Long Range trim, which Premium replaced. Tesla's Premium tab does not name them.
- **Blank roof cells:**
  - Model 3 Standard, Model 3 Performance, Model Y Standard, Model Y Performance and Model Y L: roof type not stated by Tesla.
  - Cybertruck: no roof option on the configurator.
  - R2: no roof option on the configurator.
- **Rivian Power Upgrade** ($5,000, R1 Premium only; 533 → 665 hp) is in common features as a software upgrade, not a separate drivetrain variant. The 665 hp figure is in confidence_notes.
- **R1S captain's chairs** are priced two ways:
  - Premium with Black Mountain interior: only in the $4,000 "Captain's Chairs With Sound + Vision Package".
  - Premium with Ocean Coast interior: $1,500 alone.
  - Performance and Quad: $1,500, or free with the Ocean Coast Signature or Slate Sky Signature interiors.
- **Template deviation:** the Toyota template wrote prices as "+$475". This file uses plain numbers as instructed, matching the later configurator passes (for example the BMW/MINI repass).

## Sources

- **Tesla:**
  - https://www.tesla.com/model3/design ; https://www.tesla.com/modely/design ; https://www.tesla.com/cybertruck/design
  - https://www.tesla.com/model3 ; https://www.tesla.com/modely ; https://www.tesla.com/cybertruck
  - https://www.tesla.com/current-offers
  - https://www.tesla.com/models/design and https://www.tesla.com/modelx/design (both redirect to /inventory/new/my)
- **Rivian:**
  - https://rivian.com/configurations/builder/r1t ; https://rivian.com/configurations/builder/r1s ; https://rivian.com/configurations/builder/r2
  - https://rivian.com/configurations/builder/r3 (redirects to R1S)
  - https://rivian.com/stories/2027-r1s-r1t-updates
- **Edmunds:**
  - https://www.edmunds.com/tesla/model-3/2026/ ; https://www.edmunds.com/tesla/model-3/2027/
  - https://www.edmunds.com/car-news/2026-tesla-model-y-pricing-guide.html ; https://www.edmunds.com/tesla/model-y/2026/ ; https://www.edmunds.com/tesla/model-y/2027/
  - https://www.edmunds.com/tesla/cybertruck/2026/
  - https://www.edmunds.com/rivian/r1t/2027/ ; https://www.edmunds.com/rivian/r1s/2027/ ; https://www.edmunds.com/rivian/r2/2027/
- **KBB:**
  - https://www.kbb.com/tesla/model-3/2027/ ; https://www.kbb.com/tesla/model-y/2027/
  - https://www.kbb.com/tesla/cybertruck/2026/ ; https://www.kbb.com/tesla/cybertruck/2027/
  - https://www.kbb.com/rivian/r1s/2026/ ; https://www.kbb.com/rivian/r2/2027/
  - https://www.kbb.com/car-news/rivian-announces-r2-trims-pricing
- **Context:**
  - https://electrive.com/2026/08/26/tesla-raises-cybertruck-prices-again-in-the-us
  - https://cars.com/articles/how-much-is-the-2026-tesla-cybertruck-526071/
  - https://insideevs.com/news/791757/tesla-model-s-model-x-dead-official/
  - https://www.notateslaapp.com/news/3900/tesla-model-x-inventory-sold-out-in-us-model-s-nearly-gone
  - https://www.notateslaapp.com/news/3509/tesla-announces-fsd-purchase-option-will-go-away-next-month-heres-why
  - https://insideevs.com/news/784386/tesla-fsd-subscription-only-2026/
  - https://evwire.com/p/rivian-r2-public-deliveries-orders

## Next step (per ways-of-working)

Run `matchmaker_scoring_pipeline.py`, then import as a new batch with `promote = false`, then verify, then promote deliberately. Nothing has been imported or promoted. Note that this file drops Model S/X entirely and changes every Rivian R1 trim name to Premium / Performance / Quad. Any existing 2026 Dual/Tri rows in the live dataset will need deciding on at import.
