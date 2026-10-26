# Tesla and Rivian configurator research: review and mapping dry run (2026-10-25)

**Read-only review.** Nothing was imported or promoted, and no repo data file was edited. Brett's decisions were applied to scratch copies only: the R2 hold in a copy of `data/held-models.json`, and the Model Y L as model "Model Y", trim "L Premium". No MarketCheck calls were made.

**Inputs (committed as received):** `data/tesla-rivian-configurator-full-2026-10.csv` (17 rows) and `docs/research/tesla-rivian-configurator-notes-2026-10.md`. These imports are part of guarantee-exceptions chunk GX-5 (`docs/plans/guarantee-exceptions-plan.md`), so nothing goes live until GX-1 to GX-6 are approved and built.

## 1. Integrity

- All 17 rows have 18 fields, in the Toyota template's order.
- **Model years:** Tesla Model 3 and Model Y are recorded as 2027 (the configurator's default year), Cybertruck 2026, every Rivian row 2027.
- **Left out by Cowork, with reasons in the notes:**
  - Tesla Model S and Model X: not orderable new; both design pages redirect to inventory.
  - Rivian's 2026 R1 trims: inventory only, nothing configurable.
  - R2 Premium and R2 Standard: "coming late 2026" and "spring 2027".
  - R3 / R3X: no configurator.

## 2. Mapping dry run (`src/lib/configurator-mapping.ts`, with the engine-facts files)

| | Result |
|---|---|
| Rows in → out | **17 → 16** (the R2 is held) |
| Collisions | **0** |
| Dropped | 0 |
| Corrections | 0 |
| Held | **1:** Rivian R2 Performance 2027 (decision 2) |
| Changed | rule 7 drivetrain: 3 rows; rule 6 body style: 6 rows; rule 4 engine line: 8 rows |
| Left as is | rule 4: 11 engine lines (below) |

**What changed:**
- **Rule 7 (one drivetrain per row):**
  - **Changed:** Model 3 Premium, Model Y Standard and Model Y Premium go from "RWD/AWD" to "RWD".
  - **Kept as written:** AWD stays a priced option inside the trim (+$5,000, +$2,000, +$4,000), the way Tesla sells it, so no row is split. That's the rule working as agreed.
- **Rule 6 (body style):** "Pickup Truck" becomes "Truck" for the three Cybertrucks and the three R1Ts.
- **Rule 4 (engine line):** eight Rivian and Tesla lines rewritten, two of them wrongly (section 3).

**Left as is, rule 4 (11 lines):** no horsepower in the text or the engine-facts table:
- every Model 3 and Model Y line except the Model 3 Performance's;
- the Model Y L;
- the Cybertruck Dual Motor and Premium AWD.

Per decision 6 they stay blank; nothing is filled from KBB.

**Decisions applied:**
1. **Rivian 2026 R1:** there are no 2026 rows in the research, so nothing to do in the import. It applies to the Matchmaker rows (section 5).
2. **R2:** held (scratch held list). The real entry goes into `data/held-models.json` at GX-5:
   `{"make": "Rivian", "model": "R2", "why": "ordering open only to reservation holders (Performance trim); held until Rivian opens public ordering", "since": "2026-10-25"}`.
   **Watch item:** re-check monthly whether Rivian has opened R2 ordering to the public, and whether the Premium and Standard trims have opened.
3. **Tesla's $250 order fee:** not in any sticker. Recorded for offer entry (section 4).
4. **Model Y L: model "Model Y", trim "L Premium" (chosen).**
   - **Why:** our existing data already groups it that way. The live Matchmaker dataset lists it as model "Model Y", trim "L Premium AWD".
   - **MarketCheck can't tell us yet:** there's no listing data for it. The 2026-09-12 audit never reached the Model Y (quota exhausted), and no Tesla listings are synced.
   - **The first Tesla sync will show how MarketCheck names it;** a name mapping goes in then if needed.
5. **Model S and X:** not in the research, not in the Matchmaker dataset (v20 or v21), and in no configurator batch. They remain only in the hard-coded fallback list `MAKES_AND_MODELS` in `src/lib/vehicle-data.ts` (used only when the live dataset can't load). Removing them from it is a one-line app change for GX-5.
6. **Horsepower, battery and FSD:**
   - **Missing horsepower and battery figures stay blank.**
   - **FSD (Supervised):** Standalone with a blank price. With the import's blank-price rule it would show customers "Price not confirmed". It's really a $99/month subscription, so a note may read better. That wording needs Brett.

## 3. Mapping problems found (app code; proposed fix, not made)

Rule 4 rewrites electric engine lines from a fixed vocabulary, and loses two things these makes need:

1. **Named battery packs are dropped.**
   - The Rivian R1T and R1S Premium carry "Dual-motor electric, Large battery, 533 hp, AWD" (standard) and "…Max battery…" (the $7,000 Long Range option).
   - Rule 4 keeps a battery only as a kWh figure, so both become **"Dual-motor electric, 533 hp, AWD"**. The customer would see two identical engine options, one $7,000 dearer.
   - It also drops "Max battery" from the Performance and Quad lines.
2. **Quad-motor isn't recognised.** "Quad-motor electric, Max battery, 1025 hp, AWD" becomes **"Electric, 1025 hp, AWD"** (R1T and R1S Quad).

**Proposed change to `readEngineParts`** (needs Brett's go; with one test per case, like the other rules):
- recognise "quad-motor" ("Quad-motor electric");
- when there's no kWh figure, keep a named pack ("Standard", "Large", "Max", "Long Range" or "Extended Range" battery) as the battery part, giving "Dual-motor electric, Large battery, 533 hp, AWD".

**Already-imported makes:** the change can't alter any live data, since live batches aren't re-mapped. A re-import of another EV make could pick it up. The tests would include a re-run over every committed research file, showing which lines change.

## 4. Tesla order fee (decision 3)

**What it is:** $250 on every Tesla order (Model 3, Model Y, Cybertruck), marked non-refundable in Tesla's own configurator data.
- **It's not part of Total SRP:** the sticker is base + options + destination.
- **For offer entry:** a fee line Log Offer prefills for Tesla searches. Recorded in the offer-entry plan (section 4.A, "Manufacturer fees") as a small data file, `data/manufacturer-fees.json`.
- **Rivian has no such fee:** its $500 order deposit is applied to the price, so it isn't one.

## 5. What the Matchmaker dataset needs (proposal, not changed)

The current dataset is v21. The next version would be v22, built by the same script, then scored, imported unpromoted and promoted on Brett's go.

**Tesla (13 rows today, all MY2026)**

| Change | Rows | Detail |
|---|---|---|
| Model year | Model 3 (4), Model Y (6) | Tesla's configurator builds them as 2027 now. **Question:** add 2027 rows (same trims and prices) and keep the 2026 rows while 2026 inventory lasts (the Rivian rule); or rename the rows to 2027? Recommended: add 2027 and keep 2026 while inventory lasts, so a customer can still commit to a 2026 inventory car. |
| Trim names | all | The dataset keeps a row per drivetrain ("Standard RWD", "Premium AWD"); the configurator has one trim with AWD as an option. Keep the dataset's rows (Matchmaker scores each drivetrain), and add name equivalents for the configurator match at import. |
| Cybertruck trim renames | 2 | "Dual Motor All-Wheel Drive" → "Dual Motor AWD"; "Premium All-Wheel Drive" → "Premium AWD" (the configurator's names). |
| Cybertruck destination | 3 | $1,390 → **$1,995** (the research; tesla.com's own totals agree). The true starting price rises by $605: $76,985 / $86,985 / $101,985. |
| Cybertruck horsepower | 2 | The Dual Motor and Premium AWD show 600 hp, a KBB figure Tesla doesn't publish. **Question:** blank it, to match decision 6? |
| Prices | all others | Every Model 3, Model Y and Cybertruck MSRP matches the research. The Model 3/Y destination of $1,390 matches. |
| Model S / X | none | Not in the dataset; nothing to remove. |

**Rivian (19 rows today)**

| Change | Rows | Detail |
|---|---|---|
| 2026 R1, old names | 12 (R1T and R1S: Dual-Motor Standard / Large / Max Pack, Tri-Motor Max Pack, Quad-Motor Max Pack, and Quad-Motor Max Pack Launch Edition) | **Kept while 2026 inventory lasts** (decision 1), via a model-year entry in the "while inventory lasts" list. **Question:** the Launch Edition rows were limited editions; drop them now as no longer existing (decision 5), or let them follow the inventory rule too? |
| 2027 R1 | 6 | The names already match the research (Premium, Performance, Quad), and every MSRP matches. |
| R1 destination | 18 (2026 and 2027) | **Blank today, so the starting price equals the sticker.** The research gives $1,895 for 2027, so the 2027 starting prices rise by $1,895. The 2026 destination wasn't researched: leave it blank, or use $1,895? |
| R1 Premium Long Range | 2 (new) | **Question:** add a "Premium" Long Range row each for the R1T and R1S ($86,990 and $90,990 before destination), so Matchmaker can show its range? It needs a range figure: the notes give 300 mi (Large battery, 20-in wheels) and up to 420 mi (Long Range), not one EPA number per build. |
| R2 Performance | 1 | **Left out while held** (the build script skips held models). |

**Other:** "Pickup" and "Truck" body styles both map to Truck in the scoring pipeline, so the mix is harmless.

## 6. "While inventory lasts" extended (plan change)

The list proposed for Polestar (`data/while-inventory-lasts.json`) is extended to name a model and model year: `{"make": "Rivian", "model": "R1T", "model_year": "2026", …}`, and the same for the R1S. A listed row is offered only while `listings` has at least one car of that make, model and year. Recorded in the guarantee-exceptions plan (section 2).

**Inventory check:** no Rivian listings are synced yet, so the 2026 R1 rows would show nowhere until the first Rivian sync. That sync needs Brett's OK for the MarketCheck calls: about 2–3 calls per model, R1T and R1S.

## 7. Questions for Brett

1. **Rule 4 fix** (section 3): go ahead?
2. **Tesla model years:** add 2027 rows and keep 2026 while inventory lasts (recommended), or rename to 2027?
3. **Cybertruck 600 hp:** blank it?
4. **Rivian Launch Edition rows:** drop them, or follow the inventory rule?
5. **Rivian 2026 destination:** blank, or $1,895?
6. **R1 Premium Long Range rows:** add them? If so, what range should they show?
7. **FSD display:** keep "Price not confirmed", or use a subscription note (wording needed)?
8. **First Rivian and Tesla syncs:** when to run them (they need your OK for the MarketCheck calls; 286 calls are left until 2026-11-01).
