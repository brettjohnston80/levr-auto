# porsche-landrover configurator re-pass: notes (2026-10-16)

Input `data/porsche-landrover-configurator-full-2026-10.csv` → output `data/porsche-landrover-configurator-repass-2026-10.csv`. Same header, same 113 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

None. Every value checked was already correct or could not be confirmed (see below).

### What was checked

- **A:** all Porsche and Land Rover names match. "911 GT3 S/C" is correct (Porsche newsroom and configurator).
- **B:** "Base" is right for Macan, Macan Electric, Cayenne, Cayenne Coupe, Cayenne Electric, Cayenne Coupe Electric, Taycan, Panamera (Porsche US lists them with no suffix).

## Unresolved

- Land Rover hp mostly comes from the US configurator engine text (configurator pages block automated re-reads); rangerover.com confirms 395 / 523 / 606 hp for Range Rover engines, 395 for Velar 3.0.
- Range Rover SE / Autobiography SWB PHEV: 542 hp converted from 550 PS; rangerover.com's PHEV block shows "606 HP", apparently the SV V8 figure.
- Discovery "360hp" looks like a PS figure (would be 355 hp); Range Rover Sport Battersea Edition PHEV "544HP" vs 542 elsewhere. Kept as Land Rover wrote them.
- Range Rover Electric: "up to 542hp" from JLR's US release used for all trims; per-trim output not stated.
- Porsche electric hp are Porsche US "up to" (overboost) figures; Taycan and Taycan 4 both listed at 402 hp.

## Counts

- Rows: 113 in, 113 out.
- Cells changed: 0 (trim 0, other 0); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 114 (114 with hp, 0 hp blank).
- Prices (section D): not touched in this batch.
