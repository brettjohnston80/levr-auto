# Configurator promotion group 1 review: Lexus, Acura, BMW, MINI, Mercedes-Benz, Volkswagen (2026-10-16)

The first promotion group of the approved import plan. **Nothing is promoted**; promoting needs Brett's go for the group, after the MarketCheck name fixes are deployed (section 4).

## 1. Batches (unpromoted, verified from database rows)

Every batch was imported with the mapping step, both engine-facts files, `data/held-models.json`, `blankPriceUnknown` and one make per batch. Trim and option counts equal the import responses. 0 package references were dropped and 0 values forced unavailable.

| Make | Batch | Source file | Trims | Options | "Price not confirmed" (standalone / package) | "Not confirmed" availability |
|---|---|---|---|---|---|---|
| Lexus | `19d6e061-7033-4984-b958-16bca2cb30f7` | lexus-acura prices | 95 | 2,026 | 0 / 0 | 0 |
| Acura | `2f1b0ff6-9f59-4cf7-844c-f441007504e6` | lexus-acura prices | 18 | 400 | 0 / 0 | 0 |
| BMW | `3bdeef01-bdda-4b56-bbeb-09b3d74eceb1` | bmw-mini prices (pass 3 identical) | 42 | 1,654 | 0 / 0 | 0 |
| MINI | `f2cf9efa-1d36-47af-96e3-ae4a908782ec` | bmw-mini prices (pass 3 identical) | 30 | 1,026 | 0 / 0 | 0 |
| Mercedes-Benz | `49f1546d-11d6-4223-9939-89d694f7573a` | mercedes pass 3 (EQE 320 split) | 62 | 3,307 | 0 / 0 | 35 |
| Volkswagen | `e349d265-d399-4171-b25f-c8afd4f6a398` | vw-audi pass 3 | 31 | 618 | 0 / 0 | 0 |

Old batches deleted, confirmed by count (0 batches, 0 trims left):
- the three pre-mapping ones (VW `e1bb3735`, Audi `c216fba5`, Mercedes `e19e2933`);
- the four first imports that pass 3 replaced (VW `b05270e5`, Audi `d5100fb8`, Mercedes `75abea80`, Dodge `30cf18a9`).

## 2. Held rows, corrections, items left unchanged

- **Held:** none in this group.
- **Corrections (4, all applied):** MINI Countryman SE ALL4 Signature Plus and SE ALL4 Iconic (2027), fuel type → EV, engine line → "Electric, 308 hp, AWD".
- **Left unchanged (13), all engine lines without published horsepower:**
  - **Lexus TZ (3 trims, 2027):** "Battery-electric, AWD". Lexus US doesn't state the TZ's horsepower yet.
  - **VW Atlas 2026 (10 lines, 5 trims × FWD/AWD):** "2.0L turbo I4 8-speed automatic …". These show without hp.
- Acura, BMW, MINI and Mercedes-Benz: nothing left unchanged.

## 3. Screenshots (`~/Downloads/levr-configurator-review-2026-10-16/group-1/`)

- **Per make, 3 trims:** the Highlights and All details tabs, plus one model's trim comparison with all sections open, and a phone Highlights.
  - These come from a temporary local-only preview page that renders the real trim-detail and comparison components from the batch data, with no inventory involved.
  - "0 available nationwide" in those shots is the preview, not the data.
- **`finalize-flow/`:** the real /finalize flow on my local server, with each make read as live locally only. It's shown for Lexus IS 2026, BMW X3 2026 and Mercedes-Benz E-Class 2027:
  - the trim step;
  - Compare trims;
  - trim Details;
  - rank #1;
  - colour, interior and features;
  - Review.
  - Synced for this: 9 MarketCheck calls. The disposable account was deleted (0 searches, customers or auth users left).
- **Colour tiles show initials, not colours.** Only the Camry and Civic have colour swatches; the 12 live makes look the same.

## 4. MarketCheck name check (23 facet calls, then 9 sync calls; about 301 of 500 left until Nov 1)

One model+trim facet call per make, for all 23 makes. The fixes are commit `2f03ad0` on `configurator-mapping`, local, **not pushed: app code, for Brett's review**.

