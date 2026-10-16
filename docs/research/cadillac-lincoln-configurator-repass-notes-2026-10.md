# cadillac-lincoln configurator re-pass: notes (2026-10-16)

Input `data/cadillac-lincoln-configurator-full-2026-10.csv` → output `data/cadillac-lincoln-configurator-repass-2026-10.csv`. Same header, same 95 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

| make | model | trim (old) | model_year | field | old value | new value | source URL |
|---|---|---|---|---|---|---|---|
| Cadillac | Escalade | V | 2026 | trim | V | V-Series | https://www.cadillac.com/suvs/preceding-year/escalade |
| Cadillac | Escalade | V | 2027 | trim | V | V-Series | https://www.cadillac.com/suvs/escalade |
| Cadillac | Escalade ESV | V | 2026 | trim | V | V-Series | https://www.cadillac.com/suvs/preceding-year/escalade |
| Cadillac | Escalade ESV | V | 2027 | trim | V | V-Series | https://www.cadillac.com/suvs/escalade |

### What was checked

- **C3 – Escalade / Escalade ESV 2026 "Base": kept as Base.** Cadillac lists the entry version only as "ESCALADE" / "Escalade ESV" (FAQ: "Escalade 1SA", "Escalade ESV 1SA"), i.e. the model name with no trim name of its own. That is the same pattern as Porsche "Macan" and Maserati "GranTurismo", which the brief treats as correct Base. Source: https://www.cadillac.com/suvs/preceding-year/escalade
- **A – Escalade / Escalade ESV "V" → "V-Series" (2026 and 2027): applied.** Cadillac names the trim "V-Series".
- **A – not applied (convention):** the research found Cadillac writes "CT5-V", "CT5-V Blackwing", "LYRIQ-V", "LYRIQ-V Premium", "OPTIQ-V". These are the model name plus V; the dataset's rule stores the trim minus the model name, which gives the current "V", "V Blackwing", "V Premium". Left unchanged; say if you want the full forms.
- **Lincoln:** all trim names match lincoln.com.

## Unresolved

- Escalade / ESV "Base" vs "Escalade": kept Base (see above); confirm the convention.
- Escalade IQ / IQL hp = 750 (Cadillac's Velocity Max figure); the IQL page also lists 680 hp standard output. LYRIQ-V 615, OPTIQ-V 519, Vistiq 615 are also Velocity Max figures.
- Lincoln Corsair 2026 hp: lincoln.com's 2026 Corsair page redirects to the 2027 Corsair Hybrid; blank.
- Lincoln hp changes by year: Aviator 383 (2026) vs 400 (2027; 383 in Green States); Navigator 432 (2026) vs 440 (2027). Each row uses its own year.

## Counts

- Rows: 95 in, 95 out.
- Cells changed: 4 (trim 4, other 0); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 140 (137 with hp, 3 hp blank).
- Prices (section D): not touched in this batch.
