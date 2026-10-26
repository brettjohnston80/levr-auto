# Configurator research review: Wave 1 remainder and Wave 2 (2026-10-14)

Read-only review before any import. Nothing was imported, no CSV was edited, no MarketCheck call was made, and the agent-dashboard branch was not touched. Counts come from running the real import parser (`src/lib/configurator-parse.ts`, with `blankPriceUnknown` on, as for every Wave 1 make) over each file. Import status was read from `configurator_batches` and `configurator_live_makes`.

**Decisions needed are in section 2 (the rules) and section 5 (summary of choices).** No research or edits until Brett picks.

---

## 1. Inventory

Every file has exactly the same 18 columns, in the same order, as the Toyota CSV. Every availability value is one of the four exact words, and every price parses, so there are no cell-format errors. The mismatches are in the **descriptive fields** (body style, drivetrain, fuel type), in **model and trim naming**, and in how the **engine option text** is written (section 2).

| Make | File | Rows (= trims) | Models | Options | Unpriced extra-cost options | Status |
|---|---|---|---|---|---|---|
| Volkswagen | `vw-audi-configurator-full-2026-10.csv` | 31 | 9 | 618 | 1 (wheels) | Imported, not promoted: batch `e1bb3735-5809-40ce-918b-a050a46844bc` |
| Audi | same file | 59 | 32 | 1,500 | 20 (paint) | Imported, not promoted: batch `c216fba5-e93f-4ba5-ae5f-756fa090755a` |
| GMC | `gmc-buick-configurator-full-2026-10.csv` | 66 | 11 | 4,483 | 334 (301 features, 29 wheels, 4 seating) | Not imported |
| Buick | same file | 15 | 4 | 685 | 7 | Not imported |
| Tesla | **no file** | - | - | - | - | **Missing** |
| Rivian | **no file** | - | - | - | - | **Missing** |
| Lexus | `lexus-acura-configurator-full-2026-10.csv` | 95 | 10 | 2,026 | 0 | Not imported |
| Acura | same file | 18 | 4 | 400 | 0 | Not imported |
| BMW | `bmw-mini-configurator-full-2026-10.csv` | 42 | 25 | 1,654 | 0 | Not imported |
| MINI | same file | 30 | 4 | 1,026 | 0 | Not imported |
| Mercedes-Benz | `mercedes-configurator-full-2026-10.csv` | 61 | 26 | 3,270 | 0 | Imported, not promoted: batch `e19e2933-9e90-41cd-99c4-26b7c878d84d` |
| Cadillac | `cadillac-lincoln-configurator-full-2026-10.csv` | 71 | 9 | 3,789 | 104 (100 features) | Not imported |
| Lincoln | same file | 24 | 5 | 1,436 | 37 (35 features); 10 packages with no price | Not imported |
| Genesis | `genesis-volvo-configurator-full-2026-10.csv` | 62 | 8 | 1,496 | 0 | Not imported |
| Volvo | same file | 27 | 9 | 732 | 0 (67 "Not confirmed") | Not imported |
| Dodge | `dodge-chrysler-alfa-configurator-full-2026-10.csv` | 28 | 3 | 867 | 0 | Not imported |
| Chrysler | same file | 8 | 2 | 189 | 0 | Not imported |
| Alfa Romeo | same file | 5 | 3 | 132 | 0 | Not imported |
| Mitsubishi | `mitsubishi-polestar-lucid-configurator-full-2026-10.csv` | 24 | 4 | 601 | 0 (123 "Not confirmed") | Not imported |
| Polestar | same file | 2 | 1 | 68 | 0 | Not imported |
| Lucid | same file | 7 | 2 | 235 | 0 (13 "Not confirmed") | Not imported |
| Porsche | `porsche-landrover-configurator-full-2026-10.csv` | 61 | 9 | 3,617 | 0 | Not imported |
| Land Rover | same file | 52 | 10 | 1,801 | 36 (all roof) | Not imported |

"Unpriced extra-cost options" are standalone or package-only items with no price; with `blankPriceUnknown` they show "Price not confirmed" (never $0). "Not confirmed" is blank availability (stored as `unknown`). No package reference fails to resolve in any file (0 dropped). Every make has a notes file in `docs/research/`.

