# mercedes configurator: pass 3 notes (2026-10-16)

Input `data/mercedes-configurator-prices-2026-10.csv` → output `data/mercedes-configurator-pass3-2026-10.csv`. Same header, 18 fields per row, same cell format and line endings; every existing row kept in its original order.

Progress: Mercedes-Benz done

## Re-tagged

| make | model | trim | model_year | option | old availability | new availability | package / option it comes with | source URL |
|---|---|---|---|---|---|---|---|---|
| (none) | | | | | | | | |

## $0 items

| make | model | trim | model_year | option | outcome | source URL | why |
|---|---|---|---|---|---|---|---|
| (none) | | | | | | | |

## Rows added

| make | model | trim | model_year | body_style | why | source URL |
|---|---|---|---|---|---|---|
| (none) | | | | | | |

## Rows split

| make | model | old trim | model_year | new trims | source URL |
|---|---|---|---|---|---|
| Mercedes-Benz | EQE SUV | EQE 320 | 2027 | EQE 320+ (RWD); EQE 320 4MATIC (AWD) | https://www.mbusa.com/en/vehicles/build/eqe/suv/eqe320x ; https://www.mbusa.com/en/vehicles/build/eqe/suv/eqe320x4 |

## Other changes

| make | model | trim | model_year | field / option | old | new | source URL |
|---|---|---|---|---|---|---|---|
| (none) | | | | | | | |

## Unresolved

- D2: the 4MATIC configurator also lists a Class II trailer hitch ($600) and a DRIVE PILOT line that the RWD version doesn't. Neither is one of this file's option items, so nothing was added; mentioned in the 4MATIC row's confidence_notes.

## Counts

| make | re-tagged | $0 → Standard | $0 kept (published $0) | $0 → blank | rows added | rows split | other changes | unresolved |
|---|---|---|---|---|---|---|---|---|
| Mercedes-Benz | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |

Rows in: 61. Rows out: 62. Difference: 1 row (2027 EQE SUV EQE 320) split into 2.

Checks before saving: same header; every row has 18 fields; every option cell is "Name | Availability | Price | Package"; every existing row present in its original order; the app parser (`src/lib/configurator-parse.ts`) drops 0 items.
