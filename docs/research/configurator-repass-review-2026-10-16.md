# Configurator re-pass review: Wave 2 + Wave 3, batch 1 (2026-10-16)

Read-only review of Cowork's first run of the combined re-pass (`cowork-repass-prompt-2026-10-15.md`). Nothing was imported and no MarketCheck call was made. The re-pass files are committed as received.

**Cowork ran sections A, B, C, E and F. Section D (missing prices) and the Porsche Paint to Sample check were not run.** They are now a separate prompt: `cowork-prices-prompt-2026-10-16.md`.

## 1. Files

All 27 expected outputs are present:
- 12 × `data/*-configurator-repass-2026-10.csv`;
- 12 × `docs/research/*-configurator-repass-notes-2026-10.md`;
- `data/matchmaker-additions-wave3-repass-2026-10.csv`;
- `data/configurator-engine-facts-2026-10.csv`;
- `docs/research/configurator-repass-summary-2026-10.md`.

## 2. Integrity (checked cell by cell against every input)

- Every re-pass file has the same header, the same row count and order, 18 fields on every row, and every option item in `Name | Availability | Price | Package` form.
- **Nothing changed outside the brief.** The changes are:
  - 25 trim renames;
  - the one allowed drivetrain (AMG GT 43 → RWD);
  - their source URLs.
- Six files are byte-identical to their inputs: GMC/Buick, BMW/MINI, Porsche/Land Rover, Mitsubishi/Polestar/Lucid, Maserati and FIAT.
- Every change in the notes has a source URL.

## 3. What changed

| Make | Change |
|---|---|
| Volkswagen | Atlas Cross Sport 2026 "SE w/Technology" → "SE with Technology" |
| Cadillac | Escalade / ESV "V" → "V-Series" (2026, 2027). **Reverted by a known correction** (section 7) |
| Mercedes-Benz | "Hybrid" / "E Performance" → "HYBRID" / "E PERFORMANCE" (5 trims); "G 580 with EQ Technology" → "G 580 Electric"; "AMG GT 55 4MATIC+" → "AMG GT 55"; **C4:** AMG GT 43 drivetrain → RWD |
| Acura | "A-Spec with Technology Package", "A-Spec with Advance Package" |
| Volvo | "Ultra Black Edition" → "Black Edition" (XC40, EX40, XC60 T8) |
| Dodge | Durango "GT …" → "GT HEMI …" (2026 Premium, 2027 GT / Plus / Premium); "America250" → "A250 edition" |

