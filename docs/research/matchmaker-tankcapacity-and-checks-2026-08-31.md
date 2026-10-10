# Tank capacity → range, plus 3 targeted checks (2026-08-31)

`matchmaker-vehicle-dataset-2026-v15.csv` — 1,601 rows, **44 columns** (new: `fuel_tank_capacity_gal`). Four items, dispatched to 10 agents in parallel (7 for tank capacity by make group, 1 each for the reliability/resale exploratory checks, 1 for the 3 ambiguous rows).

## 1. Tank capacity → range_mi

**New column `fuel_tank_capacity_gal`**, sourced from Edmunds/manufacturer spec sheets, filled for every gas/diesel row that was missing `range_mi`: **798/798 (100%)** — every single eligible configuration had a findable tank capacity, nothing genuinely unsourceable.

**range_mi recovered: 573 rows.** Gas/diesel coverage: 39.7%→**79.2%** (858/1,083). Overall (all fuel types): 39.7%→**75.5%** (1,208/1,601).

The other 225 rows got a tank capacity but **not** a range_mi — in every one of those 225, `epa_combined_mpg` itself is blank (mostly HD trucks/vans exempt from EPA testing, and a handful of not-yet-rated new trims), and backfilling mpg wasn't part of this task's scope, so I left range_mi blank rather than derive it from a different trim's mpg. By make: Ram 70 (all HD trucks/ProMaster, GVWR-exempt), Mercedes-Benz 29, Land Rover 27, Ford 25, GMC 21, Genesis 16, Lexus 8, Chevrolet 7 (Silverado HD), Buick 4, Mazda 4, Jeep 4, BMW 4, Porsche 4, Lincoln 2 — mostly AMG/M/high-output trims not yet EPA-rated, plus every heavy-duty truck line. If you want these closed too, it'd need a separate epa_combined_mpg pass, not just tank capacity.

**Methodology confirmed for future (2027) passes** — see the "Assumptions & methodology for 2027" section at the bottom for the full write-up. Short version: tank capacity is almost always identical across trims/drivetrains sharing a model + generation (one lookup covers the whole model line), with real exceptions specific to a handful of platform types — worth checking every time, not assuming.

## 2. Reliability — shared-platform correlation check (exploratory, NOT applied)

Checked 8 confirmed shared-platform pairs via live RepairPal lookups. **7 of 8 matched exactly** (0.0 delta): Chevrolet Silverado/GMC Sierra, Chevy Colorado/GMC Canyon, Tahoe/Yukon, Equinox/Terrain, Hyundai Tucson/Kia Sportage, Santa Fe/Sorento, Dodge Durango/Jeep Grand Cherokee. The one miss: **Cadillac Escalade vs. Tahoe/Yukon — same GM T1 platform and drivetrain, but a full 1.0-point gap** (2.5 vs. 3.5), attributed to luxury trim complexity (electronics, air suspension) breaking the correlation even on an identical mechanical base.

**Verdict: real and strong enough to use as a fallback, but restricted** — safe for same-tier mainstream siblings (Chevrolet↔GMC, Hyundai↔Kia, Dodge↔mainstream Jeep), **not** safe to extend to luxury-tier siblings (Cadillac, Genesis, Lincoln), where the platform match doesn't carry the reliability score with it. Not applied to any data this pass — this was a check, not a fill, per your instructions. If you want it applied to the mainstream-tier pairs, say so and I'll scope a proper fill pass (with fresh model-level RepairPal lookups, not values already in the CSV — see the flag below).

