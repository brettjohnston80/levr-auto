# Plan: guarantee exceptions for direct-sale brands (Tesla, Rivian, Lucid, Polestar)

**Status:** plan only (2026-10-24; Brett's answers folded in 2026-10-25). No data, app code or migration has changed. Each build chunk waits for Brett's go; every wording line waits for his sign-off; the terms change waits for attorney review.

**⚠ Hard rule (Brett, 2026-10-25): before Stripe goes live, GX-1 to GX-6 must be built and live, and the real, attorney-reviewed Terms of Service published** (customers agree to them before paying; today's page is a placeholder). Until then nobody can really pay (Stripe is in test mode), so the four brands stay in intake and Matchmaker as they are today.

**Decision (Brett, 2026-10-24):** Tesla, Rivian, Lucid and Polestar come back as full LEVR services at the same $699, listed as **exceptions to the guarantee**. They sell direct at manufacturer-set prices (Polestar through dealers acting as its agents at its set price), so a below-sticker offer can't be promised. Every other brand keeps the guarantee exactly as it is. This replaces three earlier decisions: Wave 2 D7 (Tesla and Rivian dropped), D8 (Lucid and Polestar held for launch decision 6), and Brett's same-day decision to drop Lucid and Polestar.

## 0. Found while planning: the four brands are already selectable

- D7 (2026-10-14) dropped Tesla and Rivian from **configurator research only**. All four brands are still in the live Matchmaker dataset (Tesla 13 rows: Cybertruck, Model 3, Model Y; Rivian 19 rows: R1S, R1T, R2; Lucid 13; Polestar 4), and intake builds its make/model list from that dataset, so customers can pick them today and would be promised the guarantee.
- No search for any of the four brands exists (checked 2026-10-24), and no listings are synced for them.
- **Decided (Brett, 2026-10-25): don't hide them.** Stripe is in test mode, so nobody can really pay; the exception has to be live before Stripe is (hard rule above).

## 1. The rule

- **One data file:** `data/guarantee-exceptions.json`, at brand level:
  ```json
  [
    {"make": "Tesla",    "why": "sells direct at prices it sets; no dealer to negotiate with", "since": "2026-10-24"},
    {"make": "Rivian",   "why": "sells direct at prices it sets",                               "since": "2026-10-24"},
    {"make": "Lucid",    "why": "sells direct at prices it sets",                               "since": "2026-10-24"},
    {"make": "Polestar", "why": "sold through dealers acting as Polestar's agents at its set price", "since": "2026-10-24"}
  ]
  ```
  Adding or removing a brand is a data change, not a code change; it reaches the site on the next deploy (the file is read at build, like `data/held-models.json`). Future candidates: Scout Motors and Jaguar when they launch.
- **A paid search keeps the rule in force when it was paid.** At payment the search stores its own guarantee state, and nothing reads the file for a paid search again. Adding or removing a brand later never changes a paid search.
- **Where a search's brand is set or changed after payment,** the state is set at that moment from the file, with no extra acceptance step (Brett, 2026-10-25). Every customer has already accepted the standard terms, which include the exception (section 4):
  - an undecided buyer who pays first and picks the vehicle with an agent (`finalizeUndecidedSearch`);
  - the free make/model correction before the search starts (`updateSearchVehicle`);
  - a switch (free or $100), which creates a new search row.

## 2. Data: what each brand needs

| Brand | Matchmaker dataset (v21) | Configurator research | Configurator batch | Listings |
|---|---|---|---|---|
| Tesla | Cybertruck, Model 3, Model Y (2026), 13 rows | None in the repo (Wave 2 had no file). `tesla-configurator-full-2026-09-16.md` in the claude.ai project | none | 0 synced |
| Rivian | R1S, R1T (2026, 2027), R2 (2027), 19 rows | None in the repo. `rivian-lucid-configurator-full-2026-09-16.md` in the project | none | 0 synced |
| Lucid | Air, Gravity (2026, 2027), 13 rows | `data/mitsubishi-polestar-lucid-configurator-*-2026-10.csv` (full, re-pass, prices, pass 3) | `18841b59…`, 7 trims, unpromoted | 0 synced |
| Polestar | Polestar 4 (2026), 4 rows | same files as Lucid | `93b8f7fc…`, 2 trims, unpromoted | 0 synced |

**What's missing or stale:**
- **Tesla and Rivian:** the 09-16 research predates every rule the import now applies (the CSV format, mapping rules 1–9, the trim-name styling and "Base" re-pass, the site checks, the prices pass, the engine-facts table). **Decided: Cowork redoes it** (Brett sends it separately). When it arrives it goes through the usual review, mapping step, unpromoted import and promotion.
- **Model coverage to check in that pass:**
  - Tesla: the dataset has no Model S or Model X. Confirm whether they're still sold new in the US; if they are, they need Matchmaker rows too.
  - Rivian: confirm the R2's 2027 US prices and that it's orderable.
  - Polestar: the dataset has only the Polestar 4. Confirm whether the Polestar 3 is still sold.
- **Lucid:** the 10-2026 files supersede `rivian-lucid-configurator-full-2026-09-16.md` for Lucid; the batch is imported and only needs the checks below and a promotion.
- **`data/held-models.json`:** none of the four brands is held there, and nothing needs adding for the exception itself. Polestar's exit (below) would use it.
- **Inventory (from what we already have, no new MarketCheck calls):** MarketCheck does carry new listings for these brands. Its 2026-09-12 trim audit (`docs/research/build-trim-vs-version-audit-raw-2026-09-12.json`) saw active new listings for:
  - Tesla Model 3 (more than 5,000 listings, trims "Base", "Performance", "Premium"), Cybertruck and Model Y;
  - Rivian R1S and R1T; the R2 had none;
  - Lucid Air; the Gravity had none;
  - Polestar 4 (151, all with trim "Base").

  Two known problems from that audit:
  - **Trim names:** Polestar 4's listings all say "Base", so trims will need a name mapping (as with Mercedes-Benz). Rivian's "Launch Edition" drops its canonical prefix.
  - **Whose listings these are isn't known:** Tesla, Rivian and Lucid "dealers" in MarketCheck are their own stores or delivery centers; we haven't confirmed that. The first sync of each brand (about 3 calls per model) needs your OK.
- **Polestar's US exit after MY2026: offer it while inventory lasts, no Cowork pass (Brett, 2026-10-25).**
  - Its research is already in the repo and imported (`93b8f7fc…`, 2 trims); it's promoted with the others in GX-5.
  - **Hidden automatically when no listings remain:** a small list `data/while-inventory-lasts.json` (`[{"make": "Polestar", "why": "leaving the US after MY2026", "since": "2026-10-25"}]`). Intake (read on each request) offers a listed make or model only while `listings` has at least one row for it; Matchmaker (static) applies the same check at build, so it catches up on the next deploy. One shared check, like `not-offered-models.ts`.
  - **First inventory sync (planned, needs Brett's OK for the MarketCheck calls):**
    - one `syncListingsForMakeModel("Polestar", "4")`, about 1–3 calls (151 listings in September, so 3 pages at most);
    - after that the weekly scheduler keeps it fresh like any synced model;
    - when its listings reach zero it drops out of the scheduler on its own, and intake stops offering it.
  - **First sync done 2026-10-25 (Brett's OK):** 105 Polestar 4 listings found and stored, all MY2026, from 14 dealers in 11 states, priced $47,825–$84,373. None of the 92 with a sticker is priced below it. It used 3 calls, leaving 286 of 500 until 2026-11-01. Every listing's trim is "Base"; MarketCheck's version field says "LRDM" (96) or "LRSM" (9), apparently Long Range Dual Motor and Single Motor, so GX-5 needs a trim mapping for them.

## 3. Guarantee logic (database and jobs)

**Migration GX-1 (draft for review, not written yet):**
- `customer_searches.guarantee_status` gains `'not_applicable'` (today: `pending`, `met`, `refunded`).
- New columns on `customer_searches`:
  - `guarantee_exception_make text`: the brand the exception applied to, copied from the file when the state is set.
- New columns on `customers` (for the standard terms, section 4):
  - `terms_accepted_at timestamptz`;
  - `terms_version text`: which version of the terms they accepted.
- A trigger refuses any change of `guarantee_status` away from `not_applicable`, and refuses `met`/`refunded` on a search whose `guarantee_exception_make` is set. That way neither the Day-30 job nor a hand-written SQL update can resolve one.
- `record_payment_refund()` refuses reason `guarantee` on a `not_applicable` search; cancellation refunds stay possible, as for any search.
- The two switch functions and the vehicle-correction path set the state for the new or changed brand (section 1).
- It follows the explicit-grants rule. There's no new table, so it needs only the function grants and a grant check.

**Jobs and pages:**
- **Day-30 assessment:** it already selects only `guarantee_status = 'pending'`, so a `not_applicable` search never enters it; its write guard (`eq("guarantee_status", "pending")`) and the trigger cover the rest.
- **Refunds-due:** selects `refunded` only, so exception searches never appear.
- **Guarantee notification** (`guarantee_resolved`): never fires for them.
- **Day-60, extensions and pause:** unchanged; the search still runs 60 days and can be extended for $100.
- **The agent offer page** (offer-entry plan, section 6.1) shows "No guarantee for this brand" in place of "Counts toward the guarantee …".
- **The admin table's guarantee column** shows "Not applicable".

**Rolled-back tests (SQL, Brett runs them; each case its own sub-block):**
1. A `not_applicable` search: an update to `met` is refused.
2. The same search: an update to `refunded` is refused.
3. `record_payment_refund` with reason `guarantee` on it is refused; with reason `cancellation` it works.
4. An update of a `pending` search to `not_applicable` without `guarantee_exception_make` is refused (the two must agree).
5. A normal `pending` search can still go to `met` and `refunded` (unchanged).
6. The Day-30 job's selection query returns the normal search and not the exception one.

## 4. Customer side

**One acceptance, at the start (Brett, 2026-10-25).** The guarantee exception is one of the standard terms every customer accepts once, whatever make they pick. There's no brand-specific checkbox. **No terms acceptance exists anywhere today** (sign-up and checkout ask for none; `/terms` is a placeholder), so this is new:
- **Where:** a required checkbox on Review your search, before the first "Continue to payment", shown with the standard disclosures. It's skipped once accepted, and shown again when the terms version changes.
- **Check:** on the server too: `createCheckoutSession` (and the paid-switch checkout) refuses a customer without a current acceptance and stores the time and version.
- **Depends on** the real terms text, which waits for attorney review (GX-6). Until then it can point at the interim terms page.

**Plain informational lines, no checkbox,** wherever the brand matters: "Our money-back guarantee does not apply to {Brand}." The places:
- Review your search;
- the checkout summary (Stripe's custom text);
- Your Deal, in place of the guarantee timeline;
- the switch screens;
- Matchmaker.

**Draft wording (for sign-off; `{Brand}` is the make):**

| # | Where | Draft |
|---|---|---|
| W1 | Intake, under the make once an exception brand is picked | Our money-back guarantee does not apply to {Brand}. |
| W2 | Review your search, in place of the guarantee bullet | Our money-back guarantee does not apply to {Brand}. |
| W3 | Review your search, required once (standard terms) | I agree to the [Terms of Service]. |
| W3a | Under it, the standard disclosures | Money-back guarantee does not apply to Tesla, Rivian, Lucid or Polestar. |
| W4 | Error if the box isn't ticked | Please agree to the Terms of Service to continue. |
| W5 | Stripe checkout page (custom text above Pay), exception brands only | Our money-back guarantee does not apply to {Brand}. |
| W6 | Switch into an exception brand (added to the switch confirmation) | Our money-back guarantee does not apply to {Brand}. |
| W7 | Switch from an exception brand to any other brand | Your new search is covered by our money-back guarantee. |
| W8 | Your Deal, in place of the guarantee timeline | Our money-back guarantee does not apply to {Brand}. Your search runs through {date}, and you can extend it for $100 per 30 days. |
| W12 | Matchmaker card and detail note | Our money-back guarantee does not apply to {Brand}. |
| W13 | Terms, one clause in the standard terms ⚠ **attorney review** | Our money-back guarantee does not apply to searches for Tesla, Rivian, Lucid or Polestar vehicles. Whether a search is covered is set when you pay for it, or when its vehicle is chosen or changed, and later changes to this list don't affect it. |
| W14 | Agent search card badge | No guarantee: {Brand} (direct sale) |
| W15 | Agent offer page line (offer-entry 6.1) | No guarantee for this brand. |
| W16 | Admin table, guarantee column | Not applicable |

(W9–W11 are replaced by the FAQ entry M11 and the homepage "Terms apply." links in section 4a.)

**Sign-off (Brett, 2026-10-25):** W1, W2, W3, W3a, W4, W5, W6, W7, W8, W12, W14, W15 and W16 approved; W13 approved pending attorney review.

**Attorney review:** W13 changes the customer terms. Also worth asking: whether the fine print and the once-only acceptance are a clear and prominent enough disclosure next to an advertised guarantee.

## 4a. Every guarantee and refund mention (Brett, 2026-10-24)

**Rule:** every FAQ answer, guarantee section and piece of fine print that mentions the guarantee or a refund says clearly that the guarantee and refund do **not** apply to searches for the exception brands, naming them (or linking to the current list where naming them isn't practical). No app copy changes until Brett signs off this table.

**Signed off by Brett 2026-10-25 (revised sign-off; replaces the first one).**

**The rules:**
- **Homepage: never names the brands.** "Terms apply." (linking to the FAQ entry "Does the guarantee cover every brand?", `/faq#guarantee-brands`) follows the guarantee promise in M1, M3's body and the comparison table (M5). M2 and M4 are unchanged (covered by M1's section). No fine-print line anywhere on the homepage.
- **FAQ:** the new entry M11 is added as written. M6, M7, M8, M9, M10 and M12 stay unchanged, with no fine-print line.
- **Before payment** (the terms are stated before anyone pays):
  - every customer sees the W3 terms checkbox, with the fine-print line W3a directly under it, before their first payment;
  - exception brands also get W1 (intake), W2 (Review your search) and W5 (Stripe checkout);
  - M13: other brands are unchanged, with no extra fine print (W3a covers it).
- **Nothing says the fee is non-refundable.** The discretionary cancellation refund is the same for every brand.

**Fine-print line (FP), used only as W3a:** "Money-back guarantee does not apply to Tesla, Rivian, Lucid or Polestar."

**New FAQ entry M11 (approved), id `guarantee-brands`:**
- **Q:** "Does the guarantee cover every brand?"
- **A:** "Our money-back guarantee does not apply to Tesla, Rivian, Lucid or Polestar. These brands sell directly at prices they set, so there's no dealer discount to negotiate. We'll still find the best available price on your exact car, including demo and inventory cars and current manufacturer offers, and handle the order for you."

| # | Place (file) | Current text | Proposed text |
|---|---|---|---|
| M1 | Homepage guarantee section, paragraph (`guarantee.tsx`) | "If we can't bring you at least one real offer below Total SRP — the full sticker price, including destination, before tax, title, and fees — within 30 days of your search going live, you get your $699 back. No questions asked. And you're never obligated to buy anything, even if we do find you a great deal." | **Approved:** "Terms apply." (link to the FAQ entry) after the guarantee promise. |
| M2 | Homepage guarantee timeline, Day 30 card (`guarantee.tsx`) | Title "Offer guaranteed"; body "At least one real offer below Total SRP, or your $699 back." | **Approved:** unchanged (covered by M1's section). |
| M3 | Homepage "Why LEVR" card (`why-levr.tsx`) | Title "One flat fee, refundable if we don't deliver."; body "You know the cost upfront — no surprises." | **Approved:** body "You know the cost upfront — no surprises. Terms apply." (link). |
| M4 | Homepage "How it works", step 4 (`how-it-works.tsx`) | "Either way, you're covered by our guarantee." | **Approved:** unchanged (covered by M1's section). |
| M5 | Homepage comparison table, "If it doesn't work out" (`comparison-table.tsx`) | "Your money back if we don't find an offer below Total SRP" | **Approved:** unchanged; "Terms apply." (link) under the table. |
| M6 | FAQ "What if you can't get me a deal below Total SRP?" (`faq/page.tsx`) | "You get your full $699 back. Your 30-day guarantee window starts when your search goes live, and if it ends without a qualifying offer, we process your refund — no need to ask for it." | **Approved:** unchanged. |
| M7 | FAQ "Why not just use a cheaper subscription tool instead?" | "…And unlike a subscription, we put our fee on the line — if we can't bring you at least one real offer below Total SRP, you get your $699 back." | **Approved:** unchanged. |
| M8 | FAQ "How long does the process take?" | "You're guaranteed at least one real offer below Total SRP within 30 days of your search going live. If you need more time to decide, your search stays open at no extra cost through day 60." | **Approved:** unchanged. |
| M9 | FAQ "What do you mean by Total SRP?" (last sentence) | "Our guarantee always compares a dealer's offer against this full number — so you're never left guessing which figure on the sticker actually counts." | **Approved:** unchanged. |
| M10 | FAQ switching "What if I change my mind about the car I want?" | "You can switch to a different make/model for a $100 fee, which restarts your 30-day guarantee window once your new search goes live." | **Approved:** unchanged. |
| M11 | FAQ, new entry | (none) | **Approved:** the entry above (id `guarantee-brands`), directly after M6. |
| M12 | Account FAQ "Need to change your search?" (`account-faq-section.tsx`) | "…it closes out your current search and starts a fresh 30-day guarantee window when the new search goes live (a $100 fee applies)." | **Approved:** unchanged. |
| M13 | Review your search, "What's included" (`review-and-pay.tsx`) | "At least one real offer below Total SRP within 30 days of your search going live, or your $699 back." | **Approved:** other brands unchanged, no extra fine print (W3a covers it); exception brands get W2. Every customer's first payment: W3 with W3a under it. |
| M14 | Checkout (Stripe page) | No guarantee text today. | **Approved:** Exception brands: W5. Other brands: none (Review your search already carries FP). |
| M15 | Switch, paid (`switch-choice.tsx`) | "Restart your 30-day and 60-day guarantee clocks when your new search goes live" / "Not carry over any offer already found on your current vehicle — the guarantee starts clean against your new pick" | **Approved:** Same, plus W6 or W7 depending on the brands. |
| M16 | Switch, free (`switch-choice.tsx`) | "…It will still restart your 30-day and 60-day guarantee clocks when your new search goes live, and any offer already found on your current vehicle won't carry over." | **Approved:** Same, plus W6 or W7. |
| M17 | Cancel card (`cancellation-choice.tsx`) | "…request a call and we'll see what we can do for you, including whether a refund makes sense given your situation." / "…this ends your search for good, without refund." | **Approved:** **Unchanged** (Brett, 2026-10-25): this is the discretionary cancellation refund, the same for every brand, not the guarantee. |
| M18 | Your Deal guarantee box (`guarantee-timeline.ts`) | Heading "Your guarantee"; lines such as "Guarantee delivered {date} — you received an offer below Total SRP.", "We didn't find an offer below Total SRP within 30 days of your search going live, so your $699 is being refunded. We'll keep searching through {date}.", "Your $699 refund was approved on {date}." | **Approved:** Normal searches: unchanged (they're covered). Exception searches: replaced by W8. |
| M19 | Email "Your LEVR guarantee was delivered" (`notifications.ts`) | "You received an offer below Total SRP within 30 days of your search going live — your guarantee is met. We'll keep working your search through {date}." | **Approved:** Unchanged: only sent for covered searches; an exception search never gets it. |
| M20 | Email "Your $699 is being refunded" (`notifications.ts`) | "We didn't find an offer below Total SRP within 30 days of your search going live, so we're refunding your $699. We'll keep searching through {date} at no cost." | **Approved:** Unchanged: only sent for covered searches. |
| M21 | Welcome / receipt email | None exists: no app welcome email, and Stripe receipts are off (a launch item). | **Approved:** When Stripe receipts are turned on, no guarantee text is added there; nothing to change now. |
| M22 | Terms (`/terms`) ⚠ **attorney review** | Placeholder: "Final terms are pending attorney review and will be published here before launch." | **Approved, pending attorney:** W13 as one clause in the standard terms the attorney reviews. |
| M23 | Customer Agreement (PandaDoc service agreement, `service-agreement-template.rtf`) ⚠ **attorney review** | "3. This acknowledgment does not affect the terms of the money-back guarantee described at signup." | **Approved, pending attorney:** "3. This acknowledgment does not affect the terms of the money-back guarantee described at signup. The money-back guarantee does not apply to searches for Tesla, Rivian, Lucid or Polestar vehicles." |
| M24 | Article generator, LEVR facts (`article-generation.ts`, approved prompt) | "LEVR's guarantee: if LEVR doesn't bring the customer at least one real offer below Total Suggested Retail Price within 30 days of the search going live, the $699 is refunded. A LEVR agent processes the refund; it is not automatic or instant…" | **Approved:** Same + "The money-back guarantee does not apply to Tesla, Rivian, Lucid or Polestar; whenever you mention the guarantee, say so. Never say the fee is non-refundable." (A change to an approved prompt.) |
| M25 | Article generator, captions rule (same file) | "…describe it only as an offer below Total Suggested Retail Price within 30 days of the search going live or the $699 is refunded — never as automatic." | **Approved:** Same + "and never as covering Tesla, Rivian, Lucid or Polestar." |
| M26 | Published article "MSRP vs. Invoice Price" (database) | Section heading "This is exactly why LEVR Auto's guarantee is built on Total Suggested Retail Price, not invoice." | **Approved:** FP added at the end of that section (a data update, like the 2026-08-26 wording migration). |
| M27 | Matchmaker | No guarantee text today. | **Approved:** W12 on exception brands' cards and detail view (section 6). |

**Not changed (agent-only, or a different subject):** the refunds-due page and the agent cancellation form (agent tools; exception searches never reach refunds-due), and the financing line in the service agreement ("…not been verified, arranged, or guaranteed by LEVR Auto").

## 5. Agent side

Working a direct-sale search is drafted in `docs/business/agent-process-reference.md`, section 11, for Brett's review. Summary:
- there's no price to negotiate;
- the agent finds the best available car: in-stock and demo cars (which can be discounted), as well as a factory order with its delivery date;
- they catch every current manufacturer offer (credits, financing and lease rates, loyalty and referral programs) and point the customer to incentive programs without promising eligibility;
- they log each option as an offer;
- they handle the order with the customer.

## 6. Matchmaker

**Recommendation:** rank exception brands normally. Matchmaker scores the vehicle (safety, range, cargo and so on), and the guarantee isn't part of that; pushing them down would make the ranking less accurate. **Decided (Brett, 2026-10-25): rank normally**, with the W12 note on their cards and detail view, so a customer who carries one through to intake isn't surprised there. Matchmaker is static, so the note reaches the site on the next deploy after the data file changes.

## 7. Order and chunks

**Where it fits:**
- **After the Phase 1 deploy, before offer-entry Chunk 1.** It's built on the Phase 1 branch like the offer-entry phase, because the offer-entry agent page needs the new state (W15). It's independent of the rest of offer entry.
- **⚠ Before Stripe goes live** (hard rule, in CLAUDE.md's launch checklist):
  - GX-1 to GX-6 built and live;
  - **real Terms of Service published (attorney-reviewed)**, because W3 asks every customer to agree to the terms before paying and today's `/terms` page is a placeholder.

**Chunks** (each reviewed before the next; wording signed off before it's built):
- **GX-1:** migration (section 3), parse-checked offline, with the read-only and grant checks and the rolled-back tests; Brett runs it.
- **GX-2:** the data file and one helper (`src/lib/guarantee-exceptions.ts`) that the server, intake and Matchmaker all read. Setting the state at payment (webhook), at the undecided-buyer pick, at switch and at correction. The standard-terms acceptance and its server-side check in `createCheckoutSession` and the paid-switch checkout. The while-inventory-lasts check (Polestar).
- **GX-3:** customer screens: W1–W8 and W12 (intake, Review your search with the terms checkbox, Stripe custom text, switch screens, Your Deal, Matchmaker), the FAQ entry and every FP placement in section 4a.
- **GX-4:** agent screens W14–W16; the agent process section; the site-language inventory.
- **GX-5:** data:
  - promote the Lucid and Polestar batches;
  - import Tesla and Rivian after their Cowork redo;
  - the first syncs (Polestar 4 first, then the others), on Brett's OK for the MarketCheck calls;
  - trim-name mappings for the listings.
- **GX-6:** terms text, after attorney review.

**Verification (disposable `claude-verify` accounts only, never Brett's or the testers'; counts back to 0 afterwards):**
- An exception-brand search on a test customer:
  - the W1 and W2 lines show;
  - a customer who hasn't accepted the terms can't start checkout (refused on the server too); after accepting once, they aren't asked again;
  - payment (Stripe test mode) stores `not_applicable` and the brand;
  - Your Deal shows W8 and no timeline;
  - the Day-30 job skips it even when back-dated past Day 30;
  - it never appears on refunds-due;
  - the agent card shows W14.
- A normal-brand search: unchanged (guarantee timeline, Day-30 met and refunded both still work).
- Removing a brand from the file after payment leaves the paid search `not_applicable`; adding a brand leaves an already-paid search of that brand `pending`.
- Switch both ways, the undecided path and the correction path: the state follows the brand, with the W6/W7 lines and no extra acceptance.
- Polestar: hidden with no listings, offered with at least one (on scratch listings under a fake model, never a real sync).
- The rolled-back SQL tests in section 3.

## 8. Not in scope

- Any change to the $699 price or the Day-60 terms for these brands.
- Promising EV incentives: agents point customers to the programs; eligibility is the customer's.
- Scout Motors and Jaguar: candidates for the list when they launch, nothing built for them now.

## 9. Answers (Brett, 2026-10-25)

1. **Don't hide** the four brands; the exception must be live before Stripe is.
2. **No brand-specific checkbox.** The exception is part of the standard terms every customer accepts once at the start. The state is still set whenever the brand is set, with no extra acceptance at those points. Plain lines ("Our money-back guarantee does not apply to {Brand}.") where the brand matters.
3. **Undecided buyers and switchers** have already accepted the terms; no agent confirmation or separate box.
4. **Polestar:** offered while inventory lasts, no Cowork pass, hidden automatically with no listings; first sync planned, no calls without Brett's OK.
5. **Tesla and Rivian:** Cowork redoes the research.
6. **Wording:** only say the guarantee does not apply; never that the fee is non-refundable; the discretionary cancellation refund is unchanged for every brand. FAQ entry, fine print and the terms clause as in sections 4 and 4a.
7. **Watch list details:** in the offer-entry plan, section 4.E.
8. **Wording table: signed off 2026-10-25** (section 4a). The homepage never names the brands ("Terms apply." links to the FAQ). The fine-print line is used only under the terms checkbox. M23 is revised. W13, M22 and M23 are pending attorney review.
9. **Polestar first sync: done 2026-10-25** (section 2).
