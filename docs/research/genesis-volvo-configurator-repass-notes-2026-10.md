# genesis-volvo configurator re-pass: notes (2026-10-16)

Input `data/genesis-volvo-configurator-full-2026-10.csv` → output `data/genesis-volvo-configurator-repass-2026-10.csv`. Same header, same 89 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

| make | model | trim (old) | model_year | field | old value | new value | source URL |
|---|---|---|---|---|---|---|---|
| Volvo | XC40 | Ultra Black Edition | 2026 | trim | Ultra Black Edition | Black Edition | https://www.volvocars.com/us/cars/xc40/ |
| Volvo | EX40 | Ultra Black Edition | 2026 | trim | Ultra Black Edition | Black Edition | https://www.volvocars.com/us/cars/ex40-electric/ |
| Volvo | XC60 | T8 Ultra Black Edition | 2027 | trim | T8 Ultra Black Edition | T8 Black Edition | https://www.volvocars.com/us/cars/xc60-hybrid/ |

### What was checked

- **A – Volvo:** "Black Edition" is its own trim, not an Ultra variant: XC40 2026 and EX40 2026 "Ultra Black Edition" → "Black Edition"; XC60 2027 "T8 Ultra Black Edition" → "T8 Black Edition".
- **A – Genesis:** names match genesisnewsusa.com. **B:** "Base" is right for GV60 ("GV60 RWD") and Electrified GV70.

## Unresolved

- Volvo B4/B5/B6/T8 displacement not stated on the volvocars.com/us pages reached (media.volvocars.com blocks fetching); displacement blank, hp filled.
- Volvo EX40 is "no longer available as a new vehicle in the US" per volvocars.com/us; EX40 Plus 2026 unconfirmed. EX30 2027 page not seen; V60 Cross Country Ultra unconfirmed. "T8 Core/Plus/Ultra" is a file convention (Volvo writes "XC90 Core" on the PHEV page).
- Genesis 2026 GV70 "3.5T Sport Advanced" / "2.5T Sport Prestige" exact names not confirmed (spec sheet columns read differently; pricing release page returned no text).

## Counts

- Rows: 89 in, 89 out.
- Cells changed: 3 (trim 3, other 0); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 29 (29 with hp, 0 hp blank).
- Prices (section D): not touched in this batch.
