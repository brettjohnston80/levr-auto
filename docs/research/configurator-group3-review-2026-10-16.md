# Configurator promotion group 3 review: Dodge, Chrysler, Alfa Romeo, Mitsubishi (2026-10-16)

**Nothing is promoted; promotion waits for Brett's go.** One finding matters more than the rest: **the Dodge Charger can't match any inventory as imported** (section 4). Brett should decide on the fix before Dodge is promoted.

## 1. Batches (unpromoted, verified from database rows)

All imported with the mapping step, the engine-facts files, `data/held-models.json`, `blankPriceUnknown` and one make per batch. Trim and option counts equal the import responses. 0 package references were dropped and 0 values forced unavailable.

| Make | Batch | Source file | Trims | Options | "Price not confirmed" (standalone / package) | "Not confirmed" availability |
|---|---|---|---|---|---|---|
| Dodge | `c23c30d7-de48-4a3b-91f5-c6f3d12bc89a` | dodge-chrysler-alfa **pass3b** (Durango GT and GT Plus splits) | 41 | 1,208 | 0 / 0 | 0 |
| Chrysler | `4a7fdf79-ca23-4e07-8c0a-7577e8448195` | dodge-chrysler-alfa prices (unchanged since) | 8 | 173 | 0 / 0 | 0 |
| Alfa Romeo | `677d273b-7cf5-4ffe-a1b3-53285bf57adb` | dodge-chrysler-alfa prices (unchanged since) | 5 | 122 | 0 / 0 | 0 |
| Mitsubishi | `769e02a3-93e6-4d09-a830-17874a65a570` | mitsubishi-polestar-lucid prices (pass 3 identical) | 24 | 601 | 0 / 0 | 123 |

Mitsubishi's 123 "Not confirmed" are the availabilities its research left blank on purpose.

## 2. Held rows, corrections, items left unchanged

- **Held:** none. The 2027 plain Daytona Scat Pack is held, but no configurator row exists for it.
- **Corrections:** none.
- **Left unchanged:**
  - **Dodge (6):** a leftover "AWD HEMI V8" drivetrain line on six Durango HEMI rows, shown as a plain Standard line.
  - **Chrysler and Alfa Romeo:** 0.
  - **Mitsubishi (16):** engine lines without published horsepower (e.g. Outlander Sport 2027 "2.0L 4-cyl / CVT / FWD").

## 3. Screenshots (`~/Downloads/levr-configurator-review-2026-10-16/group-3/`)

- **Per make, 3 trims:** Highlights and All details, one model's trim comparison with every section open, and a phone Highlights. This is the local preview, so "0 available nationwide" there is the preview.
- **`durango-gt-plus-split/`:** the two new rows, GT Plus (V6) and GT Plus HEMI, side by side. This is the split you asked for.
- **`finalize-flow/`:** the Dodge Charger 2026 through the real /finalize flow locally (3 MarketCheck calls; the disposable account was deleted). It stays on the **general flow**, for the reason below.

## 4. ⚠ Coupe/sedan twins: the Charger matches no inventory

The mapping step splits each Charger "coupe or sedan" row into a Coupe row and a Sedan row with the same trim name, as decided in Wave 2.
- **Why nothing matches:** the matcher compares trim name, year and powertrain only, so it sees two candidates for "Scat Pack 2026" and refuses. All **141 synced Charger listings (0%)** fall back to the general flow. Nothing wrong is shown; the configurator just never appears.
- **The listings do say which body they are:** MarketCheck gives 3 doors for the two-door and 5 for the four-door. For example, Scat Pack 2026 has 55 three-door and 17 five-door listings.
- **Other models with the same twins:** all of them, including the already-live ones, fall back to the general flow today:
  - Toyota Corolla SE / XSE 2027 (hatchback / sedan), live;
  - Mazda Mazda3, 5 trims (hatchback / sedan), live;
  - Mercedes-Benz CLE, 3 trims (coupe / cabriolet), live;
  - Mercedes-Benz E-Class AMG E 53 2027 (sedan / wagon), live;
  - Dodge Charger, 11 trims.

**Proposed fix (app code; not built):** body-aware matching, the same idea as the powertrain split that fixed Civic and Telluride.
- **Splitting a trim:** when one trim and year has listings of different bodies, and our research has a row for each body, the trim step shows one option per body.
- **Matching:** each option matches only the row with that body.
- **Body from MarketCheck:** door count for the Charger (3 = Coupe, 5 = Sedan); body type for Corolla, Mazda3, CLE and E-Class (Hatchback / Sedan / Coupe / Convertible / Wagon).
- **Everything else** stays exactly as it is, checked by re-running every synced listing of the live makes.
- **Customer-facing wording to approve:** the option labels, e.g. "Scat Pack 2-Door" / "Scat Pack 4-Door", "SE Hatchback" / "SE Sedan", "CLE 300 4MATIC Coupe" / "Cabriolet".

## 5. MarketCheck names

- **Model names:** all four makes' names are the same as MarketCheck's.
- **Trims:**
  - Dodge's "GT HEMI Plus V8" style is handled since `23e2f0e`.
  - Chrysler (8 of 8), Alfa Romeo (5 of 5) and Mitsubishi (24 of 24) names match MarketCheck directly.
- **Inventory:** only the Charger is synced among these makes. Durango, Chrysler, Alfa Romeo and Mitsubishi get theirs through the normal on-demand sync.

## 6. Decisions for Brett

1. **Coupe/sedan twins:** build body-aware matching (section 4) and approve its option labels? Or promote Dodge now, with the Charger on the general flow until then?
2. **Durango GT Plus A250 edition (2026)** mixes the V6 and HEMI the way GT Plus did. Dodge lists "GT Plus AWD America250" ($49,590) and "GT HEMI V8 Plus AWD America250" ($51,270) separately. Split it the same way?
3. **Promote group 3** (Dodge, Chrysler, Alfa Romeo, Mitsubishi), one make at a time with a check on www?
4. **Mitsubishi's 16 engine lines without horsepower:** OK to show them as they are?
