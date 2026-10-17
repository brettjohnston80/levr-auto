# Matchmaker v21: score changes vs the live v20 (2026-10-16)

`data/matchmaker-vehicle-dataset-2026-v21-scored.csv`, scored with `data/matchmaker_scoring_pipeline.py`.

- **The pipeline was checked first.** It reproduces the live `v20-scored` byte for byte, after one fix: three body-style strings ("compact / mid-size / full-size luxury SUV") were missing from its map, which had dropped 11 Lincoln 2027 rows.
- **Imported unpromoted:** batch `a421adb5-b82d-4857-a29b-74cd9219a741`, 2,276 vehicles, verified from the database. The live batch is still v20 (`c94ee1ab…`, 2,269).
- **Promotion and the `/matchmaker` redeploy wait for Brett's go.**

## Rows: 2,269 → 2,276

- **Removed (9, held):**
  - Volvo EX40 2026 (3);
  - Cadillac Vistiq 2026 (4: Luxury, Sport, Premium Luxury, Platinum);
  - Dodge Charger Daytona Scat Pack 2027 (2: Coupe, Sedan).
- **Added (16, Wave 3):**
  - BMW XM Label 2027;
  - Fiat 500e POP and ICONA 2026;
  - Lexus TZ 450e Premium, Premium Touring and Luxury 2027;
  - Maserati GranTurismo, GranCabrio and Grecale (10 rows; MCPURA, MCPURA Cielo and GT2 Stradale held).
- **Renamed:** 32 rows' make "Mini" → "MINI". Their scores are unchanged.

## Price fixes → Price Value score (20 rows; no other score moves)

| Rows | MSRP change | Price Value |
|---|---|---|
| Charger 2027 gas coupes (R/T Plus, Scat Pack, Scat Pack Plus) | to Dodge's 2027 prices (+$850 to +$1,295) | −0.17 to −0.27 |
| Charger 2027 gas sedans (R/T, R/T Plus, Scat Pack, Scat Pack Plus) | +$2,000 four-door premium (and the coupe changes) | −0.44 to −0.73 |
| Charger Daytona Scat Pack Plus 2027 sedan | +$500 | −0.11 |
| Durango 2026, all 12 rows | −$1,995 (destination removed) | +0.41 each |

## Other rows: class-relative effects of the new rows

Scores are relative within a body-style class, so a new row that extends a class's range moves other cars' scores. Nothing else changed.

| Score | Rows | Change | Cause |
|---|---|---|---|
| Comfort, Hatchback | 73 | +0.33 to +14.46 | Fiat 500e rear legroom 29.4 in. is the new class low (was 29.9). Mazda3 rows move most (50.9 → 65.4). |
| Fuel Economy, SUV (plug-in hybrids) | 21 | +2.1 to +6.8 | BMW XM (14 mpg, 300 mi) widens the plug-in hybrid range; X5 xDrive50e and XC90 T8 rise. |
| Fuel Economy, Hatchback (electric) | 8 | up to +14.3 | Fiat 500e's 141-mile range is the new electric-hatchback low; Chevrolet Bolt and Volvo EX30 rise. |
| Resale Value, Convertible | 33 | +0.54 to +6.69 | Maserati GranCabrio Folgore's 58.9% depreciation is the new worst (was 53.2%); BMW 4 Series Convertible rises most. |
| Towing & Payload, SUV | 84 | +0.01 to +0.31 | New SUV rows; negligible. |

## New rows' scores, for the record

- **Maserati:** many 50s ("no data", the floor) in Safety, Comfort, Fuel Economy and Reliability, because the research has no NHTSA, legroom, EPA or reliability figures for them.
- **Lexus TZ:** 50 for Safety, Comfort and Performance, for the same reason.
- **Fiat 500e:** 50 for Safety and Comfort. Its Price Value (76–79) and Technology (87.5) are high.
