# bmw-mini configurator: pass 3 notes (2026-10-16)

Input `data/bmw-mini-configurator-prices-2026-10.csv` → output `data/bmw-mini-configurator-pass3-2026-10.csv`. Same header, 18 fields per row, same cell format and line endings; every existing row kept in its original order. No changes: the output is an identical copy of the input.

Progress: BMW done | MINI done

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
| (none) | | | | | |

## Other changes

| make | model | trim | model_year | field / option | old | new | source URL |
|---|---|---|---|---|---|---|---|
| (none) | | | | | | | |

## Unresolved

- C2: BMW USA's current model list (https://configure.bmwusa.com/UBYOConfigurator/v4/BM/modellist) has only the X5 "40 xDrive" (no sDrive 40 and no 50e) and, for the 7 Series, 740, 740 xDrive, i7 50 and i7 60 (no 750e xDrive). None of the three rows could be confirmed from an official US source with their own options, so none was added.

## Counts

| make | re-tagged | $0 → Standard | $0 kept (published $0) | $0 → blank | rows added | rows split | other changes | unresolved |
|---|---|---|---|---|---|---|---|---|
| BMW | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MINI | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Rows in: 72. Rows out: 72. Same count: no rows added (C2 not confirmed).

Checks before saving: same header; every row has 18 fields; every option cell is "Name | Availability | Price | Package"; every existing row present in its original order; the app parser (`src/lib/configurator-parse.ts`) drops 0 items.
