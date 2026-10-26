# vw-audi configurator: pass 3 notes (2026-10-16)

Input `data/vw-audi-configurator-prices-2026-10.csv` → output `data/vw-audi-configurator-pass3-2026-10.csv`. Same header, 18 fields per row, same cell format and line endings; every existing row kept in its original order.

Progress: Audi done | Volkswagen done

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
| Volkswagen | ID.4 | Pro | 2026 | 20-in. two-tone machined alloy wheels AWD | Standalone (blank price) | Unavailable | https://www.vw.com/en/builder.html/__app/id-4/pro.app |
| Audi | RS 6 Avant | Performance | 2026 | Sebring Black Crystal Effect | Standalone, blank price | Standalone, 1095 (Audi asks for an equipment change at $0 when it is chosen) | https://www.audiusa.com/en/models/a6/rs6-avant/2026/overview/build/ |
| Audi | RS e-tron GT | performance | 2026 | Ascari Blue Metallic | Standalone, blank price | Standalone, 595 (Audi switches the seats to "Fine Nappa, perforated leather seats with honeycomb stitching" at $0 when it is chosen) | https://www.audiusa.com/en/models/e-tron-gt/rs-e-tron-gt/2026/overview/build/ |
| Audi | RS e-tron GT | performance | 2026 | Progressive Red Metallic | Standalone, blank price | Standalone, 595 (Audi switches the seats to "Fine Nappa, perforated leather seats with honeycomb stitching" at $0 when it is chosen) | https://www.audiusa.com/en/models/e-tron-gt/rs-e-tron-gt/2026/overview/build/ |
| Audi | RS e-tron GT | performance | 2026 | option name | Nimbus Gray Metallic | Nimbus Gray Pearl Effect | https://www.audiusa.com/en/models/e-tron-gt/rs-e-tron-gt/2026/overview/build/ |
| Audi | RS e-tron GT | performance | 2026 | Bedford Green | Standalone, blank price | Standalone, 595 (Audi switches the seats to "Fine Nappa, perforated leather seats with honeycomb stitching" at $0 when it is chosen) | https://www.audiusa.com/en/models/e-tron-gt/rs-e-tron-gt/2026/overview/build/ |
| Audi | RS e-tron GT | performance | 2026 | option name | Bedford Green | Bedford Green Metallic | https://www.audiusa.com/en/models/e-tron-gt/rs-e-tron-gt/2026/overview/build/ |

## Unresolved

- E2 detail: on audiusa.com, choosing Ascari Blue, Progressive Red or Bedford Green on the 2026 RS e-tron GT also switches the seats to "Fine Nappa, perforated leather seats with honeycomb stitching" at $0; choosing Sebring Black on the 2026 RS 6 Avant asks for an equipment change at $0. Prices recorded as shown; availability stays Standalone.
- E3: Audi USA shows the names in sentence case ("Nimbus Gray pearl effect", "Bedford Green metallic"). Written in the file's Title Case style, matching the 2027 RS e-tron GT row ("Nimbus Gray Pearl Effect", "Bedford Green Metallic").

## Counts

| make | re-tagged | $0 → Standard | $0 kept (published $0) | $0 → blank | rows added | rows split | other changes | unresolved |
|---|---|---|---|---|---|---|---|---|
| Audi | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 |
| Volkswagen | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |

Rows in: 90. Rows out: 90. Same count: no rows added or split.

Checks before saving: same header; every row has 18 fields; every option cell is "Name | Availability | Price | Package"; every existing row present in its original order; the app parser (`src/lib/configurator-parse.ts`) drops 0 items.
