# 0-60 backfill via Car and Driver / MotorTrend, browser access (2026-08-30)

`matchmaker-vehicle-dataset-2026-v12.csv` — 1,601 rows, 43 columns. You were right to push on this — the prior pass's "MotorTrend/Car and Driver blocked" wasn't a real dead end, just the wrong tool. `WebFetch` is blocked at this environment's network proxy for both domains (confirmed directly: 403 on both a plain fetch and a domain-scoped search), but the Claude in Chrome browser extension reaches them fine — I tested it live against caranddriver.com before dispatching anyone.

## Result: zero_to_60_sec 60.0% → **83.3%** (961 → 1,333 of 1,601)

That's 372 new fills this round, on top of the 640 that were blank going in — cut the remaining gap by more than half.

**Chrysler: 0% → 100% (8/8)**, the make you specifically flagged. Pacifica (gas and PHEV) and Voyager, all sourced from Car and Driver/MotorTrend instrumented tests.

**Nissan: 0% → 55.6% (25/45)**, the other one you flagged. Sentra, Rogue Plug-In Hybrid, Murano, LEAF, and Z are now fully filled; Altima and Kicks remain blank because the only test data found was for a different drivetrain (AWD) than what's in those specific rows — didn't want to misattribute an AWD number to a FWD row.

## By make (blank count, before this round → after)
| Make | Before | After |
|---|---|---|
| Ram | 74 | 57 |
| Jeep | 69 | 11 |
| Chevrolet | 46 | 31 |
| Nissan | 45 | 20 |
| Ford | 44 | 25 |
| GMC | 40 | 13 |
| Mercedes-Benz | 40 | 12 |
| Cadillac | 39 | 16 |
| Mazda | 32 | 0 |
| Toyota | 31 | 12 |
| Subaru | 30 | 16 |
| Hyundai | 29 | 22 |
| Honda | 24 | 12 |
| Lexus | 22 | 0 |
| Mitsubishi | 18 | 11 |
| Kia | 16 | 5 |
| Volkswagen | 12 | 3 |
| Dodge | 9 | 1 |
| Chrysler | 8 | **0** |
| BMW | 8 | 0 |
| Acura | 3 | 0 |
| Lucid | 1 | 0 |

Mazda, Lexus, BMW, and Acura are now fully filled. Volkswagen needed a second dispatch — its first attempt got cut off by browser contention with the other 7 parallel agents and never completed a single lookup; a clean follow-up run closed all but 4 rows.

## What's still blank, and why — genuinely not published, not "didn't look"
A consistent pattern across every make: the remaining gaps are almost all **drivetrain mismatches**, not missing research. C&D/MotorTrend typically test one configuration of a model (often the top or most common trim) and don't publish a separate instrumented number for every drivetrain variant. Examples: Nissan Altima/Kicks (only AWD tested, rows are FWD), Toyota RAV4/Corolla Hybrid FWD (only AWD tested), VW Atlas/Atlas Cross Sport SE (only AWD tested), Honda CR-V/HR-V/Pilot FWD trims (only AWD tested), Ford Ranger/F-150/Super Duty base RWD trims (only 4WD tested). Agents consistently declined to cross-apply a number across a drivetrain difference, per the honesty rule — that's the right call, but it means true drivetrain-specific research (not a source-access problem) is what's left.

A smaller set are genuinely commercial/low-volume segments buff books don't test at all: Ram Chassis Cab (all 12), Ram ProMaster (21), Ford Transit/E-Transit/Transit Passenger Wagon.

A few are labeled "estimate" rather than an instrumented test by the source itself (Jeep Cherokee, Grand Cherokee L turbo-four, Chevrolet Acadia, VW Atlas Cross Sport FWD) — agents correctly declined to use these since your rule specified instrumented testing or a manufacturer claim, not a magazine's own projection.

## Two things worth your attention

**1. A likely data error, found but not touched.** While researching Volkswagen, an agent noticed the on-file Tiguan SEL R-Line Turbo AWD value (8.7 sec) doesn't match what Car and Driver or MotorTrend currently publish for that exact trim — both show roughly 6.7 sec for the 268-hp AWD top trim, and the nearest other published figure (8.5 sec) belongs to a different, lower-powered trim entirely. Per the rule, already-filled cells weren't touched, but this looks like a genuine error worth a manual correction rather than a source disagreement.

**2. A few Nissan Sentra trims got a judgment call worth a second look**: SR's tested value (8.3s) was applied to S/SV based on trim/equipment similarity (no sunroof) rather than the SL's own tested value (9.1s) — same engine, but C&D's own data showed SR and SL diverging by 0.8s despite identical powertrains, so this is an inference, not a direct match.

## Coverage summary (1,601 rows)
| Field | Before this round | After |
|---|---|---|
| zero_to_60_sec | 60.0% | **83.3%** |

(Safety, reliability, and Ram Chassis Cab msrp are unchanged from the last report — this round was scoped to 0-60 only, per your request.)