**Flags:**
- **Tesla and Rivian: no CSV and no notes file.** Wave 1 is incomplete.
- **Ten of the eleven files (and their notes) are untracked in git**; only `gmc-buick` is committed. So is `data/raw/` (Cadillac and Lincoln raw configurator JSON). Nothing is lost yet, but nothing is backed up either.
- **Small or partial makes, explained in the notes:**
  - **Polestar:** only the Polestar 4 (2 rows). The Polestar 3 configurator builds only MY2025.
  - **Alfa Romeo:** 5 rows, MY2026 only (no 2027 Alfa on the selector).
  - **Chrysler:** 8 rows (Pacifica, Voyager).
- **Models our vehicle dataset has but the research doesn't.** The notes say all of these are retired or have no live configurator:
  - **BMW:** 8 Series, 8 Series Gran Coupe, i4, iX, X5 M, Z4, ALPINA XB7.
  - **Lexus:** LC, LS.
  - **Audi:** A6 allroad.
  - **Cadillac:** CT4.
  - **Volvo:** V90 Cross Country.

  Customers can still pick these at intake; they just get the generic flow.
- **Models in the research that our dataset doesn't have:**
  - Lexus TZ (new for 2027);
  - BMW XM;
  - Dodge Charger Daytona (the electric Charger);
  - Mercedes, Porsche and Land Rover models split by body or powertrain (rule 9).

---

## 2. Proposed standard cleanup rules (one set for every make)

Each rule says what changes, then shows real before → after examples. How a rule gets applied (Cowork re-pass, or a mapping step in the import) is decision D1 in section 5.

