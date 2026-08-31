# Matchmaker Part 5 verification report — Towing & Payload + Main Use pre-fill

Written to a file per Brett's request (2026-09-02) after several rounds of
chat pastes lost content, specifically the description of a second pipeline
bug. Correction up front: **there was only ever one real bug found in the
pipeline script this round.** My previous chat summary's "Two real bugs"
heading was a mistake I made while writing that summary — I wrote the
heading, then only ever described the one bug underneath it, and never
caught the mismatch before sending. Not a paste/garbling issue on your end,
and not a second bug that got lost — just wrong on my part. Correcting it
here rather than fabricating a second bug to match the wrong heading.

New batch imported this round: **`38ff7925-5458-49a5-9217-cfe97ebbc859`**,
1,601 rows, from `data/matchmaker-vehicle-dataset-2026-v19-scored.csv`.
**Not promoted.** Nothing pushed. Commits sitting locally on `main`:
`f1a10e9` (Parts 1/3/4) → `2194835` (Part 2).

---

## 1. The pipeline bug (singular) found this round

**The embedded-text validation check was flagging literally the string
`"nan"` as false-positive "corruption."**

`validate_numeric_columns()` scans every numeric column for embedded text
(the real problem it exists to catch — e.g. a cell holding `"40.2 f / 36.7
r"` instead of separate front/rear values) via:

```python
weird = df[df[col].astype(str).str.contains('[a-zA-Z]', na=False, regex=True)]
```

The bug: `df[col].astype(str)` turns a genuinely-missing (`NaN`) numeric
value into the literal Python string `"nan"` — which contains the letters
n/a/n, so the regex `[a-zA-Z]` matches it. Every single blank/missing cell
in a numeric column got flagged as "corruption," even though it's just...
missing data, exactly the case the rest of the pipeline already handles
correctly via the universal 50-point floor.

**Impact when I ran the original (unfixed) script against the real v19
CSV:** 12,633 flagged "issues" printed to stdout. I checked every single
one — literally all 12,633 were the string `nan`, zero were genuine
embedded-text corruption. Purely cosmetic: `coerce_numeric_columns()`
(the step that actually touches the data) already handles a real NaN
correctly regardless of this bug, so the actual cleaned/scored CSV output
was never affected — only the diagnostic report was flooded with noise.

**Fix, made by Brett/whoever owns the pipeline (not by me):**

```python
not_null = df[col].notna()
weird = df[not_null & df[col].astype(str).str.contains('[a-zA-Z]', na=False, regex=True)]
```

Explicitly excludes real nulls via `.notna()` before the string check,
rather than relying on `astype(str)` + `na=False` to handle `NaN` the way
you'd want (that combination is pandas-version-dependent).

**How I verified the fix, before trusting it:**
- Re-ran the fixed script against the identical raw v19 input.
- Diagnostic report went from 12,633 false positives to `✓ No embedded-text
  corruption found in any numeric column.`
- Diffed the two runs' output CSVs (`diff` on the full files) — **byte-for-byte
  identical.** Confirms the fix only changed what gets printed, not any
  actual score or cleaned value. I didn't need to re-run any of the
  scoring-level verification below after this fix landed, since the
  underlying data provably didn't change.

---

## 2. "762 genuinely discriminating (non-floor)" — full detail

This was checking: **of all 1,601 vehicles in the new batch, how many
actually have real towing/payload data driving their Towing & Payload
Score, versus how many just floor at the default 50 (no data)?**

Query run directly against the new batch (`38ff7925-5458-49a5-9217-cfe97ebbc859`)
via a scratch route:

```
totalVehicles: 1601
towingScoreCoveragePct: 100     (every row has *a* score — the universal floor guarantees this)
nonFiftyCount: 762              (762 of 1,601 have a score that is NOT exactly 50)
```

