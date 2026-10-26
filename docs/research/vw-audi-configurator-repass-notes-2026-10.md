# vw-audi configurator re-pass: notes (2026-10-16)

Input `data/vw-audi-configurator-full-2026-10.csv` → output `data/vw-audi-configurator-repass-2026-10.csv`. Same header, same 90 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

| make | model | trim (old) | model_year | field | old value | new value | source URL |
|---|---|---|---|---|---|---|---|
| Volkswagen | Atlas Cross Sport | SE w/Technology | 2026 | trim | SE w/Technology | SE with Technology | https://www.vw.com/en/models/atlas-cross-sport.html |

### What was checked

- **A – Audi RS e-tron GT "performance" → "Performance": not applied.** audiusa.com writes it in lowercase ("RS e-tron GT performance"), and also lowercase for "RS 7 performance", "RS 6 Avant performance" and "RS Q8 performance". So the two RS e-tron GT rows already match Audi; the capitalised RS 6 Avant (2026), RS 7 (2026) and RS Q8 (2027) "Performance" rows are the ones that differ. Left all five unchanged for your call on one convention. Source: https://www.audiusa.com/en/models/e-tron-gt/rs-e-tron-gt/
- **A – VW:** Atlas Cross Sport 2026 "SE w/Technology" → "SE with Technology" (applied). All other VW names checked match vw.com.
- **B/C1 – A3 family:** "Black optic plus" and "S line plus" kept. Audi's own 2027 configurator lists them as separate A3 models ($42,800 / $43,700) in that lowercase styling; the 2027 A3 overview page itself wouldn't load this pass. The "Base" rows on A3 ($40,700), S3, RS 3, SQ7 2027 and SQ9 2027 stay Base: Audi gives these no grade name for 2027 (Premium / Premium Plus are gone; the configurator names the A3 only "TFSI quattro S tronic" and the SQ7 just "SQ7").
- **C2 – A8 / S8:** no grade name exists for 2027 (Audi's 2027 lineup lists no trim tiers; configurator trimline "Base"). "55 TFSI quattro" and "4.0 TFSI quattro" left unchanged. Note: the "4.0" in the S8 name came from Edmunds originally, not Audi; Audi's model name is "L TFSI tiptronic". Flag if you'd rather these rows read "Base".

## Unresolved

- Volkswagen Atlas 2026 "SE w/Technology" is probably "SE with Technology" (as on the Atlas Cross Sport), and "Peak Edition" may be sold as "Peak Edition SE with Technology" / "Peak Edition SEL"; vw.com now shows only the 2027 Atlas, so neither was changed.
- Jetta GLI 2027 "Autobahn": vw.com says "one fully loaded trim" without naming it.
- ID.4 AWD row "Pro S Plus": VW writes "AWD Pro S Plus" (drivetrain is its own column, so left).
- RS e-tron GT / RS 6 Avant / RS 7 / RS Q8 "performance" vs "Performance": your decision (see above).
- Engine facts: audiusa.com 2027 pages for A3, S3, RS 3, A5, S5, A6, A6 Sportback e-tron, A8, S8, Q3, Q5 family, SQ5 family, Q8, SQ9 and 2026 Q4 e-tron / RS 6 Avant failed to load; media.audiusa.com and media.vw.com are script-only. Those hp cells are blank. EV hp shown are Audi's launch-control maximums.

## Counts

- Rows: 90 in, 90 out.
- Cells changed: 1 (trim 1, other 0); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 81 (39 with hp, 42 hp blank).
- Prices (section D): not touched in this batch.
