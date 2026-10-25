# Plan: guarantee exceptions for direct-sale brands (Tesla, Rivian, Lucid, Polestar)

**Status:** plan only (2026-10-24). No data, app code or migration has changed. Each build chunk waits for Brett's go; every wording line waits for his sign-off; the terms change waits for attorney review.

**Decision (Brett, 2026-10-24):** Tesla, Rivian, Lucid and Polestar come back as full LEVR services at the same $699, listed as **exceptions to the guarantee**. They sell direct at manufacturer-set prices (Polestar through dealers acting as its agents at its set price), so a below-sticker offer can't be promised. Every other brand keeps the guarantee exactly as it is. This replaces three earlier decisions: Wave 2 D7 (Tesla and Rivian dropped), D8 (Lucid and Polestar held for launch decision 6), and Brett's same-day decision to drop Lucid and Polestar.

## 0. Found while planning: Tesla and Rivian can be bought today with the guarantee promised

- D7 (2026-10-14) dropped Tesla and Rivian from **configurator research only**. Both are still in the live Matchmaker dataset (Tesla 13 rows: Cybertruck, Model 3, Model Y; Rivian 19 rows: R1S, R1T, R2), and intake builds its make/model list from that dataset. So on www.levrauto.com today a customer can pick a Tesla or Rivian at intake, pay $699, and be promised the guarantee. Lucid (13 rows) and Polestar (4 rows) are the same.
- Nobody has: no search for any of the four brands exists (checked 2026-10-24), and no listings are synced for them.
- **Proposed interim fix, on `main`, needs Brett's go (app code):** hide the four brands from intake, the switch forms, the agent forms and Matchmaker until the exception ships. It's one make-level entry in `src/lib/not-offered-models.ts` (today it holds `Ford|Escape` only) and a redeploy (Matchmaker is static). Removing the entries later brings them back.

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
- **Where a search's brand is decided after payment** (these need Brett's answer, section 9):
  - an undecided buyer who pays first and picks the vehicle with an agent (`finalizeUndecidedSearch`);
  - the free make/model correction before the search starts (`updateSearchVehicle`);
  - a switch (free or $100), which creates a new search row.

  Proposal: the rule is set at the moment the brand is set or changed, using the file at that moment, and the customer must see and accept the exception first (the same agreement checkbox, or the agent records that they told the customer by phone).

## 2. Data: what each brand needs

| Brand | Matchmaker dataset (v21) | Configurator research | Configurator batch | Listings |
|---|---|---|---|---|
| Tesla | Cybertruck, Model 3, Model Y (2026), 13 rows | None in the repo (Wave 2 had no file). `tesla-configurator-full-2026-09-16.md` in the claude.ai project | none | 0 synced |
| Rivian | R1S, R1T (2026, 2027), R2 (2027), 19 rows | None in the repo. `rivian-lucid-configurator-full-2026-09-16.md` in the project | none | 0 synced |
| Lucid | Air, Gravity (2026, 2027), 13 rows | `data/mitsubishi-polestar-lucid-configurator-*-2026-10.csv` (full, re-pass, prices, pass 3) | `18841b59…`, 7 trims, unpromoted | 0 synced |
| Polestar | Polestar 4 (2026), 4 rows | same files as Lucid | `93b8f7fc…`, 2 trims, unpromoted | 0 synced |

**What's missing or stale:**
- **Tesla and Rivian:** the 09-16 research predates every rule the import now applies (the CSV format, mapping rules 1–9, the trim-name styling and "Base" re-pass, the site checks, the prices pass, the engine-facts table). It needs a Cowork pass to the current CSV format, with prices, before it can be imported. I haven't seen the two .md files: paste them, or ask Cowork for fresh files, and I'll list exactly what's missing.
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
- **Polestar's US exit after MY2026 (nearly sold out):**
  - **Recommendation:** don't spend a Cowork pass on it. Its research is already in the repo and imported (2 trims), so offer it as an exception brand only while inventory lasts.
  - When a sync shows no Polestar inventory, add a make-level entry to `data/held-models.json` and the not-offered list, which hides it from intake and Matchmaker.
  - The alternative is to skip Polestar entirely now; that costs nothing either, since no one has searched for it.

## 3. Guarantee logic (database and jobs)

**Migration GX-1 (draft for review, not written yet):**
- `customer_searches.guarantee_status` gains `'not_applicable'` (today: `pending`, `met`, `refunded`).
- New columns on `customer_searches`:
  - `guarantee_exception_make text`: the brand the exception applied to, copied from the file at payment;
  - `guarantee_exception_acknowledged_at timestamptz`: when the customer ticked the agreement box (or an agent recorded telling them).