### Rule 1. Trim names follow the manufacturer's own styling, character for character
Keep official capitalization and branding (`F SPORT`, `4MATIC`, `xDrive`, `OCTA`, `S line`, `R/T`). Fix only names that don't match the manufacturer's site.
- Audi RS e-tron GT `performance` → `Performance`.
- Audi A3 `Black optic plus`, `S line plus`: **check** against audiusa.com (Audi styles "S line" and "Black optic" in lowercase, but "plus" as a trim suffix needs confirming).
- Polestar 4 `Dual motor`, `Rear motor`: **check** (Polestar's US site uses "Long range Dual motor" / "Long range Single motor").
- Already correct and to be kept: Lexus `350h F SPORT Handling`, Mercedes `GLE 450 4MATIC`, Land Rover `OCTA`, Dodge `R/T Plus`.

### Rule 2. A placeholder trim is called `Base`, and only when the manufacturer has no name for it
The entry version of a model with no trim name is stored as `Base`. MarketCheck commonly reports these as "Base" (to be confirmed per make by the name check in section 4). Where the manufacturer does name the entry trim, the name is used instead of `Base`.
- Kept as `Base`: Porsche Macan / Cayenne / Taycan / Panamera; BMW M2, M3, M4, M5; Acura Integra, ADX, RDX, MDX; Alfa Romeo Giulia, Stelvio; Genesis GV60, Electrified GV70.
- **To check:** Cadillac Escalade / Escalade ESV `Base` (Cadillac names every Escalade trim, so "Base" may stand for a real name); Audi A3, S3, RS 3, SQ7, SQ9 `Base` (some of these may be "Premium").

### Rule 3. A model or engine designation is kept as the trim only when it is the manufacturer's real trim
BMW (`330i`, `M340i`), Mercedes (`GLE 350 4MATIC`), Lexus (`350h Premium`) and Genesis (`2.5T Advanced`) name trims by designation; those stay. A designation is wrong only where it replaces a real grade name, or combines two trims in one row.
- BMW i5 `eDrive40 / xDrive40` → two rows, `eDrive40` and `xDrive40`, each with its own drivetrain.
- Audi A8 `55 TFSI quattro`, S8 `4.0 TFSI quattro`: **check** whether Audi USA sells a named grade (the A8 is usually a single "Premium Plus"-style trim).
- Mercedes trims repeat the model name (`GLE 450 4MATIC` under model `GLE`). Keep for now; the MarketCheck name check (section 4) decides whether to strip the prefix.

### Rule 4. Engine options use one short format
`{size and type}, {hp} hp, {transmission}, {drivetrain}`, with `mild hybrid` / `hybrid` / `plug-in hybrid` / `electric` where it applies, and no marketing words.
- BMW: `2.0-liter BMW TwinPower Turbo inline 4-cylinder 8-Speed Sport Automatic Transmission RWD` → `2.0L turbo I4, 255 hp, 8-speed automatic, RWD` (hp from BMW's spec page; check).
- Land Rover: `3.0 Liter 6-Cylinder - Ingenium 3,0 litre 6-cylinder 400PS (294kW) Turbocharged Gas MHEV (Automatic)` → `3.0L turbo I6 mild hybrid, 395 hp, 8-speed automatic, AWD`.
- Cadillac: `Rear-Wheel Drive, 2.0L Twin-scroll turbocharged 4-cylinder engine, 10-speed automatic transmission` → `2.0L turbo I4, 10-speed automatic, RWD`.
- Already close: Acura `1.5L VTEC Turbo, 200 hp, CVT, FWD`; Genesis `2.5T Inline 4 Turbo GDI, 300 hp, 8-Speed Automatic, RWD`.
- **Items that aren't an engine come out of this column:**
  - Dodge Charger `2-Door AWD` / `4-Door AWD` are body choices (see rule 6).
  - Porsche `8-speed Porsche Doppelkupplung (PDK)` and Chrysler/Alfa Romeo `FWD` / `RWD` are a transmission or a drivetrain on its own line; fold them into the engine line.

### Rule 5. Unpriced options: keep the current rule
A blank price on an extra-cost or package-only item means "not published" and shows "Price not confirmed" / "Package price not confirmed", never $0. This is the Chevrolet/Ford/Hyundai rule Brett already accepted.
- The biggest affected makes:
  - GMC: 334 (301 of them features);
  - Cadillac: 104;
  - Lincoln: 37, plus 10 packages with no price;
  - Land Rover: 36 (all roof options);
  - Audi: 20 paints.
- No research is proposed to fill these unless Brett wants it for a specific make.

### Rule 6. One body style per row, from a fixed list
**The list (our vehicle dataset's own classes):** Sedan, Hatchback, Wagon, Coupe, Convertible, SUV, Truck, Minivan, Cargo Van. These are written in Title Case for new imports only. Live Toyota/Honda rows keep their lowercase values, because the wheel-photo lookup matches body style exactly.
- **Where body style is used:** the trim's identity, the "differs only in drivetrain" check, and the wheel photos. Nothing filters on it, and Matchmaker uses the vehicle dataset, not the configurator. So this rule is about consistency, not customer filtering.
- **Mappings:**
  - `SUV Coupe` (Mercedes GLC/GLE Coupe) → `SUV`, the same as our dataset's BMW X6 and Audi Q5 Sportback. (Our dataset itself lists a Porsche Cayenne Coupe row as `Coupe`, an inconsistency to fix there separately.)
  - `Targa` (Porsche 911 Targa 4S / 4 GTS) → `Convertible`; our dataset has the 911 only as Coupe and Convertible.
  - Lowercase forms map to the list: `coupe` → `Coupe`, `minivan` → `Minivan`, `pickup truck` → `Truck`.
- **`coupe or sedan` (Dodge Charger, 11 rows) → split** into a Coupe row and a Sedan row, as was done for the Corolla sedan/hatchback. The notes say the 2-door and 4-door share prices; the split then also removes the body items from the engine column (rule 4).

### Rule 7. One drivetrain per row, written as FWD, RWD, AWD or 4WD
Brand names (`SH-AWD`, `4MOTION`, `quattro`, `xDrive`, `4MATIC`, `ALL4`) stay in the trim or engine text; the drivetrain field says `AWD`. A trim sold with a choice of drivetrain keeps one row: drivetrain = the standard one, and the other appears as a priced item in the engine/drivetrain options. That's how the research mostly lists it already, with the price difference.
- GMC Terrain `FWD/AWD` → `FWD`, with AWD as an option item.
- GMC Sierra 1500 `2WD/4WD` → `RWD`, with 4WD as an option item.
- Genesis G70 `RWD; AWD available` → `RWD`, with AWD as an option item.
- BMW 3 Series `RWD/AWD` → `RWD`.
- Acura `SH-AWD` → `AWD`.
- Dodge `RWD or AWD` → `RWD`.
- Mercedes AMG GT 43 `null` → **check** (the AMG GT 43 is RWD in Mercedes' US spec, but must be confirmed).
- Occurrences: Cadillac 39 combined rows, BMW 17, Lincoln 12, Genesis 11, Buick 9, Mitsubishi 8, Volvo 7, Mercedes 6, Chrysler 6, GMC 24.

### Rule 8. Fuel type uses a fixed list: Gas, Hybrid, PHEV, EV, Hydrogen
- `Electric` → `EV`.
- `Plug-in Hybrid` → `PHEV`.
- `Gas (diesel available)` (GMC, 40 rows) → `Gas`, with the diesel engine as an option item.
- `Gas; Hybrid available` (Lincoln, 3 rows) → split into a Gas row and a Hybrid row, the same split rule as body style.

The matcher already reads all of these correctly (it matches by prefix), so this is consistency, not a matching fix.

### Rule 9. Model names equal our vehicle dataset's model names
Intake, listings, agents and the trim lookup all key on our dataset's make and model. A research model name that isn't in the dataset never meets a customer.
- **Spelling only:**
  - Audi `RS 3`, `RS 6 Avant`, `RS 7` → `RS3`, `RS6 Avant`, `RS7`;
  - GMC `HUMMER EV Pickup` / `HUMMER EV SUV` → `Hummer EV Pickup` / `Hummer EV SUV`.

  If MarketCheck spells them like the research, that difference goes in `marketcheck-models.ts`, as for Ram.
- **Research splits one of our models into several.** These merge back into the dataset model, with the body or powertrain carried on the row (option A); or the new names are added to the vehicle dataset, which is a Matchmaker change (option B).
  - Mercedes:
    - `GLE Coupe` → `GLE` (SUV);
    - `GLC Electric` → `GLC` (EV);
    - `CLE Coupe` / `CLE Cabriolet` → `CLE` (Coupe / Convertible);
    - `EQS Sedan` → `EQS`;
    - `E-Class Wagon` → `E-Class` (Wagon);
    - `AMG GT Coupe` / `AMG GT 4-Door Coupe Electric` → `AMG GT`;
    - `CLA Electric` → `CLA`.
  - Porsche:
    - `Cayenne Coupe` → `Cayenne`;
    - `Cayenne Electric` / `Cayenne Coupe Electric` → `Cayenne` (EV);
    - `Macan Electric` → `Macan` (EV).
  - Land Rover: `Defender 90/110/130` → `Defender`, with the wheelbase kept in the trim (`110 X-Dynamic SE`); `Range Rover Electric` → `Range Rover` (EV).
- **New models we don't carry:** Lexus `TZ`, BMW `XM`, Dodge `Charger Daytona`. Add them to the vehicle dataset first, or hold their rows until they're added (decision D4).
- **Make spelling:** the dataset has both `Mini` and `MINI` (known issue); the research uses `MINI`. Fix the dataset duplicate before importing MINI.

### Rule 10. A plug-in hybrid's range in the Matchmaker dataset is its total range (added by Brett, 2026-10-15)
`range_mi` for a `PHEV` row is the EPA total range, gas plus electric (RAV4 PHEV 594, Tucson PHEV 388), never the electric-only range. The scoring pipeline compares range within each fuel type, so an electric-only figure would score that vehicle as the worst plug-in hybrid by mistake. Found in Wave 3: the BMW XM row had 30 (electric-only). If the total range isn't published, leave `range_mi` blank.

---

## 3. Per-make findings (rules applied on paper)

- **Volkswagen** (imported, unpromoted): clean.
  - Rule 7: the drivetrain field is already single-value.
  - Rule 4: engine text is close (`2.0L turbo I4 8-speed automatic 4MOTION AWD` → add commas and hp).
  - Needs a re-import only if rule 4 is applied.
- **Audi** (imported, unpromoted):
  - Rule 1: `performance` → `Performance`; `Black optic plus` and `S line plus` to check.
  - Rule 2: five `Base` trims to check.
  - Rule 3: A8 and S8 engine-code trims to check.
  - Rule 9: RS 3 / RS 6 Avant / RS 7 spelling.
  - 20 unpriced paints.
  - **Research needed:** the A3-family trim names, and the A8/S8 grades.
- **GMC:**
  - Rule 7: 24 combined drivetrains (`FWD/AWD`, `2WD/4WD`).
  - Rule 8: 40 rows `Gas (diesel available)`.
  - Rule 9: Hummer spelling.
  - 334 unpriced options.
  - No research needed.
- **Buick:** rule 7, 9 combined drivetrains; nothing else.
- **Acura:** rule 7, `SH-AWD` → `AWD` (9 rows); rule 2, `Base` is correct (Acura sells "Integra" etc. with no grade name). No research.
- **Lexus:** clean names (official `F SPORT` styling).
  - Rule 9: TZ is a new model.
  - Rule 8: `Electric` / `Plug-in Hybrid` spelling.
  - LC and LS retired (no research).
  - **Check:** TZ seating (the research chose 6 over Lexus' feed saying 5).
- **BMW:**
  - Rule 3: split the i5 `eDrive40 / xDrive40` row.
  - Rule 7: 17 combined drivetrains.
  - Rule 2: M2, M3, M4, M5 `Base`.
  - Rule 9: XM is new; seven dataset models are retired (no research).
- **MINI:** clean. Fix the dataset's Mini/MINI duplicate first.
- **Mercedes-Benz** (imported, unpromoted):
  - Rule 6: `SUV Coupe` → `SUV` (5 rows).
  - Rule 7: `null` drivetrain on the AMG GT 43 (check).
  - Rule 9: nine split model names to merge or add.
  - Rule 3: trims repeat the model name (decided by the MarketCheck check).
  - **Research needed:** the AMG GT 43 drivetrain.
- **Cadillac:**
  - Rule 7: 39 combined drivetrains.
  - Rule 2: Escalade/ESV `Base` (check the real name).
  - 104 unpriced options.
  - CT4 not offered (no live configurator).
  - **Research needed:** the Escalade entry trim name.
- **Lincoln:** rule 7, 12 combined drivetrains; rule 8, 3 `Gas; Hybrid available` rows to split; 37 unpriced options and 10 unpriced packages.
- **Genesis:** rule 7, 11 `RWD; AWD available` rows. Names are fine.
- **Volvo:** rule 7, 7 combined; 67 "Not confirmed" items (by design); V90 Cross Country has no configurator.
- **Dodge:**
  - Rule 6: split the `coupe or sedan` Charger rows (11).
  - Rule 4: body items out of the engine column.
  - Rule 9: Charger Daytona is a new model name. Recommendation: hold it until it's added to the dataset, or map it to `Charger` (EV); this needs a decision.
- **Chrysler:** rule 7, 6 `FWD or AWD`; rule 4, drivetrain-only items folded into the engine line.
- **Alfa Romeo:** rule 7, 1 combined; MY2026 only (5 rows).
- **Mitsubishi:** rule 7, 8 combined; 123 "Not confirmed".
- **Polestar:** **check** the trim names (rule 1); Polestar 3 is excluded (MY2025 only).
- **Lucid:** clean; 13 "Not confirmed".
- **Porsche:**
  - Rule 6: `Targa` → `Convertible`; lowercase body styles.
  - Rule 9: four split model names.
  - Rule 4: transmission-only items folded into the engine line.
  - `Paint to Sample` (non-Plus) is missing from the extract (the notes say so).
- **Land Rover:**
  - Rule 9: Defender 90/110/130 and Range Rover Electric.
  - 36 unpriced roof options.
  - Rule 4: engine text is long (example above).
- **Tesla, Rivian:** no research yet.

**Manufacturer-site checks needed (a short Cowork list, after Brett's decisions):**
1. Audi A3-family trim names ("Black optic plus", "S line plus", and `Base` on A3/S3/RS 3/SQ7/SQ9);
2. Audi A8 and S8 grades;
3. the Cadillac Escalade/ESV entry trim name;
4. the Mercedes AMG GT 43 drivetrain;
5. the Polestar 4 trim names;
6. horsepower for any engine line that rule 4 rewrites without it.

---

## 4. MarketCheck plan

Today's numbers (from CLAUDE.md, 2026-10-11):
- usage is about 260 calls a month on the 500-call free tier;
- 350 were left on 2026-10-11 for October;
- **no listings exist yet for any make in this review.**

Without listings we can't measure match rates or confirm MarketCheck's model and trim names.

- **Name check first (recommended):** one facet call per make for its model names, and one per make for trim names. That's **about 2 × 21 = 42 calls**, with no listings stored. This is how the Wave 1 name problems (Ram, Jeep, Kia, Mazda) were found, and it settles rules 2, 3 and 9 per make.
- **A confirming sync per make:**
  - **Cost:** a sync takes 1 to 3 calls per model (50 listings a page, at most 3 pages). Our dataset has about 187 models across these 21 makes, so one full sync is **about 190 to 560 calls**, which on its own uses most or all of a month's 500.
  - **Ongoing cost:** once a model has listings, the Sunday job refreshes it **monthly** (every model nobody has searched). That adds about 190 to 560 calls every month, on top of the ~260 we use now. **The free tier can't carry that.**
- **What that means:**
  - **On the free tier:**
    - do the 42-call name check now;
    - import and promote without syncing;
    - let inventory arrive the way it already does for any make: the on-demand sync when a real customer pays or picks that model (each real search adds ~90 calls a month).
    - Match rates are then measured per model as real searches arrive.
  - **To measure match rates up front:** either sync a few high-volume models per month, about 10 to 15 models (30 to 45 calls) a month, or move to the paid tier (the open launch decision, about $749 a month plus a data fee). The paid tier also removes the monthly-refresh problem.
  - Either way, newly synced makes should be kept off the monthly refresh unless a real customer searched them (a one-line scheduler change, if wanted).

---

## 5. Decisions for Brett

- **D1. How the rules get applied:**
  - **(a) Recommended:** a Cowork re-pass of each CSV using these rules as the brief. Data stays the source of truth; the import stays a plain import.
  - (b) A mapping step in the import (body style, drivetrain, fuel type and model-name maps), with Cowork fixing only trim names, engine text and the checks list.
  - (c) A mix: the mapping step for rules 6 to 9, Cowork for rules 1 to 4.
- **D2. Rules 1 to 9 as written,** or with changes.
- **D3. Split models (rule 9):**
  - (a) **Recommended:** merge into our dataset's model, with body or powertrain on the row;
  - (b) add the new names to the vehicle dataset (a Matchmaker change).
- **D4. New models** (Lexus TZ, BMW XM, Dodge Charger Daytona): add them to the vehicle dataset first, or hold their rows.
- **D5. MarketCheck:** the 42-call name check now, then import without syncing (recommended), or a paid-tier decision first.
- **D6. Commit the research files as received** (data only, before any re-pass), so nothing is lost.
- **D7. Tesla and Rivian:** chase the missing research, or drop them from this wave.

---

## 6. Brett's decisions (2026-10-14)

This unified approach **replaces** the separate VW/Audi and Mercedes cleanup research. Work starts after Chunk 3 of the agent dashboard is reviewed.

- **D1, split:**
  - **Mechanical rules go in a tested mapping step in the import, with a test per rule:**
    - rule 4 (engine format);
    - rule 6 (body-style mapping);
    - rule 7 (one drivetrain per row);
    - rule 8 (fuel spelling);
    - rule 9 (model-name mapping, including merging split models).
  - **Manufacturer-dependent rules go to a Cowork re-pass:**
    - rule 1 (trim-name styling);
    - rule 2 (`Base`);
    - the four site checks in section 3;
    - missing prices.

    Claude drafts the Cowork prompts.
- **D2:** rules 1 to 9 as written.
- **D3:** split models are merged into our dataset's model names (option A).
- **D4:** the Lexus TZ, BMW XM and Dodge Charger Daytona rows are held until those models are added to the Matchmaker dataset.
- **D5:** the ~42-call name-only MarketCheck check (no listings stored), then import without syncing; inventory arrives through the existing on-demand sync.
- **D6:** commit the research files as received. `data/raw/` is 3.7 MB (Cadillac 1.4 MB, Lincoln 2.2 MB of raw configurator scrapes the app never reads). Proposed: keep it out of git (archive outside the repo, add `data/raw/` to `.gitignore`); awaiting Brett's answer. The CSVs and notes are committed.
- **D7:** Tesla and Rivian are dropped: they sell direct at fixed prices, with no dealers to negotiate with.
- **D8 (Brett, 2026-10-14):** Lucid and Polestar **stay in the import** (D7 for Tesla and Rivian is unchanged for now). Both sell at manufacturer-set prices: Lucid direct, Polestar through an agency model (dealers act as the maker's agents at its set price). So LEVR's value on these makes is sourcing, ordering and delivery, not price negotiation. **⚠ Flag for customer-facing copy before either make goes live:** the price-negotiation wording and the Day-30 guarantee (an offer below Total Suggested Retail Price) may not fit fixed-price makes; that copy needs a decision and Brett's sign-off before Lucid or Polestar is promoted. **Launch decision (Brett, 2026-10-15; CLAUDE.md open launch decision 6):** agents may be unable to get below that price, so every customer could qualify for the refund; decide between separate guarantee terms, different customer-facing copy, or holding those makes back.
