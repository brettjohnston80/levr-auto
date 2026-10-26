# dodge-chrysler-alfa configurator: pass 3 notes (2026-10-16)

Input `data/dodge-chrysler-alfa-configurator-prices-2026-10.csv` → output `data/dodge-chrysler-alfa-configurator-pass3-2026-10.csv`. Same header, 18 fields per row, same cell format and line endings; every existing row kept in its original order.

Progress: Dodge done | Chrysler done | Alfa Romeo done

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
| Dodge | Durango | GT | 2026 | GT (3.6L V6, RWD or AWD); GT HEMI (5.7L HEMI V8, AWD) | https://www.dodge.com/hostd/api/cvd/CUD202611/CUD202611_CVD.json |

## Other changes

| make | model | trim | model_year | field / option | old | new | source URL |
|---|---|---|---|---|---|---|---|
| (none) | | | | | | | |

## Unresolved

- C1, 2027 Charger Daytona plain "Scat Pack": not added. Stellantis' media release of December 18, 2025 (https://media.stellantisnorthamerica.com/newsrelease.do?id=27331) gives a starting price of $72,495 (four-door +$500), but Dodge's current 2027 Build & Price (https://www.dodge.com/hostd/api/cvd/CUD202714/CUD202714_CVD.json) offers only the Daytona Scat Pack Plus, so there are no trim options to source. Held until Dodge's configurator lists it.
- D1 also confirmed: Dodge's 2027 Durango data lists HEMI and SRT versions only, so there is no 2027 V6 GT row to make. Source: Dodge 2027 Durango Build & Price data.
- Not asked, flagged: the 2026 Durango "GT Plus" row also mixes the 3.6L V6 version ($45,595) and the 5.7L HEMI V8 version (+$1,680). Not split in this pass.
- Durango GT split: Dodge's configurator shows prices before the $1,995 destination charge, as in the input. The Trailer-Tow Group IV price on the V6 row is the RWD price ($1,195); it is $1,295 on AWD (noted in the row).

## Counts

| make | re-tagged | $0 → Standard | $0 kept (published $0) | $0 → blank | rows added | rows split | other changes | unresolved |
|---|---|---|---|---|---|---|---|---|
| Dodge | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| Chrysler | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Alfa Romeo | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Rows in: 41. Rows out: 42. Difference: 1 row (2026 Durango GT) split into 2.

Checks before saving: same header; every row has 18 fields; every option cell is "Name | Availability | Price | Package"; every existing row present in its original order; the app parser (`src/lib/configurator-parse.ts`) drops 0 items.
