# mitsubishi-polestar-lucid configurator re-pass: notes (2026-10-16)

Input `data/mitsubishi-polestar-lucid-configurator-full-2026-10.csv` → output `data/mitsubishi-polestar-lucid-configurator-repass-2026-10.csv`. Same header, same 33 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

None. Every value checked was already correct or could not be confirmed (see below).

### What was checked

- **C5 – Polestar 4: unchanged.** polestar.com/us writes exactly "Rear motor" (272 hp) and "Dual motor" (544 hp); "Long range" doesn't appear on the US site.
- **A:** Mitsubishi and Lucid names match. Mitsubishi writes "RALLIART" in capitals where the file says "Ralliart"; not changed (flag if you want caps).

## Unresolved

- Mitsubishi Outlander Sport 2027 and Eclipse Cross 2026 hp not readable (spec tables load dynamically); Outlander PHEV displacement not stated (297 hp total confirmed). Blank.
- Eclipse Cross 2026 "SE Pano" and "SEL Touring" appear on mitsubishicars.com but aren't in the file.

## Counts

- Rows: 33 in, 33 out.
- Cells changed: 0 (trim 0, other 0); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 41 (25 with hp, 16 hp blank).
- Prices (section D): not touched in this batch.