**Data-quality issue found as a side effect, not part of this task's scope but worth flagging now:** all 53 GMC rows currently show `reliability_rating = "3.0"` with no source note — that's RepairPal's brand-level GMC score, silently applied dataset-wide at some earlier point without the "(RepairPal, brand-level only...)" annotation used everywhere else. Live model-level lookups this pass show the real numbers are actually higher and vary by model: Yukon 3.5, Sierra 1500 3.5, Canyon 4.0, Terrain 3.5. This wasn't touched (out of this task's scope) but it means GMC's reliability_rating column is currently understating real values and is inconsistent with the labeling convention used everywhere else. Worth a dedicated correction pass.

## 3. Resale value — brand-level fallback (checked, NOT applied — needs a labeling decision)

**Premise correction:** no make is actually 100% blank on resale_depreciation_pct — the worst are Ram (12.5%), Lexus (13.4%), Chevrolet (18.3%), Ford (23.9%). Checked those four.

**iSeeCars: no usable brand-level rollup exists.** Their "Best Resale Value" page only surfaces each brand's top 3 models, not a brand-wide average — there's no single number to pull.

**CarEdge does publish one**, structurally identical to RepairPal's brand rollup:

| Make | 5-yr residual (CarEdge) | Implied depreciation |
|---|---|---|
| Ram | 59.5% | 40.5% |
| Lexus | 61.6% | 38.4% |
| Chevrolet | 51.6% | 48.4% |
| Ford | 50.1% | 49.9% |

**Why nothing was applied**: unlike `reliability_rating`, `resale_depreciation_pct` is a pure numeric column with no adjacent text field — every one of the 1,270 filled cells is a bare number like `28.4`. Dropping `40.5` into every blank Ram cell would be silently indistinguishable from real model-specific data, with no way for anyone downstream to tell a brand-wide estimate from an actual per-model figure. That's exactly the failure mode you asked me to check for before filling anything.

**This needs a decision from you** — I've asked via the question below rather than guess on a schema change.

## 4. Three ambiguous trim-specific values — resolved, all 3 found

| Item | Trim(s) | Value found | Source |
|---|---|---|---|
| Land Rover Defender 130 (all 5 trims) | cargo_volume_seats_up_cuft | **15.3 cu ft** | Land Rover USA official spec page, corroborated by KBB. This is the behind-3rd-row (8-seat) figure — genuinely a third number, not inherited from 90 (15.6, a behind-2nd-row figure) or 110 (34.0, also behind-2nd-row). |
| Mazda CX-70 PHEV (both trims) | rear_headroom_in | **38.4 in** | Mazda's official 2026 CX-70 spec deck — PHEV shares the "High PT" gas figure (38.4), not the base gas figure (39.3). |
| Mazda3 Hatchback (4 trims: S Preferred, S Carbon Edition, S Premium, Turbo Premium Plus) | rear_headroom_in | **36.5 in** | Edmunds trim-specific pages, cross-validated per trim against cargo volume and MSRP to confirm hatchback (not sedan). Genuinely distinct from both the hatchback base trims (37.2) and the sedan equivalent trims (36.7) — a real third value, not inherited from either sibling. |

Coverage after this pass: cargo_volume_seats_up_cuft and rear_headroom_in gaps for these three model lines are now fully closed (5/5 Defender 130 rows, 2/2 CX-70 PHEV rows, 4/4 Mazda3 hatchback rows).

## Coverage summary (1,601 rows)

| Field | Before this pass | After |
|---|---|---|
| range_mi (overall) | 39.7% | **75.5%** |
| range_mi (gas/diesel only) | 58.6% | **79.2%** |
| fuel_tank_capacity_gal (new column) | — | 49.8% overall, **100% of eligible rows** |
| resale_depreciation_pct | unchanged | unchanged (pending labeling decision) |
| reliability_rating | unchanged | unchanged (check only, not applied) |

---

## Assumptions & methodology for 2027 — carry this logic forward

**Tank capacity → range formula**: `range_mi = round(fuel_tank_capacity_gal × epa_combined_mpg)`. Only applies to Gas/Diesel `fuel_type` rows — never EV/PHEV/Hydrogen, whose range is a directly-published EPA figure or nothing. Only computed where `epa_combined_mpg` is already populated; a row with tank capacity but no mpg gets the tank number and nothing else.

**Tank capacity lookup pattern**: overwhelmingly constant across trims, engines, and drivetrains within one model/generation — look up once per model, not per row. Confirmed exceptions found this pass, worth checking for on every new model rather than assuming uniformity:
- **Engine-driven, not cab/drivetrain-driven**: Ram HD pickups (2500/3500) — gas 32.0 gal vs. diesel 31.0 gal, identical across every cab config and RWD/4WD.
- **Wheelbase-driven**: Jeep Grand Wagoneer (26.5 gal) vs. longer-wheelbase Grand Wagoneer L (30.5 gal); Cadillac Escalade (24.0 gal) vs. extended Escalade ESV (28.0 gal).
- **Drivetrain-driven** (rare, but real): BMW 2 Series Gran Coupe — FWD 228 = 12.9 gal vs. xDrive/M235 = 13.2 gal.
- **Body-style-driven within the same nameplate**: Mercedes-AMG GT Sedan (21.1 gal) vs. Coupe (18.5 gal) — different platforms sharing a model label; Mercedes Maybach S-Class (20.1) vs. regular S-Class (20.0) — close but distinct, confirmed rather than assumed identical.
- **Standardized-across-platform, letting engine efficiency (not tank size) drive range differences**: Land Rover's entire current lineup (Defender 90/110/130, Range Rover, Range Rover Sport) shares one 23.8-gal tank regardless of engine, from base four-cylinder through twin-turbo V8.
- **Configuration granularity limits** (not a research gap, a dataset-schema limit): Ford F-150/Super Duty and GMC Sierra 1500 publish a base tank size that's overridden by a larger optional tank on specific wheelbase/cab combos the dataset doesn't have columns to distinguish (e.g. F-150 short-wheelbase Reg Cab base engines = 23 gal vs. the 36-gal figure used for every other F-150 config) — the more common/default config's figure was used as the representative value; flag if a future schema adds cab/wheelbase granularity, since these could be split more precisely then.

**Shared-platform reliability inheritance** (not yet applied, but validated as a real pattern): safe for same-tier mainstream corporate siblings on a confirmed shared platform (GM's Chevrolet↔GMC, Hyundai↔Kia, Stellantis Dodge↔mainstream Jeep) — these matched exactly in every example checked. Do NOT extend to luxury-tier siblings off a mainstream platform (Cadillac, Genesis, Lincoln) — trim complexity broke the correlation by a full point even on an identical mechanical base in the one case tested (Escalade vs. Tahoe/Yukon). Any future fill using this logic should pull a fresh model-level RepairPal number for the sibling, not reuse whatever's already in the CSV, given the GMC brand-level contamination found this pass.

**Resale brand-level rollups**: iSeeCars does not publish one (only top-3-models-per-brand); CarEdge does (`caredge.com/ranks/depreciation`, both a "Popular" and "Luxury" ranking, 5-year residual basis — depreciation % = 100 − residual %). Same brand-vs-model distinction problem as reliability, but resale_depreciation_pct has no text field to embed a source note in, unlike reliability_rating — this is the open schema question below.