- A trigger refuses any change of `guarantee_status` away from `not_applicable`, and refuses `met`/`refunded` on a search whose `guarantee_exception_make` is set. That way neither the Day-30 job nor a hand-written SQL update can resolve one.
- `record_payment_refund()` refuses reason `guarantee` on a `not_applicable` search; cancellation refunds stay possible, as for any search.
- The two switch functions and the vehicle-correction path set the state for the new or changed brand (section 1).
- It follows the explicit-grants rule (no new table, so only the function grants and a grant check).

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

## 4. Customer side (told before paying)

Where the exception is shown:
- **intake**, as soon as an exception make is picked (and in the pop-up sign-up flow);
- **Review your search**, where the guarantee bullet is replaced;
- **at checkout:** a required agreement checkbox on Review your search before "Continue to payment", checked again on the server by `createCheckoutSession`, which refuses without it and stores the time. Stripe's own page repeats the line;
- **the switch screens**, when switching into or out of an exception brand;
- **the FAQ;**
- **the homepage guarantee section** (a short note, so the headline guarantee claim isn't unqualified);
- **the terms.**

After payment:
- **Your Deal:** the guarantee timeline is replaced by a short box.
- **Matchmaker:** a note on the brand's cards (section 6).

**Draft wording (all for sign-off; `{Brand}` is the make):**

| # | Where | Draft |
|---|---|---|
| W1 | Intake, under the make once an exception brand is picked | {Brand} sets its own prices, so there's no negotiated discount and our money-back guarantee doesn't apply. We'll find the best available price on your exact car, including demo and inventory cars and every current {Brand} offer, and handle the order for you. |
| W2 | Review your search, in place of the guarantee bullet | No money-back guarantee on this search: {Brand} sets its own prices, so there's no negotiated discount. We'll find the best available price on your exact car, including demo and inventory cars and every current {Brand} offer, and handle the order for you. |
| W3 | Review your search, required checkbox | I understand that {Brand} sets its own prices and LEVR's money-back guarantee doesn't apply to this search. |
| W4 | Error if the box isn't ticked | Please tick the box to confirm before paying. |
| W5 | Stripe checkout page (custom text above Pay) | {Brand} sets its own prices. LEVR's money-back guarantee doesn't apply to this search. |
| W6 | Switch into an exception brand (added to the switch confirmation) | {Brand} sets its own prices, so our money-back guarantee won't apply to your new search. |
| W7 | Switch from an exception brand to any other brand | Your new search is covered by our money-back guarantee. |
| W8 | Your Deal, in place of the guarantee timeline | No money-back guarantee on this search: {Brand} sets its own prices. Your search runs through {date}, and you can extend it for $100 per 30 days. |
| W9 | FAQ question | *(replaced by M11 in section 4a)* |
| W10 | FAQ answer | *(replaced by Brett's draft, M11 in section 4a)* Earlier draft: Almost every one. Tesla, Rivian, Lucid and Polestar sell at prices they set themselves, so a negotiated discount can't be promised and our money-back guarantee doesn't apply to searches for them. Everything else about the service is the same, including the $699 fee: we find the best available price on your exact car, including demo and inventory cars and every current offer, and handle the order for you. You'll see this before you pay. |
| W11 | Homepage guarantee section, small note | *(replaced by the fine print FP, section 4a)* |
| W12 | Matchmaker card and detail note | No money-back guarantee: {Brand} sets its own prices. |
| W13 | Terms ⚠ **attorney review** | The money-back guarantee doesn't apply to searches for vehicles from manufacturers that set their own selling prices, listed on our site at the time you pay (currently Tesla, Rivian, Lucid and Polestar). Those searches are otherwise provided on the same terms and for the same fee. Whether a search is covered is fixed when you pay and isn't changed by later updates to that list. |
| W14 | Agent search card badge | No guarantee: {Brand} (direct sale) |
| W15 | Agent offer page line (offer-entry 6.1) | No guarantee for this brand. |
| W16 | Admin table, guarantee column | Not applicable |

**Attorney review:** W13 is a change to the customer terms. The homepage, FAQ and checkout lines (W1–W5, W10, W11) also qualify an advertised guarantee, so it's worth asking the attorney whether that disclosure is clear and prominent enough.

## 4a. Every guarantee and refund mention (Brett, 2026-10-24)

**Rule:** every FAQ answer, guarantee section and piece of fine print that mentions the guarantee or a refund says clearly that the guarantee and refund do **not** apply to searches for the exception brands, naming them (or linking to the current list where naming them isn't practical). No app copy changes until Brett signs off this table.

**Fine print (Brett's draft), placed next to every guarantee statement:** "Guarantee not available for Tesla, Rivian, Lucid or Polestar. See FAQ." ("FAQ" links to the new entry, `/faq#guarantee-brands`.) Below it's called **FP**.

**New FAQ entry (Brett's draft), "Does the guarantee cover every brand?"**
> Almost. Tesla, Rivian, Lucid and Polestar sell directly at prices they set, so there's no dealer discount to negotiate. We'll still find the best available price on your exact car — including demo and inventory cars and every current manufacturer offer — and handle the order, but the money-back guarantee doesn't apply and the $699 fee isn't refundable for those brands. We'll tell you before you pay.

⚠ **Flag on "the $699 fee isn't refundable":** today any customer can ask an agent about a refund when cancelling ("whether a refund makes sense given your situation"), and agents can refund at their discretion. "Isn't refundable" rules that out for these four brands and is a stronger promise than the rest of the site makes. Suggested instead: "…but the money-back guarantee doesn't apply, so there's no guaranteed refund for those brands." Keep Brett's wording if no discretionary refunds are intended for them; either way it's one for the attorney. This replaces W9/W10 in section 4; W11 is replaced by FP.

**Where both brand names can't fit** (a timeline card, a table cell), FP sits directly under the element rather than inside it.

| # | Place (file) | Current text | Proposed text |
|---|---|---|---|
| M1 | Homepage guarantee section, paragraph (`guarantee.tsx`) | "If we can't bring you at least one real offer below Total SRP — the full sticker price, including destination, before tax, title, and fees — within 30 days of your search going live, you get your $699 back. No questions asked. And you're never obligated to buy anything, even if we do find you a great deal." | Unchanged, followed by FP on its own line. |
| M2 | Homepage guarantee timeline, Day 30 card (`guarantee.tsx`) | Title "Offer guaranteed"; body "At least one real offer below Total SRP, or your $699 back." | Unchanged; FP under the timeline (covers all three cards). |
| M3 | Homepage "Why LEVR" card (`why-levr.tsx`) | Title "One flat fee, refundable if we don't deliver."; body "You know the cost upfront — no surprises." | Body: "You know the cost upfront — no surprises." + FP. |
| M4 | Homepage "How it works", step 4 (`how-it-works.tsx`) | "Either way, you're covered by our guarantee." | "Either way, you're covered by our guarantee (not available for Tesla, Rivian, Lucid or Polestar)." |
| M5 | Homepage comparison table, "If it doesn't work out" (`comparison-table.tsx`) | "Your money back if we don't find an offer below Total SRP" | Unchanged; FP under the table. |
| M6 | FAQ "What if you can't get me a deal below Total SRP?" (`faq/page.tsx`) | "You get your full $699 back. Your 30-day guarantee window starts when your search goes live, and if it ends without a qualifying offer, we process your refund — no need to ask for it." | Same, then: "This guarantee doesn't apply to searches for Tesla, Rivian, Lucid or Polestar (see below)." |
| M7 | FAQ "Why not just use a cheaper subscription tool instead?" | "…And unlike a subscription, we put our fee on the line — if we can't bring you at least one real offer below Total SRP, you get your $699 back." | Same, then: "(Except for Tesla, Rivian, Lucid and Polestar, which set their own prices.)" |
| M8 | FAQ "How long does the process take?" | "You're guaranteed at least one real offer below Total SRP within 30 days of your search going live. If you need more time to decide, your search stays open at no extra cost through day 60." | "For most brands, you're guaranteed at least one real offer below Total SRP within 30 days of your search going live (not Tesla, Rivian, Lucid or Polestar). Every search stays open at no extra cost through day 60." |
| M9 | FAQ "What do you mean by Total SRP?" (last sentence) | "Our guarantee always compares a dealer's offer against this full number — so you're never left guessing which figure on the sticker actually counts." | Same + "(The guarantee doesn't apply to Tesla, Rivian, Lucid or Polestar.)" |
| M10 | FAQ switching "What if I change my mind about the car I want?" | "You can switch to a different make/model for a $100 fee, which restarts your 30-day guarantee window once your new search goes live." | Same + "Switching to Tesla, Rivian, Lucid or Polestar means your new search has no guarantee; switching away from one gives your new search the guarantee." |
| M11 | FAQ, new entry | (none) | Brett's draft above (id `guarantee-brands`), placed directly after M6. |
| M12 | Account FAQ "Need to change your search?" (`account-faq-section.tsx`) | "…it closes out your current search and starts a fresh 30-day guarantee window when the new search goes live (a $100 fee applies)." | Same + "There's no guarantee window for Tesla, Rivian, Lucid or Polestar." |
| M13 | Review your search, "What's included" (`review-and-pay.tsx`) | "At least one real offer below Total SRP within 30 days of your search going live, or your $699 back." | Other brands: unchanged + FP. Exception brands: replaced by W2, plus the W3 checkbox. |
| M14 | Checkout (Stripe page) | No guarantee text today. | Exception brands: W5 as Stripe custom text. Other brands: none (Review your search already carries it). |
| M15 | Switch, paid (`switch-choice.tsx`) | "Restart your 30-day and 60-day guarantee clocks when your new search goes live" / "Not carry over any offer already found on your current vehicle — the guarantee starts clean against your new pick" | Same, plus W6 or W7 depending on the brands. |
| M16 | Switch, free (`switch-choice.tsx`) | "…It will still restart your 30-day and 60-day guarantee clocks when your new search goes live, and any offer already found on your current vehicle won't carry over." | Same, plus W6 or W7. |
| M17 | Cancel card (`cancellation-choice.tsx`) | "…request a call and we'll see what we can do for you, including whether a refund makes sense given your situation." / "…this ends your search for good, without refund." | **Question for Brett:** this is the discretionary refund, not the guarantee. Leave it unchanged (proposed), or, if exception-brand fees are never refundable (FAQ flag above), drop "including whether a refund makes sense" for those searches only. |
| M18 | Your Deal guarantee box (`guarantee-timeline.ts`) | Heading "Your guarantee"; lines such as "Guarantee delivered {date} — you received an offer below Total SRP.", "We didn't find an offer below Total SRP within 30 days of your search going live, so your $699 is being refunded. We'll keep searching through {date}.", "Your $699 refund was approved on {date}." | Normal searches: unchanged (they're covered). Exception searches: replaced by W8. |
| M19 | Email "Your LEVR guarantee was delivered" (`notifications.ts`) | "You received an offer below Total SRP within 30 days of your search going live — your guarantee is met. We'll keep working your search through {date}." | Unchanged: only sent for covered searches; an exception search never gets it. |
| M20 | Email "Your $699 is being refunded" (`notifications.ts`) | "We didn't find an offer below Total SRP within 30 days of your search going live, so we're refunding your $699. We'll keep searching through {date} at no cost." | Unchanged: only sent for covered searches. |
| M21 | Welcome / receipt email | None exists: no app welcome email, and Stripe receipts are off (a launch item). | When Stripe receipts are turned on, no guarantee text is added there; nothing to change now. |
| M22 | Terms (`/terms`) ⚠ **attorney review** | Placeholder: "Final terms are pending attorney review and will be published here before launch." | Add W13 to the terms draft the attorney reviews. |
| M23 | Customer Agreement (PandaDoc service agreement, `service-agreement-template.rtf`) ⚠ **attorney review** | "3. This acknowledgment does not affect the terms of the money-back guarantee described at signup." | "3. This acknowledgment does not affect the terms of the money-back guarantee described at signup, which doesn't apply to searches for Tesla, Rivian, Lucid or Polestar." |
| M24 | Article generator, LEVR facts (`article-generation.ts`, approved prompt) | "LEVR's guarantee: if LEVR doesn't bring the customer at least one real offer below Total Suggested Retail Price within 30 days of the search going live, the $699 is refunded. A LEVR agent processes the refund; it is not automatic or instant…" | Same + "The guarantee doesn't apply to searches for Tesla, Rivian, Lucid or Polestar, which sell at prices they set; whenever you mention the guarantee, say so." (A change to an approved prompt.) |
| M25 | Article generator, captions rule (same file) | "…describe it only as an offer below Total Suggested Retail Price within 30 days of the search going live or the $699 is refunded — never as automatic." | Same + "and never as covering Tesla, Rivian, Lucid or Polestar." |
| M26 | Published article "MSRP vs. Invoice Price" (database) | Section heading "This is exactly why LEVR Auto's guarantee is built on Total Suggested Retail Price, not invoice." | Add at the end of that section: "The guarantee doesn't apply to Tesla, Rivian, Lucid or Polestar, which sell at prices they set." A data update, like the 2026-08-26 wording migration. |
| M27 | Matchmaker | No guarantee text today. | W12 note on exception brands' cards (section 6). |

**Not changed (agent-only, or a different subject):** the refunds-due page and the agent cancellation form (agent tools; exception searches never reach refunds-due), and the financing line in the service agreement ("…not been verified, arranged, or guaranteed by LEVR Auto").

## 5. Agent side

Working a direct-sale search is drafted in `docs/business/agent-process-reference.md`, section 11, for Brett's review. Summary:
- there's no price to negotiate;
- the agent finds the best available car: in-stock and demo cars (which can be discounted), as well as a factory order with its delivery date;
- they catch every current manufacturer offer (credits, financing and lease rates, loyalty and referral programs) and point the customer to incentive programs without promising eligibility;
- they log each option as an offer;
- they handle the order with the customer.

## 6. Matchmaker

**Recommendation:** rank exception brands normally. Matchmaker scores the vehicle (safety, range, cargo and so on), and the guarantee isn't part of that; pushing them down would make the ranking less accurate. Their cards and detail view carry the W12 note, so a customer who carries one through to intake isn't surprised there. Matchmaker is static, so the note reaches the site on the next deploy after the data file changes.

## 7. Order and chunks

**Where it fits:**
1. **Now, on `main`:** the interim hide (section 0), if Brett agrees.
2. **After the Phase 1 deploy, before offer-entry Chunk 1.** It's built on the Phase 1 branch like the offer-entry phase, because the offer-entry agent page needs the new state (W15). It's independent of the rest of offer entry.

**Chunks** (each reviewed before the next; wording signed off before it's built):
- **GX-1:** migration (section 3), parse-checked offline, with the read-only and grant checks and the rolled-back tests; Brett runs it.
- **GX-2:** the data file and one helper (`src/lib/guarantee-exceptions.ts`) that the server, intake and Matchmaker all read. Setting the state at payment (webhook), at switch and at correction; the server-side agreement check in `createCheckoutSession` and the switch payment.
- **GX-3:** customer screens W1–W12 (intake, pop-up sign-up, Review your search, the checkbox, Stripe custom text, switch screens, Your Deal, FAQ, homepage note, Matchmaker note).
- **GX-4:** agent screens W14–W16; the agent process section; the site-language inventory.
- **GX-5:** data:
  - promote the Lucid batch, and Polestar's if Brett keeps it;
  - import Tesla and Rivian after their Cowork pass;
  - the first syncs, on Brett's OK for the MarketCheck calls;
  - trim-name mappings for the listings;
  - remove the interim hide.
- **GX-6:** terms text, after attorney review.

**Verification (disposable `claude-verify` accounts only, never Brett's or the testers'; counts back to 0 afterwards):**
- An exception-brand search on a test customer:
  - the W1 and W2 lines show;
  - checkout is refused without the box;
  - with the box, payment (Stripe test mode) stores `not_applicable`, the brand and the acknowledgement time;
  - Your Deal shows W8 and no timeline;
  - the Day-30 job skips it even when back-dated past Day 30;
  - it never appears on refunds-due;
  - the agent card shows W14.
- A normal-brand search: unchanged (guarantee timeline, Day-30 met and refunded both still work).
- Removing a brand from the file after payment leaves the paid search `not_applicable`; adding a brand leaves an already-paid search of that brand `pending`.
- Switch both ways, the undecided path and the correction path, each with its disclosure.
- The rolled-back SQL tests in section 3.

## 8. Not in scope

- Any change to the $699 price or the Day-60 terms for these brands.
- Promising EV incentives: agents point customers to the programs; eligibility is the customer's.
- Scout Motors and Jaguar: candidates for the list when they launch, nothing built for them now.

## 9. Questions for Brett

1. **Interim hide (section 0):** hide all four brands from intake and Matchmaker on `main` now, until GX ships? (Recommended; app code, needs your go.)
2. **When the rule is set after payment:** at the moment the brand is set or changed (undecided buyer, correction, switch), with the disclosure accepted first. Agree?
3. **Undecided buyers:** they pay before choosing a brand. The agent must tell them about the exception before setting an exception brand, and record that they did. OK, or should those customers pick on the site and tick the box themselves?
4. **Polestar:** offer it while inventory lasts (recommended), or skip it now?
5. **Tesla and Rivian research:** paste the two 09-16 files or have Cowork redo them in the current CSV format with prices (recommended: redo).
6. **Matchmaker:** rank normally with the W12 note (recommended)?
7. **"The $699 fee isn't refundable"** in the new FAQ entry: keep it (no discretionary refunds for these brands either), or the softer "no guaranteed refund"? (section 4a, and M17.)
8. **Sign-off:** section 4's W1–W8 and W12–W16, and section 4a's M1–M27 and FP.
