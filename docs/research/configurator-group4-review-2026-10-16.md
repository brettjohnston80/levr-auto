# Configurator promotion group 4 review: GMC, Buick, Cadillac, Lincoln (2026-10-16)

From the pass 4 files. **Nothing is promoted; promotion waits for Brett's go.** One display problem has to be settled before GMC goes live (section 4).

## 1. Batches (unpromoted, verified from database rows)

Imported with the mapping step, all four engine-facts files, `data/held-models.json`, `blankPriceUnknown` and one make per batch. Trim and option counts equal the import responses. 0 package references were dropped and 0 values forced unavailable. The pass 3 GM batches were deleted (never promoted, 0 references; 0 left).

| Make | Batch | Trims | Options | "Price not confirmed" (standalone / package) | "Not confirmed" availability |
|---|---|---|---|---|---|
| GMC | `ddd85620-e9b5-4d26-b32b-1b274f35f11b` | 66 | 4,481 | 290 / 0 | 7 |
| Buick | `d735cfc9-6964-4093-977c-3d89bd4d4aaf` | 15 | 685 | 7 / 0 | 0 |
| Cadillac | `3ee5d104-34f5-4268-9e75-6320678eab32` | 67 | 3,610 | 75 / 1 | 0 |
| Lincoln | `f08e42e9-8309-4b54-9644-584870c7761b` | 27 | 1,552 | 29 / 10 | 0 |

- **GMC's 290 "Price not confirmed"** are mostly:
  - the 168 items GM's configurator can't price alone (left as they were in pass 3);
  - the 67 items reverted from $0.
- **Lincoln's 10** are its unpriced packages.

## 2. Held rows, corrections, items left unchanged

- **Held:** Cadillac Vistiq 2026 (4 rows).
- **Corrections (10, all applied):**
  - Escalade / Escalade ESV "V-Series" → "V" (4);
  - the six 2026 XT5 Premium Luxury items unlinked from the Driver Assist Package.
- **Left unchanged:**
  - **GMC 243:**
    - 193 cab/bed build lines; the mapping step leaves these, and the page now formats them (section 3);
    - 50 engine lines with no published horsepower (gmc.com refused automated reads).
  - **Buick 22:** no published horsepower.
  - **Cadillac 4:** no published horsepower.
  - **Lincoln 9:** 6 lines that aren't engines, and 3 without horsepower.

## 3. Screenshots (`~/Downloads/levr-configurator-review-2026-10-16/group-4/`)

- **Per make, 3 trims:** Highlights and All details, plus one model's trim comparison and a phone Highlights, from the local preview ("0 available nationwide" there is the preview).
- **`sierra-cab-bed/`:** the cab/bed lines, desktop and phone, for:
  - Sierra 1500 SLT 2026;
  - Sierra 2500HD Denali 2026;
  - Sierra EV Denali 2026;
  - Canyon Elevation 2026;
  - the Sierra 1500 comparison.
- **How the cab/bed lines read now** (option C, live), e.g. Sierra 2500HD Denali, "Cab, bed & powertrain (4)":
  - Crew Cab, Standard Bed · 4WD · 6.6L V8 Gas engine, 10-speed automatic: Standard
  - Crew Cab, Long Bed · 4WD · 6.6L V8 Gas engine, 10-speed automatic: +$200
  - Crew Cab, Standard Bed · 4WD · 6.6L Duramax diesel V8, 10-speed automatic: +$9,990
  - Crew Cab, Long Bed · 4WD · 6.6L Duramax diesel V8, 10-speed automatic: +$10,190

## 4. ⚠ To fix before GMC is promoted: the engine-choice "packages" show in Features

The 14 package entries Cowork added in pass 3 (kept by Brett's decision so the items that come with an engine keep their link) are named like the whole build. They show in **Features** as a package, e.g. on the Sierra 2500HD Denali: "Crew Cab, Standard Bed, 4WD, 6.6L Duramax Turbo-Diesel V8 engine, 10-speed automatic transmission, +$9,990 package".

Their contents carry a research note shoppers would read: "(engine/transmission choice from drivetrain_engine_variants; listed here so items that come with it keep their link)".

**Options:**
- (a) **Recommended:** a logged, tested mapping rule that removes that note from the 14 entries' contents, plus a display rule that keeps a "package" whose name is a cab/bed build out of the Features list. The items it brings still say what they come with.
- (b) Have a Cowork pass rename and clean them.

## 5. Other items

- **Not cleaned in pass 4 (not in the brief):**
  - 198 GMC/Buick package contents reading "standard equipment on this trim (GM standard-features list names the package but does not itemize it separately)";
  - 52 Lincoln contents starting "standard equipment group on this trim; …".

  Clean them in a later pass, or with a mapping rule that turns them into "Contents not listed"?
- **"Dealer-installed" flags** (GMC/Buick 363, Cadillac 355): removed from package contents in pass 4. Brett hasn't decided whether that information should be kept elsewhere.
- **No GM inventory is synced.** These makes' configurator appears on www once listings arrive.

## 6. Decisions for Brett

1. The engine-choice "packages" (section 4): (a) or (b).
2. The "standard equipment" package notes (section 5).
3. Then promote group 4 (GMC, Buick, Cadillac, Lincoln), one make at a time with a check on www.
