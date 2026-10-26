# Cowork prompt: pass 4 (drafted 2026-10-16, ready to run)

The "next Cowork pass" list collected through the pass 3 review (section 8) and the group 1–3 reviews. It works on the files the imports now use and writes a new `-pass4-` file per affected group.

After it lands, Claude will:
- review it the same way as before;
- apply item F to Matchmaker v21;
- release or keep the held rows;
- re-import the changed makes (the live ones as replacement batches, checked against the live batch before swapping).

```
LEVR Auto — configurator pass 4: missing trims and model years, GM package-note cleanup, 2026 BMW X3 sDrive, 2027 Durango prices (US market, MY2026/MY2027)

Work through EVERY item below, in order, without stopping to ask questions. When something can't be confirmed, leave it as it is, log it under "Unresolved", and move on. Save each group's output files the moment that group is finished, so a stopped run can resume.

INPUTS (do NOT edit them; these are the files the imports now use):
  data/vw-audi-configurator-pass3-2026-10.csv
  data/porsche-landrover-configurator-prices-2026-10.csv
  data/mercedes-configurator-pass3-2026-10.csv
  data/bmw-mini-configurator-pass3-2026-10.csv
  data/gmc-buick-configurator-pass3-2026-10.csv
  data/cadillac-lincoln-configurator-pass3-2026-10.csv
  data/dodge-chrysler-alfa-configurator-pass3b-2026-10.csv   (Dodge reference only, item F; do not edit)
  Background, read first: docs/research/configurator-pass3-review-2026-10-16.md (sections 7 and 8) and docs/research/configurator-group1-review-2026-10-16.md, -group2-, -group3-.

OUTPUTS, per input file you change (new files only):
  1. data/<stem>-configurator-pass4-2026-10.csv, where <stem> is the input's name without "-configurator-<kind>-2026-10.csv" (e.g. data/vw-audi-configurator-pass4-2026-10.csv). Same 18 columns in the same order, same cell format ("Name | Availability | Price | Package" joined by " ;; "), prices in the style the file already uses, same line endings. Every existing row stays in its place. A NEW row goes directly after the last existing row of the same model and year.
  2. docs/research/<stem>-configurator-pass4-notes-2026-10.md (format at the bottom).
  3. data/configurator-engine-facts-pass4-2026-10.csv: same columns as data/configurator-engine-facts-2026-10.csv (make,model,trim,model_year,engine_option,hp,displacement_l,cylinders,source_url). One row for every engine option in a NEW row whose text doesn't state the hp, the engine size (gas/hybrid) or the cylinder layout, PLUS item G's rows.
  4. At the end: docs/research/configurator-pass4-summary-2026-10.md (every group's counts, every Unresolved item, anything needing Brett's decision, and item F's table).
  A file with nothing to change gets no output.

ORDER: A (Audi) · B (Porsche) · C (Mercedes-Benz) · D (BMW) · E (GMC, Buick, Cadillac, Lincoln) · F (Dodge, report only) · G (horsepower).

RESUMING: before starting an item, check whether its output files exist. If the notes' Progress line says it's done, skip it. Never redo or overwrite finished work.

WHAT TO DO

A. AUDI: models researched with only one trim (vw-audi)
   These Audi rows are each the only trim of their model in the file: A5, A6, A8, Q3, Q5, Q5 Sportback, RS 3, RS 6 Avant, RS 7, RS Q8, S3, S5, S8, SQ5, SQ5 Sportback, SQ9 (each with its existing model year).
   For each model, add every OTHER trim audiusa.com sells for that model year (e.g. Q5 2027: Premium Plus and Prestige next to the existing Premium), with Audi USA's exact names and styling ("Premium Plus", "Prestige", "S line", "Black optic", lowercase "performance").
   If audiusa.com sells only the one trim for that year (e.g. A8, S8, RS 3), say so and add nothing.
   Each new row: every column filled from audiusa.com as the existing rows are; every option priced where published; source URLs in "sources".

B. PORSCHE: 2026 Macan Electric (porsche-landrover)
   The file has the Macan Electric for 2027 only (Base, 4, 4S, GTS, Turbo), but dealers list 2026 Electric Macans.
   Add the 2026 Macan Electric trims porsche.com/usa sold for model year 2026 (model "Macan Electric", same style as the 2027 rows), including Paint to Sample at its 2026 price. If porsche.com/usa no longer shows 2026 pricing, use Porsche's own 2026 price list or press material and say which.

C. MERCEDES-BENZ: 2026 E-Class (mercedes)
   The file has the E-Class sedan and E-Class Wagon for 2027 only, but dealers list many 2026 cars (E 350, E 450 4MATIC, AMG E 53 HYBRID, E 450 All-Terrain).
   Add the 2026 rows Mercedes-Benz USA sold (models "E-Class" and "E-Class Wagon", same trim styling as the 2027 rows).
   If mbusa.com no longer shows 2026 pricing, use Mercedes-Benz USA's own 2026 price list or press material and say which.

D. BMW: 2026 X3 sDrive (bmw-mini)
   Does BMW USA sell an sDrive (RWD) X3 for model year 2026 or 2027? The file has "30 xDrive" and "M50 xDrive".
   If an sDrive X3 exists for a year the file covers, add its row ("30 sDrive" style, as the file writes trims). If not, say so plainly.

E. GM: research notes inside package contents (gmc-buick, cadillac-lincoln)
   Some package_definitions entries carry research notes inside their contents, about 175 GMC/Buick and 7 Lincoln. For example:
     "(name not exposed by configurator)", "configurator marks this package Requires Package: it can only be added on top of another package",
     "dealer-installed LPO accessory package", "contents: not itemized by configurator".
   For each such entry, rewrite the contents to the plain list of what the package includes, as the brand's US configurator or order guide names them, with no notes.
     - If the note says the package can only be added on top of another package, drop the note from the contents and add a line under "Package requirements" in the notes file (package, what it requires, source URL).
     - If the contents genuinely aren't published, write exactly: contents: not published
   Change nothing else in those entries (name, price).

F. DODGE: 2027 Durango prices (REPORT ONLY; do not edit any file)
   From Dodge's 2027 Build & Price data (dodge.com/hostd/api/cvd/CUD202711/CUD202711_CVD.json and its per-configuration pages), list every 2027 Durango configuration with its MSRP before destination, and the destination charge.
   Known: GT HEMI V8 AWD $43,875, GT HEMI V8 Plus $47,475, GT HEMI V8 Premium $50,475, R/T 392 $51,745, R/T 392 Plus $55,645, R/T 392 Premium $58,345, SRT Hellcat $81,495, SRT Hellcat Jailbreak $82,490.
   Confirm or correct each, and add any configuration missing from that list.

G. HORSEPOWER where it's now published
   Engine lines still without official hp: Lexus TZ 2027 (3 trims), VW Atlas 2026 (5 trims × FWD/AWD), Audi (28 lines, e.g. A3, A5, A6, A8, Q3), Mitsubishi Outlander Sport 2027 / Eclipse Cross 2026 (16 lines).
   For each, add a row to the pass 4 engine-facts file if the brand's US site or press kit now states the hp. Never estimate.

RULES
  - Official US manufacturer sources only (brand US website, configurator, order guide, price sheet, press kit). No dealer or third-party sites.
  - Never estimate. If something isn't published, or the site blocks reading it, leave it and log it.
  - Never write 0 unless the item is standard equipment or the manufacturer says "no charge" / "$0".
  - Trim names use the manufacturer's exact styling.
  - Don't change anything that isn't listed here: existing rows' trims, model names, body_style, drivetrain, fuel_type, engine text, option names, prices or availability, or the order of existing rows.
  - Add the source URL of every change to that row's "sources" cell.
  - Don't call MarketCheck or any paid API. Don't accept cookie banners or change browser settings unless a page can't be read otherwise; if you do, say which site.

NOTES FILE FORMAT (one per changed input file)
  Progress: <item> done | <item> in progress | <item> not started   (one entry per item that touches the file; updated at every save)
  ## Rows added            — table: make | model | trim | model_year | body_style | why | source URL
  ## Package contents fixed — table: make | model | trim | model_year | package | old contents (first 80 characters) | new contents (first 80 characters) | source URL
  ## Package requirements  — table: make | model | trim | model_year | package | requires | source URL
  ## Nothing to add        — one bullet per model/question where the answer was "none" (e.g. "A8 2027: Audi USA sells one version")
  ## Unresolved            — one bullet per item you couldn't confirm
  ## Counts                — rows in, rows out (and why they differ), rows added, package contents fixed

Before each save: same header as the input, every row 18 fields, every option cell still "Name | Availability | Price | Package", and every existing row still present in its original order.
```
