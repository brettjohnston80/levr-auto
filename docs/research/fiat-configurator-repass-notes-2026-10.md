# fiat configurator re-pass: notes (2026-10-16)

Input `data/fiat-configurator-full-2026-10.csv` → output `data/fiat-configurator-repass-2026-10.csv`. Same header, same 2 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

None. Every value checked was already correct or could not be confirmed (see below).

### What was checked

- **A:** fiatusa.com writes both "POP"/"Pop" and "ICONA"/"Icona"; the file's caps match one of the site's own spellings and the Build & Price data. No change.

## Unresolved

- Nothing.

## Counts

- Rows: 2 in, 2 out.
- Cells changed: 0 (trim 0, other 0); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 0 (0 with hp, 0 hp blank).
- Prices (section D): not touched in this batch.
