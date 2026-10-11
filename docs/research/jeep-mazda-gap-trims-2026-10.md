# Jeep & Mazda Gap-Trim Research — Notes & Discrepancies
**Date:** 2026-10-10 · **Companion file:** `jeep-mazda-gap-trims-2026-10.csv` (1 row, 18 columns, same schema as the Toyota reference CSV)

## 1. Jeep Grand Cherokee "Limited Reserve" — included, 1 row

**Model year reported: 2027**, not 2026. jeep.com's main Grand Cherokee page still defaults to showing "2026," but Edmunds' 2027 features-specs page carries 68 real dealer listings, and a direct dealer-inventory search turned up multiple real, in-stock 2027 Limited Reserve units with real VINs (Luther Auto, McGovern Auto, Huffines) — confirmed genuinely on sale, not just orderable, so 2027 is reported per the task's own instruction.

**Confirmed with high confidence** (consistent across jeep.com, Edmunds, cars.com, KBB, and an actual dealer window sticker):
- 4WD-only — no 4x2 Limited Reserve configuration was found anywhere (unlike the plain Limited trim, which offers both).
- Single engine: 2.0L Hurricane4 turbo I4, 324 hp / 332 lb-ft, 8-speed automatic (880RE).
- 5-passenger seating.
- A "Quick Order Package 2CR Limited Reserve" ($5,595) exists and bundles Nappa leather, the panoramic sunroof, ventilated front seats, heated 2nd-row seats, and the Surround View/off-road cameras — sourced from a real window sticker (VIN 1C4RJHBR9VC569000).
- A "Mopar Finishing Package" ($525: paint protection film, splash guards) is also available.

**Flagged, not resolved — four conflicting base-price figures:**
| Source | Price | Note |
|---|---|---|
| jeep.com Build & Price (still showing 2026) | $51,915 | 4WD |
| Edmunds 2027 trim list | $52,555 | ~$640 bump over 2026, consistent with every other trim's 2026→2027 increase |
| cars.com 2027 comparison table | $47,130 | Identical to cars.com's own Limited 4x4 figure — looks like a data error duplicating the wrong trim's price, not independently confirmed as such |
| KBB comparison table | $54,550 | Page didn't label this as MSRP vs. average/fair-purchase price |

None of the four was picked as authoritative; all four are preserved in the CSV's `discrepancy_notes` rather than guessed between.

**Flagged gaps, left blank rather than guessed:**
- Exterior color list is a *union* of two partially-conflicting sources (cars.com: 7 colors; Edmunds: 6 colors, only 3 overlapping) — recorded as "Standard" by default since neither source flagged a surcharge, but this is a combined list, not independently per-trim-confirmed. Verify against jeep.com's live configurator before relying on it.
- Only one real-world build (the McGovern window sticker) had full equipment detail; its specific wheel (20" machined-face black aluminum) and interior color (Global Black) are recorded as *that build's* values, not confirmed as the only standard options.
- Whether front-seat heating ships standard or only via the Quick Order Package 2CR couldn't be cleanly resolved — jeep.com's own Build & Price tool is a JS SPA that WebFetch could not render for a full trim-level breakdown despite several attempts (direct fetches of `/build-and-price.html`, `/grand-cherokee.html`, and year-parameterized URLs all failed or returned incomplete content).
- **Grand Cherokee L** (the 3-row, extended-wheelbase model) also has its own "Limited Reserve" trim — this showed up in several dealer-inventory search results as a separate model line. It is **out of scope here**: the task named "Jeep Grand Cherokee" without "L," and this row covers only the standard 2-row model.
- "MyFlexCare Service Plan" ($225, seen on the same window sticker) is a dealer-sold service contract, not a vehicle configuration option — deliberately excluded from `package_definitions`.

**Sources:** jeep.com (build-and-price, main model page) · Edmunds (2026 and 2027 features-specs, 2027 trims page) · cars.com (2027 trims comparison) · KBB (2027 Limited Reserve page) · McGovern Auto Group (real window sticker/VIN) · dealer-inventory spot checks at Luther Auto and Huffines confirming genuine 2027 availability.

## 2. Mazda CX-90 "Premium" — excluded, confirmed not a standalone trim

Per the task's own instruction to research this only if it's a genuine standalone trim: **it is not.** Checked against four independent sources — Mazda's own comparison tool (via Edmunds' rendering, mazdausa.com itself returned a client error on direct fetch), Edmunds' 2026 features-specs page, KBB's 2026 CX-90 page, and an AutoGuide pricing article — and all four list the same 2026 lineup with no bare "Premium" trim:

- Gasoline: Select, Preferred, Premium Sport, Premium Plus, S Premium Sport, S Premium Plus
- PHEV: Preferred, Premium Sport, Premium Plus

"Premium" appears only ever as part of "Premium Sport" or "Premium Plus." No source — including a trade-press article specifically about the 2026 CX-90's "repackaged trims" — mentioned a standalone "Premium" trim ever existing on the CX-90 to be dropped or renamed. **No row was added for this.**

## Process note

Both items were researched directly (not delegated to subagents) given the small scope. Jeep.com's and Mazda's own Build & Price / configurator tools are JS single-page apps that WebFetch could not fully render in either case; Jeep's gap was filled with Edmunds, cars.com, KBB, and one real dealer window sticker (primary-source-equivalent for that specific build), all flagged per the task's never-guess rule. Mazda's determination (no such trim) needed no further research once four independent sources agreed.
