# Cowork re-pass prompt: Wave 2 + Wave 3, combined (2026-10-15)

Replaces the five batch prompts drafted 2026-10-14, which were never run. It covers every manufacturer-dependent item from decision D1 (Wave 2 review) and the Wave 3 decisions (Wave 3 review, section 7). The mechanical rules (engine format, body style, one drivetrain per row, fuel spelling, model names) are NOT part of it: the import's tested mapping step (`src/lib/configurator-mapping.ts`) applies those, and it needs the original values.

The engine-facts table it asks for feeds that mapping step: official horsepower, plus the size or cylinder layout where the research text doesn't state them, so the step never guesses.

```
LEVR Auto — configurator re-pass, Wave 2 + Wave 3 combined (US market, MY2026/MY2027)

You are re-checking research files that already exist in this repo. Change ONLY what this brief lists. Everything else stays exactly as it is, byte for byte.

INPUTS (12 configurator files + 1 Matchmaker file; each configurator file has a notes file in docs/research/ with a matching name):
  data/vw-audi-configurator-full-2026-10.csv
  data/gmc-buick-configurator-full-2026-10.csv
  data/cadillac-lincoln-configurator-full-2026-10.csv
  data/mercedes-configurator-full-2026-10.csv
  data/bmw-mini-configurator-full-2026-10.csv
  data/porsche-landrover-configurator-full-2026-10.csv
  data/lexus-acura-configurator-full-2026-10.csv
  data/genesis-volvo-configurator-full-2026-10.csv
  data/dodge-chrysler-alfa-configurator-full-2026-10.csv
  data/mitsubishi-polestar-lucid-configurator-full-2026-10.csv
  data/maserati-configurator-full-2026-10.csv
  data/fiat-configurator-full-2026-10.csv
  data/matchmaker-additions-wave3-2026-10.csv
Background, read first: docs/research/configurator-wave2-review-2026-10-14.md (sections 2, 3, 6) and docs/research/configurator-wave3-review-2026-10-15.md (sections 3, 4, 7).

OUTPUTS (new files only; never overwrite an input):
  1. For each configurator input: data/<stem>-repass-2026-10.csv, where <stem> is the input name without "-configurator-full-2026-10.csv" (e.g. data/vw-audi-configurator-repass-2026-10.csv). The SAME rows in the SAME order, the same 18 columns in the same order, and the same cell format as the input: options are "Name | Availability | Price | Package" joined by " ;; "; availability is exactly Standard / Standalone / Package-only / Unavailable (or blank where the input has it blank); prices are written in the same style the input file already uses. Toyota format, exactly like the input.
  2. For each configurator input: docs/research/<stem>-repass-notes-2026-10.md (format at the bottom).
  3. data/matchmaker-additions-wave3-repass-2026-10.csv: the Matchmaker file with only the changes in section F. Same 46 columns, same order, same rows.
  4. data/configurator-engine-facts-2026-10.csv (section E).
  5. docs/research/configurator-repass-summary-2026-10.md: one page, every file's counts, every Unresolved item, and anything you think needs Brett's decision.

DO NOT CHANGE (the tested import step handles these and needs the originals):
  - body_style (even "SUV Coupe", "Targa", "coupe or sedan"), drivetrain (even "FWD/AWD", "2WD/4WD", "SH-AWD", "RWD; AWD available"), fuel_type (even "Electric", "Gas (diesel available)", "Gas; Hybrid available");
  - model names (even "RS 3", "HUMMER EV SUV", "GLE Coupe", "Defender 110", "Charger Daytona", "Cayenne Electric");
  - the wording of engine/transmission/drivetrain option text (drivetrain_engine_variants);
  - row count and row order. Do not split or add rows (e.g. leave the BMW i5 "eDrive40 / xDrive40" row as one row; just note it).
  Exceptions are named explicitly below (C4, C7) and are the only ones.

A. TRIM NAMES (every row of every configurator file)
   Write each trim exactly as the manufacturer's US website writes it for that model year: capitals, spacing, punctuation and branding (e.g. "F SPORT", "4MATIC", "xDrive", "OCTA", "S line", "Black optic", "R/T Plus", "A-Spec", "POP"). Known: Audi RS e-tron GT "performance" -> "Performance". Leave trims that repeat the model name (Mercedes "GLE 450 4MATIC" under model GLE) as they are.

B. "Base"
   A trim is called Base only when the manufacturer gives the entry version no name; otherwise use the real name. Confirm each:
   - expected correct: Porsche Macan / Cayenne / Taycan / Panamera; BMW M2 / M3 / M4 / M5; Acura Integra / ADX / RDX / MDX; Alfa Romeo Giulia / Stelvio; Genesis GV60 / Electrified GV70; Maserati MCPURA and GT2 Stradale.
   - to check: Audi A3, S3, RS 3, SQ7, SQ9 (may be "Premium" etc.); Cadillac Escalade and Escalade ESV (see C3); Maserati GranTurismo and GranCabrio 2027 entry version (it was "Modena" through MY2026; is it now unnamed, i.e. Base, or still "Modena"?).

C. SITE CHECKS (record the evidence URL for each in the notes)
   C1. Audi A3 family: are "Black optic plus" and "S line plus" real US trim names, and what are the real names of the rows called "Base" on A3, S3, RS 3, SQ7, SQ9? If one row stands for two real trims, say so; don't add a row.
   C2. Audi A8 "55 TFSI quattro" and S8 "4.0 TFSI quattro": what grade name(s) does Audi USA sell? Rename the trim to the real grade if there is one.
   C3. Cadillac Escalade and Escalade ESV rows called "Base": Cadillac names every Escalade trim; find which real trim each row is and rename it.
   C4. Mercedes-AMG GT 43 (model "AMG GT Coupe"): its drivetrain is blank. Find whether it is RWD or AWD for that model year and fill it in. This is the ONLY drivetrain you may change.
   C5. Polestar 4 trims "Dual motor" / "Rear motor": rename to the exact US names (e.g. "Long range Dual motor").
   C6. Lexus TZ seating: the research chose 6 seats over a Lexus feed that says 5. Confirm from Lexus US and fix seating_configuration if wrong.
   C7. Maserati Grecale Folgore: its engine option says "Electric, 542 hp, automatic, AWD" while the other Folgore rows say "single-speed". Confirm the transmission from Maserati US and correct that one engine option's wording if needed. This is the ONLY engine text you may change.
   C8. Dodge Charger Daytona 2027: confirm the horsepower (630 or 670) and whether a 2027 plain "Scat Pack" (not Plus) exists. Report only, in the notes (no row is added).
   C9. Maserati MCPURA, MCPURA Cielo, GT2 Stradale: have US prices been published since 2026-10-15? Fill them only if Maserati US now publishes them; otherwise leave blank.

D. MISSING PRICES
   Every Standalone or Package-only option with a blank price: fill in the manufacturer's published US price for that model year (configurator or order guide). Where it isn't published anywhere official, leave it blank and say so. Never write 0 unless the manufacturer says "no charge". A feature that only comes inside a package keeps a blank price (the package carries it); say so in the notes.
   Known counts: GMC 334 (301 features, 29 wheels, 4 seating); Buick 7; Cadillac 104; Lincoln 37 plus 10 packages in package_definitions with no price; Land Rover 36 roof options; Audi 20 paints; Volkswagen 1 wheel; Maserati 19 on the ten priced trims (plus the three unpriced models in C9).
   Do NOT fill blank AVAILABILITY ("Not confirmed" items: Volvo 67, Mitsubishi 123, Lucid 13, Maserati 28); those are blank on purpose.
   Porsche "Paint to Sample" (non-Plus) is missing from the extract: add it only if porsche.com/usa confirms its availability and price for that model, and log it as an added option.

E. ENGINE FACTS TABLE: data/configurator-engine-facts-2026-10.csv
   Columns, in this order: make,model,trim,model_year,engine_option,hp,displacement_l,cylinders,source_url
   - One row for every engine option (in drivetrain_engine_variants) whose text does NOT state the horsepower in hp, or does NOT state the engine size (gas/hybrid engines only), or states only "N-cylinder" without the layout.
   - make, model, trim, model_year and engine_option exactly as they appear in YOUR re-pass output file (engine_option = the option's exact name text, before " | ").
   - hp: the manufacturer's US horsepower, a whole number (where the source gives PS or kW, use the brand's US hp figure if published; otherwise convert and say so in the notes).
   - displacement_l: e.g. 2.0 (blank for electric). cylinders: one of I3, I4, I6, V6, V8, V10, V12, flat-4, flat-6 (blank for electric).
   - Leave a cell blank if no official source states it. Never estimate.
   Examples of options that need a row: BMW "2.0-liter BMW TwinPower Turbo inline 4-cylinder ... RWD" (no hp); MINI "161-hp turbocharged engine ..." (no size); Volvo "B5 AWD Gas (mild hybrid), 247 hp" (no size); Land Rover "... 400PS (294kW) ..." (PS, and "6-cylinder" without layout); Dodge "AWD HEMI V8" and "3.0L Twin Turbo Sixpack SO" (no hp); Audi "TFSI S tronic quattro AWD" (no size, no hp).

F. MATCHMAKER FILE: data/matchmaker-additions-wave3-repass-2026-10.csv
   F1. BMW XM Label 2027: range_mi must be the EPA TOTAL range (gas plus electric), never the electric-only range (a standing rule: plug-in hybrid range is always total range). Today it says 30. Put the EPA total range, or leave it blank if EPA doesn't publish one.
   F2. Maserati resale_depreciation_pct / resale_source: rows say "model-specific" (GranTurismo 31.8%, GranCabrio 42.8%, Grecale 53.2%, Folgore rows 47.9 / 58.9 / 69.2) while MCPURA and GT2 Stradale use the brand-level 75.3%. Find and cite the source for each model-specific figure. If it can't be confirmed for that model, use the brand-level figure and say "CarEdge, brand-level only, ..." in resale_source, the same wording as the rest of the dataset.
   F3. Apply the Maserati trim and "Base" outcomes from A/B so trim names match the Maserati configurator file exactly.
   F4. Leave the six Dodge Charger Daytona rows exactly as they are (they will be dropped at import; our dataset already has the Charger Daytona as model "Charger").

RULES FOR EVERY CHANGE
   - Official manufacturer sources only: the brand's US website, configurator, order guide or press kit (and fueleconomy.gov / EPA for F1). No dealer or third-party sites, except where the original research already used them for the Matchmaker file and you say so.
   - If you can't confirm something, leave the value unchanged and list it under "Unresolved".
   - Add the source URL of every change to that row's "sources" cell (configurator files) or to the notes (Matchmaker file).
   - Don't call MarketCheck or any paid API. Don't accept cookie banners or change browser settings unless a page can't be read otherwise; if you do, say which site.

NOTES FILE FORMAT (one per configurator input):
  ## Changes     — table: make | model | trim (old) | model_year | field | old value | new value | source URL
  ## Unresolved  — one bullet per item you couldn't confirm, with what you found
  ## Counts      — rows in, rows out (must be equal), trims renamed, prices filled, prices still blank, options added (per make)

Before you finish, check every output configurator file: same header as the input, same number of rows, every row 18 fields, and every option cell still in the "Name | Availability | Price | Package" format.
```
