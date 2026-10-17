# Truck cab and bed: options for how they show (proposal, 2026-10-16; nothing built)

Brett's pass 3 decision 4: shoppers must not see GMC cab/bed configurations as engine choices, and GMC isn't promoted until this is fixed.

## What's there today

- **GMC (not live):** 186 lines on 27 rows (Sierra 1500 / 2500HD / 3500HD) sit in the drivetrain list. Each one is a whole build, priced as one combination. The 2026 Sierra 1500 SLT has 12, for example:
  - `Crew Cab, Short Bed, 2WD, 5.3L EcoTec3 V8 engine, 10-speed automatic transmission`: Standard;
  - `Crew Cab, Standard Bed, 4WD, 3.0L Duramax Turbo Diesel engine, 10-speed automatic transmission with Electronic Precision shift and front bucket seats`: +$6,350.
- **The page shows them** under the "Drivetrain" heading:
  - in All details, one line each;
  - in Highlights, as the Drivetrain spec line.
- **Ram (live today) has the same pattern:** 72 Ram 1500 and 6 Ram 2500 lines like `Quad Cab / 4x2 (RWD) / 6'4" Box`.
- **Ford** puts cab/bed under Seating ("Regular Cab 6.5 or 8 ft bed"). Chevrolet's research has no cab/bed lines.
- **Prices:**
  - In 26 of the 27 GMC rows, the combination prices add up exactly from separate parts. On the SLT: Standard Bed +$700; 4WD +$3,100; 3.0L diesel +$795 over the 5.3L; bucket-seat package +$1,755.
  - The 2026 Sierra 1500 Pro doesn't add up (off by up to $371).
  - **Not every combination exists.** The SLT offers 12 of the 20 possible.

## Option A: separate choices (Cab & bed, Drive, Engine)

The mapping step splits each line into its parts and works out each part's price. It checks that every offered combination adds up, and leaves a row as it is (and reports it) when it doesn't.

How it looks (All details, Sierra 1500 SLT 2026):
```
CAB & BED (2)
  Crew Cab, Short Bed ............ Standard
  Crew Cab, Standard Bed ......... +$700
DRIVE (2)
  2WD ............................ Standard
  4WD ............................ +$3,100
ENGINE (5)
  5.3L V8, 10-speed automatic .... Standard
  5.3L V8, 10-speed automatic, Electronic Precision Shift, bucket seats ... +$1,755
  3.0L Duramax diesel, 10-speed automatic ... +$795   (4WD only)
  ...
  Not every combination is offered.
```
Highlights would show: `Cab & bed: Crew Cab, Short Bed (Standard Bed +$700)`.

**Pros:**
- Reads like a manufacturer's configurator.
- Shortest lists.
- The same approach would also fix Ram, and give Ford's cab/bed a proper home.

**Cons:**
- **Needs a migration**: a new option category, plus the questions, Highlights and comparison rows.
- The page has to explain that not every mix exists (8 of the SLT's 20 don't).
- The 1 row that doesn't add up stays as it is.
- Largest build.

## Option B: cab and bed fold into the trim rows

Each GMC trim becomes one row per cab/bed: "SLT · Crew Cab, Short Bed" and "SLT · Crew Cab, Standard Bed". Each row's drivetrain list then holds only drive + engine.

How it looks (trim step):
```
SLT · Crew Cab, Short Bed      $..  ·  N available
SLT · Crew Cab, Standard Bed   $..  ·  N available
```

**Pros:**
- No migration.
- Every row is a real build.

**Cons:**
- About twice as many trims on the trim step.
- MarketCheck listings give the cab ("Crew") but **not** the bed length. So a listing "SLT" can't pick between the two rows, and the matcher refuses, which leaves most GMC shoppers in the general flow.
- Doesn't help Ram unless done there too.

## Option C: one combined choice, honestly labelled and tidied (recommended for now)

Keep each line as one real combination, but:
1. **Reformat each line** in the mapping step so its parts read in a fixed order: `Crew Cab, Short Bed · 4WD · 5.3L V8, 10-speed automatic`. The extras ("Electronic Precision shift and front bucket seats") stay at the end.
2. **Change the section's heading from "Drivetrain" to "Cab, bed & powertrain"**, and the Highlights label likewise, for any trim whose lines carry a cab or bed. Ram gets the same treatment.

How it looks (All details):
```
CAB, BED & POWERTRAIN (12)
  Crew Cab, Short Bed · 2WD · 5.3L V8, 10-speed automatic ................ Standard
  Crew Cab, Short Bed · 4WD · 5.3L V8, 10-speed automatic ................ +$3,100
  Crew Cab, Standard Bed · 4WD · 3.0L Duramax diesel, 10-speed automatic,
    Electronic Precision shift and front bucket seats .................... +$6,350
  ...
```
Highlights: `Cab, bed & powertrain: 12 builds, from Standard to +$8,460`.

**Pros:**
- Every line is a build GMC actually sells, with its real price.
- Nothing is presented as an engine choice.
- No migration.
- Small change: a mapping rule and one label rule, both tested.
- Fixes Ram (live) at the same time.

**Cons:**
- Lists stay long (up to 12 lines on a Sierra trim).
- A shopper picking just "Standard Bed" compares lines rather than ticking a box.

## Recommendation

**C now.** It meets the requirement with no migration and no risk of implying builds that don't exist, and it fixes Ram too. **A later**, as its own reviewed change, if the long lists turn out to be a problem. A would also give Ford's cab/bed (today under Seating) a proper home.

**Customer-facing wording to approve for C:**
- the heading "Cab, bed & powertrain";
- the Highlights line "{N} builds, from {lowest} to {highest}".
