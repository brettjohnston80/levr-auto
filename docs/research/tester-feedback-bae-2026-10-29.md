# Tester feedback: BAE (outside tester round, 2026-10-29)

Same round as Terry. Recorded as received from Brett; BAE's screenshots are with Brett. Proposed fixes are BAE's or Brett's; the fix plan (screens, files, draft wording, main vs the `offer-entry` branch) follows separately for Brett's sign-off.

1. **After sign-in and a password change, BAE ended up in account settings.** BAE expected to go straight to searching and didn't realise they were in account settings. Proposed: after sign-in, send the customer to where their search stands, with a clear "Continue your search" button.
2. **Review your search: the trim is missing from the summary.** The bottom says you can select trim, color etc., though BAE had already picked a trim. Proposed: show the trim in the summary; reword the bottom as fine-tuning ("fine-tune your trim, colors and options").
3. **The bottom two info sections repeat content.** Proposed: merge them.
4. **Payment before details.** BAE asked why payment comes before outlining everything. Proposed: keep the order and add one line before payment: "Paying starts your search. Next, you'll fine-tune your trim, colors and options. Changes are free for 24 hours, and your guarantee starts once your search goes live." (draft, for Brett's sign-off).
5. **The "+" to expand colors and features isn't self-evident.** Proposed: a text label ("Show colors" / "Show features") and make the whole row clickable.
6. **"How realistic is the number of vehicles available nationwide? Where's that data from?"** Confirm exactly what the count is (a true nationwide count from MarketCheck, or only synced listings) and propose a short source note under it, e.g. "Based on current dealer listings."
7. **Ranking screen: no Save button.** BAE looked for one and eventually hit the X, which felt wrong but did save. Proposed: a clear "Save" / "Done" button, keeping auto-save.
8. **Matchmaker: "How many people usually ride along?" doesn't say whether to count the driver** (added 2026-10-30). Proposed by Brett: "How many people usually ride in the car, including you?" with answer options that count the driver.

## Status (2026-10-30): items 1 to 7 resolved and live on www; item 8 planned
| # | Item | Resolution |
|---|---|---|
| 1 | Lost in account settings after sign-in | "Continue your search": sign-in goes to where the search stands; the button on `/account` and after a password change; settings moved below the searches (`docs/plans/bae-continue-your-search-plan.md`) |
| 2 | Trim not in the Review your search summary | Trim is chosen after payment, so there's no trim row; the merged paragraph explains it (Brett, 2026-10-29) |
| 3 | Repeating paragraphs at the bottom | Merged into one (Brett's wording) |
| 4 | Why payment comes before the details | Covered by the merged paragraph (no separate line) |
| 5 | The "+" on the comparison sections | No text label (Brett): a larger green outlined "+" with a pressed state, the whole row header tappable, screen-reader labels |
| 6 | "How realistic is the nationwide count?" | It was only our synced sample. Counts are never called nationwide; no count without synced listings; "Based on current dealer listings." under a count |
| 7 | No Save button on the ranking screen | "Done" at the bottom of the trim comparison (auto-save kept); "Rank #1" relabelled "Make #N" because it's a button |
| 8 | Riders question: does it count the driver? | **Planned, not built** (2026-10-30). Matchmaker only (intake doesn't ask). Plan below; waiting on his choice of answer options and sign-off. Goes on `main` alone (no overlap with `offer-entry` or `gx`) |
Also found from BAE's screenshots: the phone comparison's colour names overlapped the first trim column (fixed). Wording: inventory section 20. Verified on www with disposable accounts and screenshots (`~/Downloads/levr-bae-fixes-2026-10-29/www/`, `~/Downloads/levr-bae-continue-2026-10-30/www/`).


## Item 8 plan (2026-10-30, not built; wording needs Brett's sign-off)

**Where it appears (all Matchmaker; intake and Review your search don't ask it):**
| Where | Current |
|---|---|
| Quiz question (`src/components/matchmaker.tsx:121`) | "How many people usually ride along?" |
| Helper text (`matchmaker.tsx:122`) | "Helps us gauge how much seating and cargo room you need." |
| Answer options (`src/lib/matchmaker-data.ts:93`, `FAMILY_SIZES`) | "1-2", "3-5", "6+" ("6+" only for SUV and Minivan) |
| Results answer panel label (`matchmaker.tsx:865`) and answer chip (`matchmaker.tsx:668`) | "Riders" |
| No-results line (`matchmaker.tsx:1934`) | "Try widening your price range or riders — adjust any answer alongside the list." |
| Detail view bullet (`src/components/vehicle-detail-modal.tsx:58`) | "Seating sized right for your group (3-5 riders)." |

**How the answer is used:** a minimum-seats filter (`src/lib/matchmaker-scoring.ts:12`): "1-2" no minimum, "3-5" at least 3 seats, "6+" at least 6. Seat counts include the driver, so counting the driver in the question makes the answer and the filter mean the same thing.

**Proposal:**
- Question: "How many people usually ride in the car, including you?"
- Helper text: "Count yourself. This helps us gauge how much seating and cargo room you need."
- Option A (labels only, filter unchanged): "Just me, or 2" / "3 to 5" / "6 or more".
- Option B (recommended, the filter matches the answer): "Just me, or 2" (no minimum) / "3 or 4" (at least 4 seats) / "5" (at least 5) / "6 or more" (at least 6, SUV and Minivan only). Under A, "3 to 5" still shows 4-seat cars to a group of five.
- Panel label and chip: "People" (was "Riders"). No-results line: "Try widening your price range or the number of people, or adjust any answer alongside the list." Detail bullet: "Seats your group ({answer}, including you)."
- Under B, a saved Matchmaker answer of "3-5" from before the change is cleared on load (the customer picks again); A needs nothing.

**Branches:** `main` only: `matchmaker.tsx`, `matchmaker-data.ts`, `matchmaker-scoring.ts` (B only), `vehicle-detail-modal.tsx`. `offer-entry` changes none of these files; `gx` changes `matchmaker.tsx` (around line 1264) and `vehicle-detail-modal.tsx` (lines 101 onward), away from these lines, so the change goes on `main` alone and merges into both branches without conflicts.
