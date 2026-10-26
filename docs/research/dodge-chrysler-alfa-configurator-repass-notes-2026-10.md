# dodge-chrysler-alfa configurator re-pass: notes (2026-10-16)

Input `data/dodge-chrysler-alfa-configurator-full-2026-10.csv` → output `data/dodge-chrysler-alfa-configurator-repass-2026-10.csv`. Same header, same 41 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

| make | model | trim (old) | model_year | field | old value | new value | source URL |
|---|---|---|---|---|---|---|---|
| Dodge | Durango | GT Plus America250 | 2026 | trim | GT Plus America250 | GT Plus A250 edition | https://www.dodge.com/news/2026-dodge-durango-gt-america250-edition.html |
| Dodge | Durango | GT Premium | 2026 | trim | GT Premium | GT HEMI Premium | https://www.dodge.com/news/2026-dodge-durango-gt-america250-edition.html |
| Dodge | Durango | GT Premium America250 | 2026 | trim | GT Premium America250 | GT HEMI Premium A250 edition | https://www.dodge.com/news/2026-dodge-durango-gt-america250-edition.html |
| Dodge | Durango | GT | 2027 | trim | GT | GT HEMI | https://media.stellantisnorthamerica.com/newsrelease.do?id=27784 |
| Dodge | Durango | GT Plus | 2027 | trim | GT Plus | GT HEMI Plus | https://media.stellantisnorthamerica.com/newsrelease.do?id=27784 |
| Dodge | Durango | GT Premium | 2027 | trim | GT Premium | GT HEMI Premium | https://media.stellantisnorthamerica.com/newsrelease.do?id=27784 |

### What was checked

- **A – Durango:** 2027 "GT" / "GT Plus" / "GT Premium" → "GT HEMI" / "GT HEMI Plus" / "GT HEMI Premium" (2027 press kit); 2026 "GT Premium" → "GT HEMI Premium", "GT Premium America250" → "GT HEMI Premium A250 edition", "GT Plus America250" → "GT Plus A250 edition".
- **B:** "Base" is right for Alfa Romeo Giulia and Stelvio.
- **C8 – Charger Daytona 2027 (notes only, no change):** the Scat Pack Plus is **670 hp** (it's an upgrade package on the Daytona Scat Pack, rated 670 hp / 627 lb-ft; PowerShot adds 40 hp for 10 s). A plain **2027 Daytona Scat Pack is sold** ($72,495 two-door / $72,995 four-door). The file has no row for it.

## Unresolved

- Durango 2026 "GT" and "GT Plus" rows mix the V6 GT and the GT HEMI, which Dodge names separately; "GT Plus A250 edition" likewise (V6) vs "GT HEMI Plus A250 edition". Not split (no new rows allowed).
- 2027 dodge.com FAQ still lists GT / GT Plus (V6, 295 hp) alongside the GT HEMI trims, while the 2027 press kit lists only HEMI trims.
- Missing row: 2027 Charger Daytona Scat Pack (plain).
- Engine facts: "AWD HEMI V8"-type lines are drivetrain lines, left blank. Chrysler 2026 Pacifica 287 hp from the 2027 press kit and 2026 Voyager spec page.

## Counts

- Rows: 41 in, 41 out.
- Cells changed: 6 (trim 6, other 0); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 50 (42 with hp, 8 hp blank).
- Prices (section D): not touched in this batch.
