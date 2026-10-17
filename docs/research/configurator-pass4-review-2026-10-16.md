# Configurator pass 4 review (2026-10-16)

Read-only review of Cowork's run of `cowork-pass4-prompt-2026-10-16.md`. The files are committed as received (`064c5ae`, pushed).

## 1. Files

Every Progress line is done:
- the summary marks A–G done;
- each notes file marks its own item done.

The outputs are 4 CSVs (porsche-landrover, mercedes, gmc-buick, cadillac-lincoln), their 4 notes files, `configurator-engine-facts-pass4-2026-10.csv` (59 rows) and the summary. There are no files for vw-audi, bmw-mini or dodge, because those items added nothing (A, D) or were report-only (F), as the brief said. Nothing is unfinished.

## 2. Integrity (against each input)

- Same headers, 18 fields, line endings and well-formed option cells. Every existing row is still in its original order.
- **Changed on existing rows:** only `package_definitions` contents (GMC/Buick 81 rows, Cadillac/Lincoln 78) and `sources`. Package names and prices are unchanged on every row.
- **Rows added (10):**
  - Porsche Macan Electric 2026: Base (RWD), 4, 4S, GTS, Turbo.
  - Mercedes-Benz 2026: E-Class E 350, E 450 4MATIC, AMG E 53 HYBRID; E-Class Wagon E 450 4MATIC All-Terrain, AMG E 53 HYBRID.
- **Spot-checks:**
  - Porsche's 2026 configurator page shows Paint to Sample $13,870 and Base $80,300.
  - BMW USA's model list shows only the X3 30 xDrive and M50 xDrive. Its "50 xDrive" is the iX3, which we already have.
  - Dodge's 2027 Durango feed matches item F (I'd fetched it earlier).

## 3. Results

- **A. Audi:** nothing to add. For 2027, audiusa.com sells each of the 16 models as one version with packages (the Premium / Premium Plus / Prestige split is gone). Dealer listings named Premium Plus / Prestige are 2026 cars.
- **B. 2026 Macan Electric:** 5 rows, from Porsche's configurator, which still serves 2026. Paint to Sample is $13,870. Only the GTS's horsepower (563) is published.
- **C. 2026 E-Class:** 5 rows, from Mercedes-Benz USA's Build & Price data. Prices (before $1,350 destination):

  | 2026 E-Class | MSRP |
  |---|---|
  | E 350 | $63,900 |
  | E 350 4MATIC | $66,400 |
  | E 450 4MATIC | $72,300 |
  | AMG E 53 Sedan | $89,600 |
  | All-Terrain | $78,300 |
  | AMG E 53 Wagon | $93,350 |

- **D. BMW:** no sDrive X3 for 2026; "30" listings correctly match "30 xDrive".
- **E. Package notes:** 518 GMC/Buick and 362 Cadillac/Lincoln entries cleaned. No entry mentions "configurator" any more (175 + 7 before).
  - Notes moved out of the contents:
    - "Requires" notes: 38, now in the notes files;
    - "dealer-installed": 363 GMC/Buick and 355 Cadillac;
    - "shown at $0": 40.
  - **Not cleaned (not in the brief):**
    - 198 GMC/Buick "standard equipment … does not itemize" contents;
    - 52 Lincoln "standard equipment group" contents;
    - the 14 engine-choice package entries' own note (see the GM group review).
- **F. 2027 Durango:** all 8 Dodge prices are confirmed, and there are no other 2027 configurations; destination $1,995.
- **G. Horsepower:** 59 facts rows. Audi 32 lines, VW Atlas 2026 (269 hp), Mitsubishi (148 / 168 / 152). The Lexus TZ and four 2026 Macan Electric trims are still unpublished.

## 4. Effects

- **Held models and known corrections:** no change. All 17 corrections still apply, including the six XT5 unlinks.
- **Matchmaker v21** (decisions for Brett):
  - **2026 Macan Electric (5 rows) includes Porsche's $2,350 delivery charge.** E.g. Base: v21 $82,650 vs Porsche's $80,300. This is the same issue the 2026 Durango had.
  - **2027 Durango (8 rows) differs from Dodge's 2027 prices:** GT HEMI $45,670 vs $43,875; R/T 392 $52,990 vs $51,745; SRT Hellcat $82,490 vs $81,495; and so on.
  - The 2026 E-Class rows already match pass 4's prices.
- **Real synced listings now matching a configurator trim (live → pass 4 batches):**
  - Porsche Macan: 61% → **93%** (148 listings);
  - Mercedes-Benz E-Class: 58% → **88%** (144 listings), before the body split now live. That split also matches the AMG E 53s.
  - Audi: no inventory synced.

## 5. Dry run (pass 4 applied; all four engine-facts files)

| File | Rows in → out | Collisions | Held | Corrections | Left unchanged (pass 3 → pass 4) |
|---|---|---|---|---|---|
| gmc-buick | 81 → 81 | 0 | 0 | 0 | 265 → 265 |
| cadillac-lincoln | 95 → 94 | 0 | 4 | 10 | 13 → 13 |
| dodge-chrysler-alfa (pass3b) | 44 → 55 | 0 | 0 | 0 | 7 → 5 |
| bmw-mini | 72 → 72 | 0 | 0 | 4 | 0 → 0 |
| mercedes | 67 → 67 | 0 | 0 | 0 | 0 → 0 |
| mitsubishi-polestar-lucid | 33 → 33 | 0 | 0 | 0 | 16 → 0 |
| vw-audi | 90 → 90 | 0 | 0 | 3 | 42 → 4 |
| porsche-landrover | 118 → 118 | 0 | 0 | 0 | 23 → 32 (new Macan rows' named items) |
| lexus-acura, genesis-volvo, maserati, fiat | as before | 0 | 2 + 3 | 0 | 3, 23, 0, 0 |
| **Total** | **817 → 822** | **0** | **9** | **17** | **392 → 345** |

## 6. Re-imports (unpromoted) and the difference from each live batch

| Make | New batch | Live batch | What differs |
|---|---|---|---|
| Audi | `2528eeaf…` | `93732f5e…` | horsepower added to 28 engine lines (23 trims), e.g. "2.0L turbo I4, 201 hp, 7-speed dual-clutch automatic, AWD"; everything else identical |
| Volkswagen | `70886a0a…` | `e349d265…` | Atlas 2026: "269 hp" on 10 engine lines (5 trims); everything else identical |
| Mitsubishi | `e2d98b51…` | `769e02a3…` | horsepower on 16 engine lines (13 trims); everything else identical |
| Porsche | `55b88a1f…` | `fab4f627…` | + the 5 2026 Macan Electric trims; all 61 existing trims identical |
| Mercedes-Benz | `ebfdcc53…` | `49f1546d…` | + the 5 2026 E-Class trims; all 62 existing trims identical |

BMW and Dodge aren't affected. Nothing is promoted.
