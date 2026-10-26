# Cowork prompt: pass 3, missing rows, splits, GM re-tags and checks (drafted 2026-10-16, NOT started)

The "later Cowork pass" from the re-pass decisions (`configurator-repass-review-2026-10-16.md` section 7, item 6) and the prices-pass decisions (`configurator-prices-review-2026-10-16.md`, Brett's decisions 2026-10-16). It works on the prices files and writes a new `-pass3-` file per affected group. **Don't start it until Brett says so.**

After it lands:
- the mapping step's 67 GM "$0 → blank" corrections are retired, because this pass writes those cells itself;
- the 2027 Charger Daytona Scat Pack hold in `data/held-models.json` is released or kept, depending on C1.

```
LEVR Auto — configurator pass 3: missing rows, row splits, GM re-tags, standard-equipment checks (US market, MY2026/MY2027)

Work through EVERY item below, in order, without stopping to ask questions. When something can't be confirmed, leave it as it is, log it under "Unresolved", and move on. Save each group's output files the moment that group is finished, so a stopped run can resume.

INPUTS (do NOT edit them):
  data/gmc-buick-configurator-prices-2026-10.csv
  data/cadillac-lincoln-configurator-prices-2026-10.csv
  data/dodge-chrysler-alfa-configurator-prices-2026-10.csv
  data/bmw-mini-configurator-prices-2026-10.csv
  data/mercedes-configurator-prices-2026-10.csv
  data/mitsubishi-polestar-lucid-configurator-prices-2026-10.csv
  data/vw-audi-configurator-prices-2026-10.csv
  Background, read first: docs/research/configurator-prices-review-2026-10-16.md and each input's docs/research/<stem>-configurator-prices-notes-2026-10.md (their "Still blank" and "Unresolved" sections list the GM items below).

OUTPUTS, per input file (new files only):
  1. data/<stem>-configurator-pass3-2026-10.csv, where <stem> is the input's name without "-configurator-prices-2026-10.csv". Same 18 columns in the same order, same cell format ("Name | Availability | Price | Package" joined by " ;; "), prices in the style the file already uses, same line endings. Every existing row stays in its place. A NEW row goes directly after the last existing row of the same model and year. A SPLIT replaces the one row, in its place, with its rows.
  2. docs/research/<stem>-configurator-pass3-notes-2026-10.md (format at the bottom).
  3. data/configurator-engine-facts-pass3-2026-10.csv: same columns as data/configurator-engine-facts-2026-10.csv (make,model,trim,model_year,engine_option,hp,displacement_l,cylinders,source_url), one row for every engine option in a NEW or SPLIT row whose text doesn't state the hp, the engine size (gas/hybrid) or the cylinder layout.
  4. At the end: docs/research/configurator-pass3-summary-2026-10.md (every group's counts, every Unresolved item, anything needing Brett's decision).
  A file with nothing to change still gets its output (an identical copy) and a notes file saying "no changes".

ORDER:
  1. GMC, Buick (gmc-buick)    2. Cadillac, Lincoln (cadillac-lincoln)    3. Dodge (dodge-chrysler-alfa)
  4. BMW (bmw-mini)            5. Mercedes-Benz (mercedes)                6. Mitsubishi (mitsubishi-polestar-lucid)
  7. Audi, Volkswagen (vw-audi)

RESUMING: before starting a group, check whether its output files exist. If the notes' Progress line says a make is done, skip it and continue with the next one. Never redo or overwrite finished work.

WHAT TO DO

A. GM: items marked Standalone that are really package or engine content (gmc-buick, cadillac-lincoln)
   The items in the prices notes' "Still blank" tables whose reason is "requires other items" or "already in the configurator's default build" (about 230: GMC 158, Cadillac 71, plus the Sierra 1500 Pro alternator and AT4/AT4X block heater). For each item on that row's build in the brand's US configurator:
   - it comes only inside a package: set availability Package-only, put the package's exact name in the Package field, and keep the price blank. Make sure that package is in that row's package_definitions with its price (add it there if it's missing, with its official price and contents);
   - it comes with an engine, transmission or drivetrain choice (alternators, diesel block heaters, Exhaust Brake, GVWR and the like): set availability Package-only and put that engine/drivetrain option's exact name in the Package field;
   - it's standard on that build: set availability Standard, price 0;
   - it can't be confirmed: leave it unchanged and log it.
   Also: 2027 GMC Acadia AT4, 18-in. Gloss Black wheels. GM lists $2,495; the file has them Package-only. Confirm which it is and fix availability/price to match.
   Also: Buick Encore GX AUX heater (+$395, GM asks to confirm a change when added). Find what the change is, and record the item the way the rules above say.

B. GM: the 67 items the prices pass wrote as $0 (GMC 57, Buick 3, Cadillac 7; listed in the prices notes' "Prices filled" tables)
   A configurator total not changing is NOT the manufacturer saying "no charge". For each one:
   - it's standard equipment on that build (GM's standard-equipment list or window-sticker data says so): set availability Standard, price 0. Check Night Vision on the 2026 Escalade / Escalade ESV Platinum and V rows first;
   - GM publishes a real "$0" / "no charge" for it: keep Standalone, price 0, and quote where it says so;
   - otherwise: set the price back to blank (availability unchanged).

C. MISSING ROWS (add only when the brand's US configurator or price sheet confirms the trim for that model year, with its own options)
   C1. 2027 Dodge Charger Daytona plain "Scat Pack" (not Plus): Dodge's 2027 Build & Price (dodge.com/hostd/api/cvd/CUD202714/CUD202714_CVD.json) lists only the Daytona Scat Pack Plus, while the first re-pass reported a plain Scat Pack at $72,495 (2-door) / $72,995 (4-door). Settle it from Dodge US sources. If it exists for 2027, add the row (model "Charger Daytona", trim "Scat Pack", body "coupe or sedan", like the 2026 row) and record both door prices. If it doesn't, say so plainly.
   C2. BMW (2027): the file has X5 "40 xDrive" and 7 Series "740". Add the missing X5 "40" (RWD, sDrive), X5 "50e xDrive" (plug-in hybrid) and 7 Series "750e xDrive" (plug-in hybrid; BMW USA lists it from 11/2026) if BMW USA sells them for 2027. Use the file's existing trim style ("40 xDrive") and BMW USA's names.
   C3. 2026 Mitsubishi Eclipse Cross: add "SE Pano" and "SEL Touring" if mitsubishicars.com sells them for 2026 (the file has ES, LE, SE, Black Edition, SEL, Ralliart).
   For every new row: every column filled from official sources as the existing rows are; every option priced where published; engine options in the file's existing style; source URLs in "sources".

D. ROW SPLITS (one row stands for two real trims today)
   D1. Dodge Durango 2026 "GT" (drivetrain "RWD or AWD"): the 2026 GT HEMI trims are already their own rows, so check whether this row mixes the V6 GT and a V8 GT HEMI (base) trim. If it does, split it into "GT" (3.6L V6) and "GT HEMI" (5.7L V8), each with its own drivetrains, engine, options and packages. If it's only the V6 GT, leave it and say so. (2027 has GT HEMI rows only; confirm no 2027 V6 GT is sold.)
   D2. Mercedes-Benz EQE SUV "EQE 320" 2027 (drivetrain "RWD/AWD"): split into the RWD and the 4MATIC trim with Mercedes-Benz USA's exact names, each with its own drivetrain and options.

E. SMALLER ITEMS
   E1. VW ID.4 Pro 2026: the 20-in. wheel listed for AWD isn't offered on the RWD Pro. If the configurator confirms that, set it Unavailable on the RWD row.
   E2. Audi paints the prices pass couldn't select: RS 6 Avant 2026 Sebring Black; RS e-tron GT 2026 Ascari Blue, Progressive Red, Bedford Green. Confirm the price or that they're not offered (then Unavailable).
   E3. Audi names: "Nimbus Gray" vs Audi's "Nimbus Gray pearl effect", and "Bedford Green" vs "Bedford Green metallic". Use Audi USA's exact names.
   E4. Lincoln Dynamic Handling Package: $2,500 on the Aviator Black Label, unpriced on the Reserve (it needs Reserve II). Record what lincoln.com says for each Aviator trim.

RULES
  - Official US manufacturer sources only (brand US website, configurator, order guide, price sheet, standard-equipment list, press kit). No dealer or third-party sites.
  - Never estimate. If something isn't published, or the site blocks reading it, leave it as it is and log it.
  - Never write 0 unless the item is standard equipment or the manufacturer says "no charge" / "$0".
  - Availability may change ONLY under A, B, C, D and E1–E2. Blank ("Not confirmed") availabilities elsewhere stay blank (Volvo, Mitsubishi, Lucid, Maserati).
  - Don't change anything else: existing trims, model names, body_style, drivetrain, fuel_type, engine text, option names (except E3) or the order of existing rows.
  - Add the source URL of every change to that row's "sources" cell.
  - Don't call MarketCheck or any paid API. Don't accept cookie banners or change browser settings unless a page can't be read otherwise; if you do, say which site.

NOTES FILE FORMAT (one per input file)
  Progress: <make> done | <make> in progress | <make> not started   (one entry per make in the file; updated at every save)
  ## Re-tagged      — table: make | model | trim | model_year | option | old availability | new availability | package / option it comes with | source URL
  ## $0 items       — table: make | model | trim | model_year | option | outcome (Standard / published $0 / back to blank) | source URL
  ## Rows added     — table: make | model | trim | model_year | body_style | why | source URL
  ## Rows split     — table: make | model | old trim | model_year | new trims | source URL
  ## Other changes  — table: make | model | trim | model_year | field / option | old | new | source URL
  ## Unresolved     — one bullet per item you couldn't confirm
  ## Counts         — per make: re-tagged, $0 items by outcome, rows added, rows split, other changes; rows in, rows out (and why they differ)

Before each save: same header as the input, every row 18 fields, every option cell still "Name | Availability | Price | Package", and every existing row still present in its original order.
```