**Site checks:**
- **B:** every "Base" is correct (Audi A3 family, Escalade/ESV, Porsche, BMW M, Acura, Alfa Romeo, Genesis, Maserati).
- **C1:** "Black optic plus" and "S line plus" are real trims.
- **C2:** the A8 and S8 have no grade name.
- **C3:** keep `Base`; Cadillac calls the entry version just "Escalade".
- **C4:** RWD.
- **C5:** the Polestar names are correct.
- **C6:** Lexus TZ seating stays 6 (Lexus US doesn't state it; Lexus UK says six-seat).
- **C7:** Grecale Folgore "automatic" matches Maserati's data.
- **C8:** see section 4.
- **C9:** MCPURA, MCPURA Cielo and GT2 Stradale are still unpriced.

**Prices filled: 0. Options added: 0** (section D not run).

## 4. Matchmaker file

- **F1:** BMW XM `range_mi` 30 → 300. That's the EPA total range from the **2026** BMW XM Label EPA entry (fueleconomy.gov id 49761); no 2027 entry exists yet. **Brett approved using it for the 2027 row (2026-10-16), source year noted here.**
- **F2:** the Maserati resale figures are confirmed as model-specific (iSeeCars), and the brand figure (CarEdge 75.3%) is kept for MCPURA and GT2 Stradale.
- **F3:** no change needed.
- **F4:** the six Charger Daytona rows are unchanged; they're dropped in `v21`.
- **2027 Charger Daytona (C8):**
  - the Scat Pack Plus is **670 hp**;
  - a **plain 2027 Scat Pack exists** at $72,495 coupe / $72,995 sedan;
  - so the 2027 sedan premium is **+$500** (2026: +$2,000).

## 5. Engine facts table

- 847 rows: hp filled 611 (236 blank), displacement 630, cylinders 632, source URL 792.
- Every row matches a real engine option in the re-pass files.
- **Blank hp by make:** GMC 142, Audi 32, Buick 22, Mitsubishi 16, VW 10, Dodge 8, Lincoln 3, Lexus 3 (pages blocked or not loading; never estimated).
- **Spot-check:** six sampled values match the published figures:
  - BMW M440i 386;
  - Sierra HD 6.6L Duramax 470;
  - 911 Carrera S 473;
  - Acadia 2.5T 328;
  - Canyon TurboMax 310;
  - Charger R/T SIXPACK 420 (confirmed on its source page, the Stellantis 2027 press kit).

  gmc.com (403) and bmwusa.com (timeout) refused automated reads.

## 6. Mapping dry run (items left unchanged)

| File | Originals, no facts | Re-pass + facts |
|---|---|---|
| VW/Audi | 81 | 42 |
| GMC/Buick | 300 | 265 (193 cab/bed lines) |
| Cadillac/Lincoln | 146 | 9 |
| Mercedes | 3 | 0 |
| BMW/MINI | 89 | 2 (MINI Countryman SE: fixed by a known correction) |
| Porsche/Land Rover | 113 | 23 (packages) |
| Lexus/Acura | 3 | 3 |
| Genesis/Volvo | 23 | 23 (no official Volvo displacement) |
| Dodge/Chrysler/Alfa | 61 | 8 |
| Mitsubishi/Polestar/Lucid | 41 | 16 |
| Maserati, FIAT | 0 | 0 |
| **Total** | **860** | **391** |

No collisions in either run.

## 7. Brett's decisions (2026-10-16)

1. **Section D:** one Cowork prompt for every make's missing prices plus Porsche Paint to Sample. Order: GMC, Cadillac, Lincoln, Land Rover, Audi, then the rest. No stopping to ask, saving per make so a stopped run resumes, same rules. Saved as `cowork-prices-prompt-2026-10-16.md`.
2. **Audi "performance":** lowercase everywhere, matching Audi USA. **Standing rule: the manufacturer's exact styling.**
3. **Cadillac:** keep "V" / "V Blackwing" (the "V-Series" rename is reverted) and keep "Base" for the entry Escalade/ESV.
4. **BMW XM:** the 300-mile 2026 EPA total range for the 2027 row, source year noted (section 4).
5. **MINI Countryman SE ALL4:** a logged known correction in the mapping step (fuel type EV, engine line "Electric, 308 hp, AWD"), with a test. The research file stays as received.
   - Decisions 2 and 3 are also known corrections, so every re-pass file stays as received.
6. **Later Cowork pass, after prices:**
   - missing rows: 2027 Charger Daytona plain Scat Pack; BMW X5 40, X5 50e, 750e; Eclipse Cross SE Pano / SEL Touring;
   - row splits: the Durango GT vs GT HEMI split, and EQE 320 RWD vs AWD.
   - **Volvo EX40:** import unpromoted but never promote (no longer sold new in the US). ⚠ See section 8.
7. **MarketCheck spellings:** differences go into the trim-name equivalents table after the D5 name check. Watch the renamed trims: Durango "GT HEMI …", the Mercedes HYBRID / E PERFORMANCE caps, and Acura "… Package".
8. **2027 Matchmaker data:**
   - the 2027 Charger Daytona sedans carry the +$500 premium: Scat Pack $72,995, Scat Pack Plus $77,990, with true starting prices $74,990 / $79,985;
   - 670 hp for the 2027 Daytona Scat Pack Plus. v20 already had 670, and the build checks it.
   - Applied in `data/matchmaker-vehicle-dataset-2026-v21.csv`, built by `scripts/build-matchmaker-v21.py`: v20, plus the 19 Wave 3 rows (the 6 Charger Daytona rows dropped), plus those two price changes.
   - v21 differs from v20 in exactly those two lines plus the appended rows.
   - Raw only: not scored, imported or promoted.

## 8. Open points

- **⚠ Promotion is per make, not per model.** `promote_configurator_batch_make` makes a whole make's batch live, so the Volvo EX40 can't be "imported unpromoted but never promoted" inside a Volvo batch. Promoting Volvo would make it live. The same applies to Maserati's unpriced MCPURA, MCPURA Cielo and GT2 Stradale (Wave 3 decision M1).
  - **Proposed:** a logged "held models" list in the mapping step that leaves those rows out of the import until released (and tested like the corrections). The research files stay as received.
  - Needs Brett's go-ahead.
- **2027 gas Charger sedans:** the configurator research prices the 4-door at +$2,000 over the 2-door (2026 and 2027). The Matchmaker dataset lists 2027 gas coupes and sedans at the same price. Brett's decision covered the Daytona only, so this is unchanged pending a decision.
