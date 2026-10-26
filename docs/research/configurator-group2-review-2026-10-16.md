# Configurator promotion group 2 review: Genesis, Audi, Volvo, Porsche, Land Rover (2026-10-16)

**Nothing is promoted.** Promotion waits for Brett's go for the group. The MarketCheck name fixes this group uses (Audi RS model names, Genesis and Volvo trim rules) are already live on `main` (`23e2f0e`).

## 1. Batches (unpromoted, verified from database rows)

All imported with the mapping step, the engine-facts files, `data/held-models.json`, `blankPriceUnknown` and one make per batch. Trim and option counts equal the import responses. 0 package references were dropped and 0 values forced unavailable.

| Make | Batch | Source file | Trims | Options | "Price not confirmed" (standalone / package) | "Not confirmed" availability |
|---|---|---|---|---|---|---|
| Genesis | `94e076b9-fc3f-4b93-ae06-229102bd8840` | genesis-volvo prices | 62 | 1,496 | 0 / 0 | 0 |
| Audi | `93732f5e-92e5-4143-ad93-e0633903e211` | vw-audi pass 3 | 59 | 1,500 | 0 / 0 | 0 |
| Volvo | `ddb169b4-5dc9-4bd9-be7b-2637a81c17c7` | genesis-volvo prices | 25 | 683 | 0 / 0 | 63 |
| Porsche | `fab4f627-8a1b-450e-93af-fb3b504592ea` | porsche-landrover prices | 61 | 3,580 | 0 / 0 | 0 |
| Land Rover | `c0542355-381d-4009-b3f9-616e97ed6681` | porsche-landrover prices | 52 | 1,749 | 36 / 0 | 0 |

Notes:
- **Land Rover:** its 36 are the White contrast and Bespoke roofs, kept as "Price not confirmed" by Brett's decision.
- **Volvo:** its 63 "Not confirmed" are the availabilities the research left blank on purpose.

## 2. Held rows, corrections, items left unchanged

- **Held:** Volvo EX40 (2 rows: Plus, Black Edition, 2026), no longer sold new in the US.
- **Corrections (3, all applied):** Audi RS 6 Avant 2026, RS 7 2026, RS Q8 2027: "Performance" → "performance" (Audi USA's styling).
- **Left unchanged:**
  - **Genesis and Land Rover:** 0.
  - **Audi (32):**
    - 28 engine lines with no published horsepower; they show without hp. E.g. A3 "2.0L turbo I4 40 TFSI 7-speed S tronic quattro AWD"; A6 Sportback e-tron "Single-motor electric RWD".
    - 4 lines that aren't engines.
  - **Volvo (23):** lines in Volvo's own form, read fine as received ("B5 AWD Gas (mild hybrid), 247 hp"). Volvo publishes no engine sizes.
  - **Porsche (23):** named options that sit in the drivetrain list and show as they are: "Performance Battery Plus" (Taycan, Macan), "MT Package (6-speed Sport Manual Transmission)" (911).

## 3. Screenshots (`~/Downloads/levr-configurator-review-2026-10-16/group-2/`)

- **Per make, 3 trims:** Highlights and All details, one model's trim comparison with every section open, and a phone Highlights. This is from the temporary local-only preview, so "0 available nationwide" there is the preview.
- **`finalize-flow/`:** Porsche Macan 2026 through the real /finalize flow on my local server, read as live locally only:
  - trim step, Compare trims, Details;
  - colour (Paint to Sample $13,620 shown), interior, seating and features;
  - Review.
  - Synced for it: 3 MarketCheck calls. The disposable account was deleted (0 searches, customers or auth users left).

## 4. MarketCheck names and real matching

**Model names, live since `23e2f0e`:** Audi RS3 = "RS 3", RS6 Avant = "RS 6 Avant", RS7 = "RS 7", RS e-tron GT = "RS e-tron GT Performance". Genesis GV70 and Electrified GV70 are told apart by powertrain.

**Not mapped, so no inventory reaches these:**
- Audi A6 allroad and Q4 Sportback e-tron (MarketCheck has no such models today);
- Volvo EX30 Cross Country (only the body type would separate it from the EX30).

**Trim names (estimated from MarketCheck's names; before → after the rules):**

| Make | Before | After | Why |
|---|---|---|---|
| Genesis | 9 / 62 | 36 / 62 | MarketCheck drops the engine ("Prestige" for "2.5T Prestige"; "E-SC" for E-Supercharger) |
| Volvo | 18 / 25 | 19 / 25 | |
| Audi | 49 / 59 | 49 / 59 | |
| Porsche | 30 / 61 | 30 / 61 | |
| Land Rover | 16 / 52 | 16 / 52 | |

Land Rover's other trims are left unmatched on purpose. MarketCheck doesn't say SWB / LWB, or 90 / 110 / 130 on the Defender, so a listing can't pick one row; those shoppers get the general flow.

**Real synced listings, Porsche Macan (148):** 61% match a configurator trim.
- **Matched:** the gas Base, S and T (2026) and the 2027 Electric Base and GTS.
- **The rest are refused or have no trim:**
  - The research has the **Macan Electric for 2027 only**, while dealers list 2026 Electric Macans, so those find only the gas row and are refused.
  - "Turbo Electric" and a 2027 "S" have no research row.

## 5. Decisions for Brett

1. **Promote group 2** (Genesis, Audi, Volvo, Porsche, Land Rover), one make at a time, each checked on www.levrauto.com.
2. **Next Cowork pass:** add the 2026 Porsche Macan Electric (Base, 4, 4S, GTS, Turbo), so 2026 electric Macan listings can match.
3. **Audi's 28 engine lines without horsepower** show as they are (the same as the VW Atlas and Lexus TZ you approved). OK?
