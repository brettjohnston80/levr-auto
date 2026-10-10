# Chevrolet & Ford 2026(/2027) Configurator Research — Notes & Discrepancies
**Date:** 2026-10-09 · **Companion file:** `chevrolet-ford-configurator-full-2026-10-09.csv` (147 rows, 18 columns, same schema as the Toyota reference CSV)

This supersedes the Chevrolet/Ford sections of `claude/chevrolet-ford-configurator-full-2026-09-16.csv`/`.md` — that prior pass leaned more heavily on dealer-aggregator sites (GM Authority, CarBuzz, deltachevrolet.com, astroford.com) and derived some rows (e.g. Suburban) from a sibling model via an assumed price delta rather than from the manufacturer's own configurator. This pass re-sources everything with manufacturer-site-first priority, Edmunds second, and flags every remaining gap explicitly rather than guessing.

## Coverage

| Make | Models (rows) |
|---|---|
| Chevrolet | Colorado (6), Silverado 1500 (9), Silverado 2500HD (7), Silverado 3500HD (4), Silverado EV (3), Bolt EV (2), Corvette (6), Equinox (6), Equinox EV (6), Trax (5), Trailblazer (4), Blazer (3), Blazer EV (3), Tahoe (6), Suburban (6) — **75 rows** |
| Ford | F-150 (8), Ranger (4), F-250/F-350/F-450 Super Duty (15), Mustang (6), Explorer (5), Expedition (7), Bronco (7), Mustang Mach-E (4), Maverick (5), Bronco Sport (4), Escape (6) — **72 rows** |

**147 rows total.** Zero format-validation errors on final check: every option-column item is `name | availability | price | package_name` with availability restricted to the four required values; every `Package-only` item's package name matches an entry in that row's `package_definitions`; every price is numeric or blank.

## Exclusions (per task instructions)

- **Transit / E-Transit** — excluded (commercial vans), confirmed absent from the dataset.
- **Chevrolet Camaro, Spark** — not currently sold/configurable; no live configurator.
- **Ford Escape** — included for completeness, but flagged heavily below: Ford's own site currently serves only a discontinuation banner for Escape, not spec pages.
- **Ford Mustang GTD** — excluded. It's an allocation/application program, not a standard consumer Build & Price configurator car.
- **Silverado EV WT** — excluded as fleet-only, not on the consumer configurator.
- **Chevrolet Colorado ZR2 Bison** — excluded; mentioned on chevrolet.com but not confirmed as a separately configurable, separately priced consumer trim.
- Several Super Duty/Silverado 1500/Silverado HD body styles beyond "Crew Cab Short Bed" (e.g. Regular Cab, Double Cab, long bed) exist but were not captured as separate rows — sources didn't show them carrying different option sets, so one row per trim was used per the task's stated default.

## Model-year rollovers (2026 → 2027)

