# gmc-buick configurator re-pass: notes (2026-10-16)

Input `data/gmc-buick-configurator-full-2026-10.csv` → output `data/gmc-buick-configurator-repass-2026-10.csv`. Same header, same 81 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

None. Every value checked was already correct or could not be confirmed (see below).

### What was checked

- **A:** every GMC and Buick trim name matches gmc.com / buick.com. No changes.

## Unresolved

- Engine facts: no MY2026/27 official hp found for Sierra 1500 3.0L Duramax, 5.3L and 6.2L V8 (2026); Yukon / Yukon XL 5.3L and 6.2L (both years) and 2026 Duramax; Sierra HD 6.6L gas; Terrain 2026; Sierra EV 2026 AT4 and Denali. gmc.com's engines page labelled MY2025 gives 305 / 355 / 420 / 401 / 175 hp. The 2026 Sierra 1500 5.3L (355) and 6.2L (420) could be inferred from per-cab maximums on the 2026 page, but no page states them per engine, so they are blank.
- Buick Encore GX, Envista, Enclave hp: buick.com spec pages didn't load; blank.
- news.gm.com could not be fetched this pass.

## Counts

- Rows: 81 in, 81 out.
- Cells changed: 0 (trim 0, other 0); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 298 (134 with hp, 164 hp blank).
- Prices (section D): not touched in this batch.
