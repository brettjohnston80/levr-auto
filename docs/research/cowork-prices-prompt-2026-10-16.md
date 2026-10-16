# Cowork prompt: missing prices (section D) and Porsche Paint to Sample (2026-10-16)

Section D of the combined re-pass (`cowork-repass-prompt-2026-10-15.md`), which the first re-pass run skipped. Order and rules from Brett, 2026-10-16. It works on the re-pass files (trims already corrected), writes a separate `-prices-` file per make group, and saves as it goes, so a stopped run resumes where it left off.

```
LEVR Auto — configurator re-pass, section D: missing prices + Porsche Paint to Sample (US market, MY2026/MY2027)

Work through EVERY make below, in order, without stopping to ask questions. When something can't be confirmed, leave it as it is, log it under "Unresolved", and move on. Save each make group's output files the moment that group is finished, so a stopped run can resume.

ORDER (do them in this order; a "group" is one input file):
  1. GMC            (data/gmc-buick-configurator-repass-2026-10.csv)
  2. Cadillac       (data/cadillac-lincoln-configurator-repass-2026-10.csv)
  3. Lincoln        (same file as Cadillac)
  4. Land Rover     (data/porsche-landrover-configurator-repass-2026-10.csv)
  5. Audi           (data/vw-audi-configurator-repass-2026-10.csv)
  6. then the rest: Buick (gmc-buick file), Volkswagen (vw-audi file), Porsche incl. Paint to Sample (porsche-landrover file), Maserati (maserati file), and a confirm-only check of every other repass file (mercedes, bmw-mini, lexus-acura, genesis-volvo, dodge-chrysler-alfa, mitsubishi-polestar-lucid, fiat).

INPUTS: the twelve data/*-configurator-repass-2026-10.csv files (they already carry the re-pass trim fixes). Do NOT edit them.

OUTPUTS, per input file (new files only):
  1. data/<stem>-configurator-prices-2026-10.csv, where <stem> is the repass file's name without "-configurator-repass-2026-10.csv" (e.g. data/gmc-buick-configurator-prices-2026-10.csv). The SAME rows in the SAME order, same 18 columns in the same order, same cell format ("Name | Availability | Price | Package" joined by " ;; "), prices written in the style the file already uses. Toyota format, exactly like the input.
  2. docs/research/<stem>-configurator-prices-notes-2026-10.md (format at the bottom).
  When a file holds two makes (gmc-buick, cadillac-lincoln, porsche-landrover, vw-audi), work the makes in the ORDER above, and re-save the output after EACH make, with the notes' "Progress" line updated.
  3. At the end: docs/research/configurator-prices-summary-2026-10.md (every group's counts, every Unresolved item, anything needing Brett's decision).

RESUMING: before starting a group, check whether its output files exist. If the notes' Progress line says a make is done, skip it and continue from the next one. Never redo or overwrite finished work.

WHAT TO DO
  A. Missing prices. Every option whose availability is Standalone or Package-only and whose price is blank: fill in the manufacturer's published US price for that model year (the brand's US configurator, order guide or price sheet). Also every package in package_definitions with no price (Lincoln has 10).
     Known counts: GMC 334 (301 features, 29 wheels, 4 seating); Cadillac 104; Lincoln 37 + 10 packages; Land Rover 36 roof options; Audi 20 paints; Buick 7; Volkswagen 1 wheel; Maserati 19 on the ten priced trims.
     Maserati MCPURA, MCPURA Cielo, GT2 Stradale: fill only if Maserati US now publishes prices (it didn't on 2026-10-16).
     Confirm-only files: check there are no blank Standalone/Package-only prices; log "0 found" if so.
  B. Porsche "Paint to Sample" (non-Plus) is missing from the extract. Add it as an exterior colour option ONLY where porsche.com/usa's configurator shows it for that model and model year, with its exact name and price, availability Standalone. Log every row it was added to (or "not offered" per model).

RULES
  - Official US manufacturer sources only (brand US website, configurator, order guide, price sheet, press kit). No dealer or third-party sites.
  - Never estimate. If a price isn't published, or the site blocks reading it, leave it blank and log it.
  - Never write 0 unless the manufacturer says "no charge" / "$0". A feature that only comes inside a package keeps a blank price (the package carries it); log it as "package-priced".
  - Do NOT touch availability values, including blank ("Not confirmed") ones: Volvo 67, Mitsubishi 123, Lucid 13, Maserati 28.
  - Do NOT change anything else: trims, model names, body_style, drivetrain, fuel_type, engine text, option names, row count or order. Don't add rows. The only option you may add is Porsche Paint to Sample (B).
  - Add the source URL of every filled price to that row's "sources" cell.
  - Don't call MarketCheck or any paid API. Don't accept cookie banners or change browser settings unless a page can't be read otherwise; if you do, say which site.

NOTES FILE FORMAT (one per input file)
  Progress: <make> done | <make> in progress | <make> not started   (one entry per make in the file; updated at every save)
  ## Prices filled  — table: make | model | trim | model_year | option | old price | new price | source URL
  ## Options added  — table: make | model | trim | model_year | option | availability | price | source URL
  ## Still blank    — table: make | model | trim | model_year | option | reason (not published / package-priced / site blocked)
  ## Unresolved     — one bullet per item you couldn't confirm
  ## Counts         — per make: blank prices in, filled, package-priced, still blank, options added; rows in = rows out

Before each save: same header as the input, same row count, every row 18 fields, every option cell still "Name | Availability | Price | Package".
```