As of research date (Oct 2026), the following manufacturer configurators had already rolled to MY2027, and 2027 is reported instead of 2026 per task instructions — each independently confirmed as *genuinely on sale* (not just orderable) via Edmunds dealer inventory or a direct dealer-inventory search:
- **Chevrolet Equinox / Equinox EV** — confirmed via Edmunds live dealer inventory.
- **Chevrolet Blazer EV** — confirmed on sale.
- **Chevrolet Tahoe / Suburban** — confirmed via Edmunds (Suburban: 1,138 units nationwide) and a direct Grapevine, TX dealer-inventory search (Tahoe, via carpro.com listings).
- **Chevrolet Bolt EV, Corvette** — confirmed on sale.
- **Ford Explorer / Expedition** — confirmed via Edmunds (both ford.com and Edmunds independently agree on Explorer ST's 400 hp/415 lb-ft rating, 385 hp in Section-177 states).

All other models remain MY2026.

## Key discrepancies and flagged ambiguities (manufacturer site vs. Edmunds vs. trade press)

1. **Chevrolet Tahoe/Suburban pricing gap pattern.** Chevrolet.com's Build & Price (zip 67201) runs ~$3,095 above Edmunds' base MSRP on LS/LT/RST/Z71/Premier trims (consistent with a destination charge), but only ~$1,595 above on High Country, on *both* models — an unresolved, trim-specific inconsistency, left unresolved rather than guessed at.
2. **Suburban = Tahoe + exactly $3,000** on every trim and every drivetrain/engine upcharge — this was independently re-confirmed this pass by driving both models' own configurators trim-by-trim (not assumed via a sibling-model delta, as the superseded Sept. 16 file did).
3. **Silverado EV RST** — Chevrolet's own site shows it discontinued, but Edmunds still lists it. Both positions are preserved in the data (flagged, not resolved).
4. **Corvette E-Ray discontinued**, replaced by the Grand Sport X trim for MY2027.
5. **Chevrolet Equinox base-price gap.** Chevrolet.com's FWD MSRPs run ~$300 higher than both Edmunds and GM Authority's order-guide figures for LT/RS/ACTIV — unexplained, flagged per-row. The AWD premium used ($2,000) is not independently confirmed on chevrolet.com (not published there) and is carried over from Edmunds/GM-order-guide instead.
6. **Chevrolet Colorado/Silverado 1500 — configurator inaccessible.** Chevrolet.com's live Build & Price is a heavy JS SPA; neither WebFetch nor browser automation could reliably drive it for these two models (automation kept snapping back to a stale cached Tahoe build). Fallback: chevrolet.com static/SEO pages for trim lists/MSRPs, Edmunds for detailed options — flagged throughout.
7. **Ford Explorer/Mustang/Bronco/Mach-E/Super Duty — no public Build & Price pricing.** Ford.com's Build & Price tool is ZIP-gated and doesn't surface in static fetch; most package and extra-cost color prices are therefore not publicly disclosed anywhere and are left blank rather than guessed. The few Mustang figures present (Dark Horse Handling $5,495, Appearance $2,495, etc.) came from a Military.com article describing one specific build, not ford.com/Edmunds directly.
8. **Mustang Mach-E "Rally" classification ambiguous.** Ford's own site shows Rally as its own trim; Ford Authority/the order guide describes it as a GT package. Given primary-source priority (manufacturer site), it's kept as its own row here — flagged rather than merged.
9. **Ford Authority internal package-price conflicts** (Bronco Badlands Sasquatch package, Bronco Raptor appearance package, Mach-E Premium Sport Appearance Package) — both conflicting figures found in different Ford Authority articles are preserved in the data/notes rather than arbitrarily picked.
10. **Ford Escape — severe source failure.** Ford.com's Escape model pages currently serve only a discontinuation banner ("tapping the brakes... discontinuing for the time being") plus a note that 2026 Escape is unavailable for purchase in CA, MA, OR, NY, WA, and VT. Zero manufacturer-site trim-level spec data could be gathered. All Escape rows are sourced from Edmunds + Ford Authority order-guide articles, with a dealer-template site (astroford.com) used only as a last resort for ST-Line Select/Elite/PHEV and flagged as internally inconsistent (e.g., two conflicting MSRPs on the same page for ST-Line Elite).
11. **Ford Maverick Lobo** — confirmed and kept as its own distinct trim (not a package), consistent across sources.
12. **F-150 Lightning** — not included; discontinued, confirmed via prior research pass.

## Structural note: drivetrain representation differs across models

Most trims consolidate 2WD/4WD or engine variants into a single row via the `drivetrain_engine_variants` column (e.g., Silverado, Tahoe/Suburban: one row per trim, FWD/4WD priced as alternative engine-variant line items). The **Chevrolet Equinox and Equinox EV** were instead split into **one row per drivetrain** (FWD and AWD each get their own row, same trim name/year) by the researching agent. Both are internally format-compliant; this is a modeling-convention difference, not a data error, and is called out here so anyone querying the CSV by `trim` alone for Equinox/Equinox EV is aware they'll get two rows back.

## Primary sources used

- **Manufacturer Build & Price configurators:** chevrolet.com/shopping/configurator/... (Tahoe/Suburban driven live via browser automation, zip 67201; other Chevrolet models via static/SEO pages where the SPA wasn't drivable), ford.com model pages (ZIP-gated Build & Price not publicly fetchable for pricing, used for trim/feature/color lists).
- **Edmunds** (secondary, as instructed) — features-specs pages for essentially every model, used for the bulk of per-trim option/package/color detail and model-year-on-sale verification.
- **Trade press**, used only as flagged secondary cross-checks reporting on manufacturer order-guide data: Ford Authority (Bronco/Bronco Sport/Escape/Mustang/Super Duty package & color articles), GM Authority (Equinox configurator-launch and wheel-choice articles).
- **Dealer-inventory spot checks** (not a data source, only used to confirm genuine on-sale status): carpro.com (Tahoe 2027, Grapevine TX).
- **Last-resort only, explicitly flagged in the CSV's own confidence_notes:** astroford.com (dealer-template page) for three Ford Escape trims where ford.com and Edmunds both fell short.

## Process note (transparency)

This research required re-running 8 of the original 11 vehicle-group research assignments after an earlier mid-task context compaction lost their raw output; the other 3 were recovered intact. All 11 assignments' final data were independently re-verified column-by-column against the task's strict format rules before assembly — 5 minor package-name mismatches were found and corrected mechanically (matching an already-researched package name/definition already present elsewhere in the same dataset, never inventing new facts): two Chevrolet Blazer rows referencing "Midnight/Sport Edition" where the definition was named "Midnight/Sport Edition (WJU)," and three Ford Super Duty rows (F-350 XL/XLT, F-450 XL) missing the "Super Duty Carhartt Package" definition that was already confirmed and present on the equivalent F-250 rows.
