# lexus-acura configurator: prices notes (2026-10-16)

Input `data/lexus-acura-configurator-repass-2026-10.csv` → output `data/lexus-acura-configurator-prices-2026-10.csv`. Same header, same 113 rows in the same order, 18 fields per row, same cell format and line endings. Only option prices (and, for Porsche, one added Paint to Sample option per row) changed; every changed row has its source added to `sources` if it wasn't already there.

Progress: Lexus done | Acura done

Confirm-only file: checked for blank Standalone / Package-only prices.

## Prices filled

None.

## Options added

None.

## Still blank

| make | model | trim | model_year | option | reason |
|---|---|---|---|---|---|
| Lexus | GX | Premium | 2026 | Heated steering wheel | package-priced (comes in "Cold Area Package", priced in package_definitions) |
| Lexus | LX | 600 Premium | 2026 | Semi-aniline leather-trimmed seating for seven | package-priced (comes in "Interior Upgrade Package", priced in package_definitions) |
| Lexus | LX | 600 Premium | 2027 | Semi-aniline leather-trimmed seating for seven | package-priced (comes in "Interior Upgrade Package", priced in package_definitions) |
| Lexus | NX | 350 | 2026 | Heated steering wheel | package-priced (comes in "Cold Area Package", priced in package_definitions) |
| Lexus | NX | 350 Premium | 2026 | Heated steering wheel | package-priced (comes in "Cold Area Package", priced in package_definitions) |
| Lexus | NX | 350 Luxury | 2026 | Heated steering wheel | package-priced (comes in "Cold Area Package", priced in package_definitions) |
| Lexus | NX | 350 F SPORT Handling | 2026 | Power liftgate/trunk | package-priced (comes in "F SPORT Handling Luxury Package", priced in package_definitions) |
| Lexus | NX | 350h | 2026 | Heated steering wheel | package-priced (comes in "Cold Area Package", priced in package_definitions) |
| Lexus | NX | 350h Premium | 2026 | Heated steering wheel | package-priced (comes in "Cold Area Package", priced in package_definitions) |
| Lexus | NX | 350h Luxury | 2026 | Heated steering wheel | package-priced (comes in "Cold Area Package", priced in package_definitions) |
| Lexus | RX | 350 | 2026 | Heated steering wheel | package-priced (comes in "Cold Area Package", priced in package_definitions) |
| Lexus | RX | 350 F SPORT Handling | 2026 | 21-in 5-spoke alloy wheels with Black finish | package-priced (comes in "Appearance Package", priced in package_definitions) |
| Lexus | RX | 350h | 2026 | Heated steering wheel | package-priced (comes in "Cold Area Package", priced in package_definitions) |
| Lexus | RX | 500h F SPORT Performance | 2026 | 21-in 5-spoke alloy wheels with Black finish | package-priced (comes in "Appearance Package", priced in package_definitions) |
| Lexus | UX | 300h Premium | 2026 | Heated steering wheel | package-priced (comes in "Cold Area Package", priced in package_definitions) |
| Lexus | UX | 300h F SPORT Design | 2026 | F SPORT 18-inch split-five-spoke alloy wheels with Black Metallic and machined finish and run-flat tires | package-priced (comes in "Special Appearance Package", priced in package_definitions) |
| Lexus | UX | 300h F SPORT Design | 2026 | Heated steering wheel | package-priced (comes in "Cold Area Package", priced in package_definitions) |
| Lexus | UX | 300h F SPORT Handling | 2026 | F SPORT 18-inch split-five-spoke alloy wheels with Black Metallic and machined finish and run-flat tires | package-priced (comes in "Special Appearance Package", priced in package_definitions) |

## Unresolved

- Nothing.

## Counts

| make | blank prices in | filled | package-priced | still blank | options added |
|---|---|---|---|---|---|
| Lexus | 18 | 0 | 18 | 0 | 0 |
| Acura | 0 | 0 | 0 | 0 | 0 |

Rows in = rows out: 113 = 113.
