# lexus-acura configurator re-pass: notes (2026-10-16)

Input `data/lexus-acura-configurator-full-2026-10.csv` → output `data/lexus-acura-configurator-repass-2026-10.csv`. Same header, same 113 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

| make | model | trim (old) | model_year | field | old value | new value | source URL |
|---|---|---|---|---|---|---|---|
| Acura | Integra | A-Spec with Technology | 2026 | trim | A-Spec with Technology | A-Spec with Technology Package | https://acuranews.com/en-US/releases/release-cf005034e20eb27505fd8e6bbb0168d7-2026-acura-integra-pricing-epa-ratings-2026 |
| Acura | ADX | A-Spec with Advance | 2026 | trim | A-Spec with Advance | A-Spec with Advance Package | https://acuranews.com/en-US/releases/release-c6bc9770aed09765fad31482f401ef92-2026-acura-adx-pricing-epa-ratings |

### What was checked

- **A – Acura:** Integra 2026 "A-Spec with Technology" → "A-Spec with Technology Package"; ADX 2026 "A-Spec with Advance" → "A-Spec with Advance Package" (Acura pricing releases). RDX / MDX short forms ("Technology", "Advance", "A-Spec Advance") left: Acura's own wording varies between those two models.
- **A – Lexus:** all names match pressroom.lexus.com.
- **B:** "Base" is right for Integra, ADX, RDX, MDX (Acura names the entry model just "Integra" etc.).
- **C6 – TZ seating: unchanged (6-passenger).** No US Lexus page states a passenger count (only second-row captain's chairs and a third row); the TZ spec PDF returns Access Denied. Lexus UK official media calls it a "six-seat SUV", which agrees with the file, but it isn't a US source.

## Unresolved

- Lexus TZ hp: not on any reachable US Lexus page; the spec PDF returns Access Denied. Third-party reports say 308 hp (402 with Luxury Performance Upgrade). Blank in the engine-facts table.
- Lexus TZ seating count not stated by Lexus US (see C6).
- Acura RDX / MDX package-style trim names ("Technology" vs "with Technology Package"): convention call.

## Counts

- Rows: 113 in, 113 out.
- Cells changed: 2 (trim 2, other 0); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 3 (0 with hp, 3 hp blank).
- Prices (section D): not touched in this batch.
