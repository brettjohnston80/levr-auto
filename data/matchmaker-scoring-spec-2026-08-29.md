# Matchmaker Filter & Scoring Logic — Working Spec
*Organized from voice notes, 2026-08-29. Not yet approved for build — see Open Items at the end.*

---

## 1. Vehicle Type — Hard Filter — RESOLVED

Whatever body style the user picks (e.g., SUV, sedan, truck) filters out everything that doesn't match.

**Normalization rule:** any subvariant containing "SUV" (three-row, two-row, midsize, etc.) collapses to "SUV." Full-size pickup collapses to "Truck." General rule: subvariant descriptors fold into whichever parent category they contain.

**Data handling:** when the Cowork session regenerates/finalizes the dataset, save the normalized category as a single body-style column — don't keep a separate detailed/raw column alongside it.

---

## 2. Main Use — Priority Weighting (NOT a filter)

Unlike vehicle type, this doesn't remove options — it sets which scoring dimensions get prioritized. **The set of "main use" options shown depends on the vehicle type picked in Question 1** (your example used sedan's option set).

Sedan example, and what each option should prioritize:

| Main use | Prioritize |
|---|---|
| Daily commuting | Reliability rating, EPA combined MPG |
| Small family transportation | Interior space — cargo, legroom, headroom (favor more space) |
| Fuel-efficient errands / city driving | Cargo space + fuel economy (MPG) |
| Business professional use | Comfort + Technology & features — RESOLVED |
| Long-distance highway trips | Range + MPG |

---

## 3. Number of Riders — Hard Filter (minimum seat count)

| Selected range | Filter rule |
|---|---|
| 1–2 | No filter — any seat count qualifies |
| 3–5 | Exclude anything with fewer than 3 seats |
| 6–7 | Exclude anything with fewer than 6 seats |

---

## 4. Powertrain Preference — Prioritization, not a hard filter

Selecting Gas / Diesel / Hybrid / Electric doesn't remove other powertrains — it controls ranking and how alternatives surface.

- **Powertrain match — RESOLVED as segmented display only.** No score bonus — the underlying weighted score (Section 6) is untouched by powertrain preference. Instead, results are grouped/labeled after scoring: the chosen powertrain fills the top spots (sorted by their own scores), other powertrains appear further down individually labeled (e.g., "Best gas option," "Best hybrid option," "Best alternative powertrain option"), using the closest-alternative mapping already defined above.
- "Closest alternative" ordering, defined so far:
  - Electric chosen → Hybrid is the preferred next-best alternative (over gas/diesel)
  - Gas chosen → Hybrid is the preferred next-best alternative (over electric)
  - Diesel chosen → Gas is the preferred next-best alternative — RESOLVED
  - Hybrid chosen → Gas and Electric are equally preferred next-best alternatives (tie, no priority between them) — RESOLVED

---

## 5. Target Price Range — Hard Filter

If the user selects a range (e.g., $30k–$60k), filter to vehicles/trims whose price falls inside that range. Rationale given: a specific trim level will typically land inside the chosen range even if the base or fully-loaded trim of that model wouldn't.

---

## 6. "What Matters Most to You" — Weighted Ranking

The user ranks priorities in order of importance; rank position determines a weight multiplier. Your example weight scale by rank position:

| Rank | Weight |
|---|---|
| 1st | 100 |
| 2nd | 75 |
| 3rd | 50 |
| 4th | 40 |
| 5th | 30 |
| 6th | 25 |
| 7th | 20 |
| 8th | 15 |
| 9th | 10 |

**Dimensions as you defined them:**

- **Safety** — NHTSA overall star rating only, for now (5 stars = 100, scaled down from there). Only data source currently available.
- **Comfort (spacious, smooth ride)** — headroom/legroom only, not cargo.
- **Cargo space** — scored on its own, separate from comfort.
- **Fuel economy — RESOLVED:** 50% relative MPG score + 50% relative range score, both scored relative to same-class vehicles. **Split by powertrain first**: EVs are scored relative to other EVs only (both MPG-equivalent and range); non-EVs (gas/diesel/hybrid) are scored relative to each other only. This prevents EVs' much-higher MPGe from dominating the dimension by default.
- **Reliability** — reliability rating column, 5 = highest.
- **Technology & features — RESOLVED, sourcing confirmed.** Uses the existing `tech_score` column directly (0-6 scale) — a count of how many of six specific features are *standard equipment* (not just available) on that exact trim: wireless CarPlay/Android Auto, an advanced Level 2+/hands-free highway driving assist package, digital instrument cluster, head-up display, surround-view/360° camera, and wireless phone charging. Defined in `SCHEMA_INSTRUCTIONS.md` and applied identically by every research agent since the first pass — the consistent-checklist approach the earlier caveat was checking for. No further data work needed for this dimension.
- **Price value** — lower price scores better.
- **Resale value** — resale value score column, higher = better.
- **Performance — RESOLVED as a real 9th dimension.** Components: 0-60 time, top speed, and a performance-trim yes/no flag. Combining formula — RESOLVED: performance-trim flag = 50% of the score, 0-60 time = 25%, top speed = 25%.