**Model names:** `src/lib/marketcheck-models.ts`, used by the sync. Group 1 entries:
- Lexus: ES = "ES Hybrid" + "ES BEV"; NX, RX and TX also pull "… Hybrid" / "… PHEV"; UX = "UX Hybrid".
- BMW: M2 = "M2 Coupe", M3 = "M3 Sedan", M4 = "M4 Coupe". M5 and M5 Touring, and X7 and ALPINA XB7, are told apart by trim.
- Mercedes-Benz: C-Class = "C-Class Sedan"; AMG GT = "AMG GT Coupe" only.
- MINI: Cooper 2 Door = "Hardtop 2 Door" + "3 Door"; Cooper 4 Door = "Hardtop 4 Door" + "5 Door"; Cooper Convertible = "Convertible".
- Volkswagen: Jetta and Jetta GLI told apart by the "GLI" trim.

**Deliberately left out:** models that only the body type separates. They'd risk matching the wrong body:
- BMW 2/4/8 Series Gran Coupe and 4 Series Convertible;
- GLE Coupe;
- AMG GT 4-Door.

**Trim names:** `src/lib/configurator-matching.ts`, per-make rules tried only after the exact name fails.
- **Acura / VW:** "w/", "with", "Package" and "Tech" are ignored.
- **Mercedes-Benz:** "4MATIC" and spacing are ignored ("E450" = "E 450 4MATIC").
- **BMW:** xDrive/sDrive are ignored ("30" = "30 xDrive").
- **Lexus:** AWD/FWD are ignored, and the engine number when MarketCheck leaves it off; the powertrain picks the row.
- Every looser match still goes through the powertrain check, and two or more candidates are refused.
- **Live makes unchanged:** all 347 cases across the 5,234 synced listings of the 12 live makes match exactly as before.
- **Tests:** 83/83 pass, including 10 new name-check tests.

**Real synced listings, share matched to a configurator trim (before → after):**

| Model | Listings | Before | After |
|---|---|---|---|
| Lexus IS | 149 | 100% | 100% |
| BMW X3 | 148 | 0% | 100% |
| Mercedes-Benz E-Class | 144 | 0% | 58% |

E-Class detail:
- 50 of the 61 unmatched listings are 2026 cars, which the research doesn't cover.
- AMG E 53 2027 is refused, correctly: the sedan and wagon rows share the name.

**Trim names MarketCheck shares, by make (estimated from the facet names):**

| Make | Before | After |
|---|---|---|
| Acura | 9 / 18 | 18 / 18 |
| BMW | 22 / 42 | 35 / 42 |
| Lexus | 21 / 95 | 55 / 95 |
| Mercedes-Benz | 9 / 61 | 24 / 61 |
| Volkswagen | 26 / 31 | 28 / 31 |
| MINI | 0 / 30 | 0 / 30 |

MINI: MarketCheck lists only "S", "John Cooper Works", "Base" and similar, never Signature / Iconic. So a MINI listing can't name one research trim, and MINI customers get the general flow until a listing carries the level.

## 5. Decisions for Brett

1. **Deploy the name fixes.** It must deploy before group 1 is promoted. Either:
   - (a) merge the whole `configurator-mapping` branch to main and push. It brings the opt-in mapping step and import route, the tests and the name fixes; nothing changes for existing imports.
   - (b) cherry-pick only the name-fix commit.
   - Recommended: (a).
2. **Promote group 1** (Lexus, Acura, BMW, MINI, Mercedes-Benz, Volkswagen) after the deploy, one make at a time with `promote_configurator_batch_make`, confirming each from the live site.
3. **"Mini" and "MINI" in the vehicle data.** Intake lists both (2026 Cooper models under "Mini", the 2027 Countryman under "MINI"). The configurator reads either, but the dropdown shows the make twice. Unify to "MINI" in v21 (Brett's manufacturer-styling rule)?
4. **BMW X3 "30" listings** match "30 xDrive". The research has no sDrive 30 row. If BMW sells an sDrive X3 for 2026, its listings would get the xDrive row's options. Have the next Cowork pass confirm?
5. **VW Atlas 2026 and Lexus TZ** show engine lines without horsepower until it's published. OK to promote that way?
