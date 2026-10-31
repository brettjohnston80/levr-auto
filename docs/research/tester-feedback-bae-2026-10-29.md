# Tester feedback: BAE (outside tester round, 2026-10-29)

Same round as Terry. Recorded as received from Brett; BAE's screenshots are with Brett. Proposed fixes are BAE's or Brett's; the fix plan (screens, files, draft wording, main vs the `offer-entry` branch) follows separately for Brett's sign-off.

1. **After sign-in and a password change, BAE ended up in account settings.** BAE expected to go straight to searching and didn't realise they were in account settings. Proposed: after sign-in, send the customer to where their search stands, with a clear "Continue your search" button.
2. **Review your search: the trim is missing from the summary.** The bottom says you can select trim, color etc., though BAE had already picked a trim. Proposed: show the trim in the summary; reword the bottom as fine-tuning ("fine-tune your trim, colors and options").
3. **The bottom two info sections repeat content.** Proposed: merge them.
4. **Payment before details.** BAE asked why payment comes before outlining everything. Proposed: keep the order and add one line before payment: "Paying starts your search. Next, you'll fine-tune your trim, colors and options. Changes are free for 24 hours, and your guarantee starts once your search goes live." (draft, for Brett's sign-off).
5. **The "+" to expand colors and features isn't self-evident.** Proposed: a text label ("Show colors" / "Show features") and make the whole row clickable.
6. **"How realistic is the number of vehicles available nationwide? Where's that data from?"** Confirm exactly what the count is (a true nationwide count from MarketCheck, or only synced listings) and propose a short source note under it, e.g. "Based on current dealer listings."
7. **Ranking screen: no Save button.** BAE looked for one and eventually hit the X, which felt wrong but did save. Proposed: a clear "Save" / "Done" button, keeping auto-save.

## Status (2026-10-30): all seven resolved and live on www
| # | Item | Resolution |
|---|---|---|
| 1 | Lost in account settings after sign-in | "Continue your search": sign-in goes to where the search stands; the button on `/account` and after a password change; settings moved below the searches (`docs/plans/bae-continue-your-search-plan.md`) |
| 2 | Trim not in the Review your search summary | Trim is chosen after payment, so there's no trim row; the merged paragraph explains it (Brett, 2026-10-29) |
| 3 | Repeating paragraphs at the bottom | Merged into one (Brett's wording) |
| 4 | Why payment comes before the details | Covered by the merged paragraph (no separate line) |
| 5 | The "+" on the comparison sections | No text label (Brett): a larger green outlined "+" with a pressed state, the whole row header tappable, screen-reader labels |
| 6 | "How realistic is the nationwide count?" | It was only our synced sample. Counts are never called nationwide; no count without synced listings; "Based on current dealer listings." under a count |
| 7 | No Save button on the ranking screen | "Done" at the bottom of the trim comparison (auto-save kept); "Rank #1" relabelled "Make #N" because it's a button |
Also found from BAE's screenshots: the phone comparison's colour names overlapped the first trim column (fixed). Wording: inventory section 20. Verified on www with disposable accounts and screenshots (`~/Downloads/levr-bae-fixes-2026-10-29/www/`, `~/Downloads/levr-bae-continue-2026-10-30/www/`).