**Per-dimension scoring is relative to same-class vehicles**, not the whole dataset — e.g., among sedans only, the most spacious sedan scores 100 on Comfort, the least spacious scores 0. That relative score (0–100) × the dimension's rank-weight = its contribution to the total.

**Powertrain match does NOT feed into this score.** An earlier draft of this line said it did ("we'll probably calculate that as a part of the score as well") — that's superseded by Section 4's resolution: powertrain preference is segmented display only, layered on top of the weighted total below, never a scoring input. Corrected 2026-08-30 so this doesn't resurface as a live contradiction during build.

---

## 7. Cross-Cutting Features

- **Compare page**: user can flag results and view them side-by-side on a separate page.
- **Real-time repopulation**: changing vehicle type mid-flow (e.g., sedan → truck) should re-run filters/scoring live, not require a restart.

---

## 8. Pre-Launch Verification Workflow — NEW REQUIREMENT

Before any of this scoring logic goes live on the website, you want a spreadsheet-based review step:

- Take the dataset produced by the Cowork session and add a **scores sheet**: every vehicle with each dimension's calculated score shown explicitly (e.g., MPG score: 95/100, Safety score: 80/100), including the relative-to-class and relative-to-powertrain math from Sections 2, 4, and 6.
  - **Structure — RESOLVED: separate tab per body style** (Sedan, SUV, Truck, etc.), rather than one flat sheet. Most scoring dimensions (Comfort, Cargo, Fuel economy, Performance) are already defined relative to same-class vehicles, so splitting by body style turns those into plain rank/percentile formulas against the whole column instead of needing a body-style filter inside every formula. The EV vs. non-EV split for fuel economy still needs its own handling *within* each body-style tab (a single condition, not a full re-filter).
  - This is a spreadsheet-organization decision only — it doesn't affect how the live website or the Cowork dataset itself is structured; the website will filter dynamically against the real data regardless.
- Add a **second sheet for simulating website options** — a way to plug in a hypothetical customer's selections (vehicle type, main use, riders, powertrain, price range, priority ranking) and see how the sheet sorts/scores results, mimicking what the live website would show.
- You want to review this spreadsheet output before the scoring logic gets pushed live to the actual website.
- The live website itself still does real-time filtering/sorting for real users — this spreadsheet is a pre-launch sanity check, not a replacement for the website logic.

This is a separate deliverable from the website code — an Excel build once the Cowork dataset is finalized, not something to fold into the Claude Code website work.

---

## Status: All Scoring Logic Resolved — Data Fill-In In Progress

This spec is ready to hand to Claude Code as a build prompt for the website side — it'll need the actual column names pulled from `generated-matchmaker-data.ts` first, since I don't have those verified here. The scores/simulation spreadsheet (Section 8) is a separate Excel deliverable.

**Blocking the spreadsheet build right now:** a Cowork fill-in pass is in progress on `nhtsa_overall_stars`, `zero_to_60_sec`, `top_speed_mph`, and `resale_depreciation_pct` (each under 25% populated, gaps concentrated by manufacturer), plus the 17 missing `msrp` rows and one broken Kia Telluride row. Tech & Features (`tech_score`) needed no fill-in — sourcing confirmed as a consistent 6-feature checklist applied since the first pass.

Once the patched dataset lands: normalize body style (Section 1, including the resolved Van split — Minivan/Cargo Van/Passenger Van stay as 3 separate categories) and Sports Car handling (all 5 rows are Corvette trims — default is folding into Coupe unless told otherwise), then build the per-body-style-tab scores sheet.

---

## Tech & Features — RESOLVED

Score = count of standard ADAS/safety-tech features only (not infotainment screen size, smartphone integration, or digital cluster — those were considered and not selected). See Section 6 for the sourcing caveat that still needs verifying.
