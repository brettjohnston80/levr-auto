# bmw-mini configurator re-pass: notes (2026-10-16)

Input `data/bmw-mini-configurator-full-2026-10.csv` → output `data/bmw-mini-configurator-repass-2026-10.csv`. Same header, same 72 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

None. Every value checked was already correct or could not be confirmed (see below).

### What was checked

- **A:** all BMW and MINI names match bmwusa.com / MINI USA. i5 "eDrive40 / xDrive40" kept as one row (BMW sells them separately at 335 / 389 hp).
- **B:** "Base" is right for M2, M3, M4, M5, M5 Touring (bmwusa.com: "M3 Sedan", "M4 Coupe" etc.; only Competition versions carry a name).

## Unresolved

- Possibly missing rows (not changed): X5 40 (RWD), X5 50e xDrive, 750e xDrive (from 11/2026), MINI Oxford Edition.
- X3 M50 xDrive: bmwusa lists 393 hp; its footnote adds to 392. 393 used.
- MINI Countryman SE ALL4 is all-electric (308 hp) although its engine text says "turbocharged engine" (engine text not changed, per the brief). MINI Cooper 161 hp is from the MINI USA configurator text only.

## Counts

- Rows: 72 in, 72 out.
- Cells changed: 0 (trim 0, other 0); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 89 (89 with hp, 0 hp blank).
- Prices (section D): not touched in this batch.