So: **762 out of 1,601** vehicles (about 48%) have real, sourced
towing_capacity_lbs and/or payload_capacity_lbs data that produced an
actual differentiated score somewhere in the 50–100 range. The remaining
1,601 − 762 = **839** vehicles floor at exactly 50.0 — either because they
genuinely have no towing/payload spec (most Sedans, Coupes, Convertibles,
Hatchbacks — body styles where towing capacity isn't a normal spec at all),
or because of the single-value-class edge case confirmed separately (see
the Sedan check below).

This number alone proves the dimension has *some* real data behind it. It
doesn't by itself prove the data is usefully differentiating within the
body styles that actually matter (Truck/SUV/Cargo Van) — that's what the
next check was for.

## "185 distinct totals when ranked by it" — full detail

This checked something more specific: **if a customer actually ranks
Towing & Payload as their #1 priority for a Truck search, do real Trucks
actually spread out across meaningfully different combined scores, or do
they clump/tie because the dimension isn't really contributing anything?**

Method: called the real `getMatchedVehicles()` function (the same one the
live app uses) with `vehicleType: "Truck"` and priorities ordered with
`"Towing & Payload"` first (rank-weight 100, the highest), against the new
batch. The Truck body style has **191** total vehicles (confirmed earlier
in the pipeline's own body-style breakdown: SUV 928, Sedan 228, Truck 191,
Coupe 77, Hatchback 61, Cargo Van 38, Convertible 37, Minivan 27, Wagon 14
= 1,601).

Result: **`distinctTotalScoresAmongTrucks: 185`** — out of 191 Trucks, 185
of them ended up with a genuinely unique combined `totalScore` (only a
handful shared an exact tie). If Towing & Payload data were missing or
flat across the Truck class, you'd expect most/all Trucks to cluster into
very few distinct totals (since the other 8 dimensions alone would be
doing all the differentiating work, same as before this dimension
existed). 185 distinct values out of 191 is strong evidence the new
dimension is doing real, meaningful work in the ranking, not just sitting
there as an inert column.

Concretely, the top 5 Trucks ranked this way (real data, real vehicles):

| Rank | Vehicle | Towing Score | Towing Capacity | Total Score |
|---|---|---|---|---|
| 1 | Ford F-150 Tremor | 58.27 | 10,900 lbs | 30,112.8 |
| 2 | Ford F-150 Lariat | 61.36 | 13,500 lbs | 29,690.05 |
| 3 | Ford F-150 King Ranch | 60.62 | 13,200 lbs | 29,580 |
| 4 | Ford F-150 Platinum | 60.62 | 13,200 lbs | 29,563.7 |
| 5 | Ford F-150 XLT | 56.22 | 8,400 lbs | 29,509.65 |

Worth noting explicitly: the Tremor ranks #1 despite *not* having the
highest raw towing score of the five — that's expected and correct, since
`totalScore` is a weighted sum across all 9 ranked dimensions, not Towing &
Payload alone. Towing & Payload is weighted heaviest (rank #1, weight 100)
but the other 8 dimensions still contribute at their own (lower) weights.

**Separately, the Sedan floor check** (confirming the dimension correctly
does *not* leak real variance into body styles where it shouldn't matter):
all 228 Sedans score exactly `50.0` on Towing & Payload — zero variance.
One quirk confirmed while checking this: Sedans have zero real
`towing_capacity_lbs` values at all, and while a handful have a non-blank
`payload_capacity_lbs` (one specific value, 905 lbs, shared/repeated), the
pipeline's own `normalize_0_100()` returns all-`NaN` when the class-wide
min and max of a column are equal (`hi == lo`) — so even the Sedan(s) with
a real payload number can't be meaningfully normalized against a class
where nothing else has a comparable value, and correctly fall back to the
same 50 floor as everyone else. This is the pipeline behaving exactly as
written, not a bug.

---

## 3. "Real browser, full flow" — full detail

All of this was run against a real Chrome browser hitting the local dev
server, with `/matchmaker`'s Server Component temporarily pointed at the
new batch (`38ff7925-5458-49a5-9217-cfe97ebbc859`) via a local-only edit to
`src/app/matchmaker/page.tsx` — reverted back to the real `getLiveVehicles()`
call before anything was committed. `is_live` in the database was never
touched during any of this.

**Pass 1 — Truck, towing-focused search:**
1. Selected **Truck** as vehicle type.
2. Selected **"Towing (boat, trailer, equipment)"** as Main Use.
3. Confirmed the drag-to-rank step's *starting* order was exactly:
   `["Towing & Payload", "Fuel Economy", "Safety", "Comfort", "Cargo Space", "Reliability", "Performance", "Technology & Features", "Price/Value"]`
   — matching the approved hint table for that exact use case, with
   Towing & Payload correctly present as Truck's 9th dimension (not
   Resale Value).
4. Selected riders 3-5, powertrain Gas, left price open, advanced through
   to results with the pre-filled order untouched.
5. On the results screen, confirmed real vehicle cards with real data:
   - **Ford F-150 Tremor** — $67,710 est. — rationale: *"0-60 mph in 5.3
     seconds."* (this trim is a performance trim with real 0-60 data, so
     the rationale generator correctly picked that branch over towing)
   - **Ford F-150 XLT** — $47,690 est. — rationale: *"Tows up to 8,400
     lbs."* (a real, sourced number, correctly surfaced since this trim
     isn't a performance trim)
6. Opened the **"More info"** detail modal on the Ford F-150 XLT card.
   Confirmed the modal itself rendered correctly, fully on-screen (this is
   the same modal that had the `will-change-transform`/portal bug found
   and fixed during the original cutover — re-confirmed still fixed).
   Fit bullets shown, verbatim:
   - "Matches your Truck preference."
   - "Gas powertrain, as you wanted."
   - "Seating sized right for your group (3-5 riders)."
   - "Falls within your target price range."
   - "A solid fit for \"Towing (boat, trailer, equipment).\""
   - "Scores well on Fuel Economy, your #2 priority."
   - "Scores well on Safety, your #3 priority."
   
   **Deliberately did NOT show** "Scores well on Towing & Payload, your #1
   priority" — even though Towing & Payload was the #1 ranked priority for
   this search. This is correct, honest behavior: the bullet logic only
   fires when a vehicle's actual score on that dimension is ≥80, and this
   specific F-150 XLT's real Towing & Payload score wasn't high enough to
   earn it. Confirms the modal isn't just parroting "your #1 priority" for
   every result regardless of whether the vehicle actually earns it.

**Pass 2 — SUV, towing-focused search (started fresh via Start Over):**
1. Selected **SUV** as vehicle type.
2. Selected **"Towing (camper, boat, small trailer)"** as Main Use.
3. Advanced through riders (3-5), powertrain (Gas), price (open),
   priorities (left at the pre-filled order) to results.
4. Confirmed real SUV results with real towing-based rationale text:
   **Ford Expedition MAX Platinum**, **Ford Expedition MAX King Ranch**,
   **Ford Expedition Tremor** — the visible rationale lines read *"Tows up
   to 9,000 lbs."* for the matching cards, confirming the same rationale
   logic works correctly for SUVs too, not just Trucks.

Both passes used real make/model/trim/price/rationale data pulled live
from the newly-imported batch — nothing mocked, nothing stubbed.

---

## Everything else from the original Part 5 checklist (unchanged from the prior summary, included here for completeness)

- **9-rankable-dimension swap per vehicle type**: verified live —
  Truck/SUV/Cargo Van show Towing & Payload as their 9th option; the other
  6 body styles (Sedan, Coupe, Hatchback, Wagon, Convertible, Minivan)
  show Resale Value. Confirmed via direct DOM inspection of the rendered
  rank-step list for multiple vehicle types, not just visually.
- **Main Use pre-fill, all 9 body styles**: the hint table
  (`PRIORITY_HINTS_BY_USE_CASE` in `matchmaker-data.ts`) was verified
  against several real use-case selections across different body types,
  including single-dimension hints (e.g. Sedan's "Long-distance highway
  trips" → just `Fuel Economy`) and two-dimension hints. Also verified:
  manually dragging priorities, then changing vehicle type, correctly
  swaps just the 9th label in place (preserves the manual arrangement)
  rather than resetting everything; changing Main Use again after a
  manual drag correctly does *not* reshuffle anything.
- **Performance reverted to pre-experiment values**: independently
  re-ran the (fixed) scoring logic against the raw v19 input in a
  standalone Python check and diffed against the saved CSV — matched to
  floating-point noise (~1e-14). Separately, compared v19's Performance
  Score against the **currently-live v18 batch** for all 1,601 vehicles
  (matched by the full distinguishing key: make/model/trim/model_year/
  body_style/drivetrain/fuel_type) — **exact match for all 1,601**, zero
  mismatches, which is direct proof this is the never-blended formula.

---

## Status

Nothing pushed. Nothing promoted. Waiting on your review before either
step. Sequencing when you're ready is the same as last time: promote
`38ff7925-5458-49a5-9217-cfe97ebbc859` first, then push, then the deploy
picks it up (since `/matchmaker` is a static route with no ISR — a
promotion alone doesn't update the live site).
