# Build completion roadmap (added 2026-10-14, Brett)

The final steps once building is complete, in this order, **before costing out running the business**.

## 1. Final full review
A detailed review document covering every process, every step, and every piece of customer-facing and agent-facing language across the whole site:
- the customer journey (intake, sign-up, payment, finalize, Your Car, Your Deal, messages, account settings, cancellation, switching, purchase, survey);
- every email (customer and agent);
- the agent dashboard and every internal page (`/agent`, `/internal/*`);
- error messages and empty states.

Organized so Brett can go through it in order and leave a final comment on each item. Built from the two running documents below plus a pass over the code for anything they missed.

## 2. Agent training and reference materials
- Complete onboarding and training for new agents.
- A quick-reference set ("how do I…") for day-to-day tasks.
- Matched to the roles: agent, lead, admin (what each can and can't do).

Built from the agent process reference below.

## System models (part of 1 and 2; added 2026-10-14, Brett)
Both the final review and the agent training/reference materials include flowcharts showing decisions and processes, plus systems-engineering models. They're written in **Mermaid** (renders on GitHub, lives in the repo) under **`docs/business/system-models/`**. The set:
- **Context diagram:** the system boundary and every external system and actor.
- **Use cases by role:** customer, agent, lead, admin, scheduled jobs.
- **Activity flowcharts with decision points** for each major process: the customer journey, offer entry, refunds, call resolution, invite / sign-in / two-factor reset.
- **State machines:** search, offer, call request, agent account, alert.
- **Sequence diagrams** for cross-system hand-offs: payment → webhook → assignment → alert email; the hourly sweep; switches.
- **Requirements traceability matrix:** each decision Brett has made → where it's implemented → which test verifies it.

**Pilot first** (after the Chunk 8 rehearsal is reviewed), from Phase 1 only: the context diagram, the search state machine, the payment-to-assignment sequence diagram, and the traceability matrix for the agent assignment and sign-in decisions. Brett chooses the notation and level of detail from it before the set is extended. After that, the models are kept current as later work is approved, the same way as the two running documents.

## 3. Then: cost out running the business
Only after 1 and 2 are done.

## Running documents (start once Chunk 6 is wrapped, then update as each chunk is approved)
- **`docs/business/site-language-inventory.md`:** every piece of approved wording, grouped by page, flow or email, with where it appears and the date approved.
- **`docs/business/agent-process-reference.md`:** each agent workflow as it's built (what it's for, who can do it, step by step, what the customer sees), written for agents rather than developers.

Both are backfilled first with everything already approved in agent dashboard Phase 1: sign-in, invites, two-factor, resets, Add-agent, alerts, refunds, call resolution. They're kept out of the way of the chunk in progress.

## Future items

- **AI streamlining review** (added 2026-10-16, Brett). Catalog every way AI could further streamline the business:
  - **Content:** video editing and clips, captions, social drafts.
  - **Customer help:** an AI assistant on the website, with handoff to an agent.
  - **Agent work:** dealer outreach drafting, quote parsing, pre-call summaries, attention flags.
  - **Operations:** survey insights, dealer responsiveness, research data checks.
- **Matchmaker scoring robustness** (added 2026-10-16, Brett). Scores are relative within a body-style class, so one outlier added to a class shifts other cars a lot. Adding the Fiat 500e (rear legroom 29.4 in., a new class low) moved every Mazda3's Comfort from 50.9 to 65.4. Consider percentile-based or outlier-capped scoring. See `docs/research/matchmaker-v21-score-changes-2026-10-16.md`.
- **"Not rated" instead of a neutral 50** (added 2026-10-16, Brett). When a vehicle has no data for a score category, show "Not rated" rather than the neutral floor score of 50 (e.g. Maserati and Lexus TZ Safety, Comfort and Reliability in v21).
- **Very long option lists** (added 2026-10-16, Brett). Revisit trims whose paint and feature lists run very long: Maserati Fuoriserie (about 45 paints and 45 features per trim), Porsche Paint to Sample and exclusive options, and any similar make. For example, group personalisation options under a collapsed section so the core choices show first. Approved as is for now; nothing built.

- **Future: other languages** (added 2026-10-24, Brett). Later, not planned or built now:
  - The website and customer forms in other languages; Spanish is the likely first.
  - Possibly bilingual agents, with a way to match a customer to an agent who speaks their language. This fits the existing idea of routing searches to agents by region or make.
  - **What it would touch:**
    - all customer-facing wording (`docs/business/site-language-inventory.md` is the list);
    - every email;
    - the dealer submission page;
    - the agent assignment rules (`assign_search`: a language match ahead of round-robin).

## From tester feedback: Terry (decided 2026-10-17, Brett)

**Status (2026-10-30):** the pickup-range wording is live (2026-10-17). Interior and options on offers, out-the-door pricing and the side-by-side comparison are built on the `offer-entry` branch (chunks 4, 9, 10, 11), not deployed. "Ask my agent" messages and the out-the-door to-do belong to the Phase 3 work queue (not started). BAE's feedback (2026-10-29): `docs/research/tester-feedback-bae-2026-10-29.md`, items 1 to 7 resolved (live 2026-10-30), item 8 (the riders question) planned. Micah (MH) (2026-10-30, em dashes): `docs/research/tester-feedback-mh-2026-10-30.md`, inventory done, sweep after the GX deploy.

Review: `docs/research/tester-feedback-terry-2026-10-17.md`. Customer-facing wording for every item needs Brett's sign-off.

**Offer-entry phase:**
- **Interior colour and included options on offers.** The agent ticks off the customer's own ranked list (colours, interiors, packages and features) when logging an offer, with a free-text "other". The customer's card and detail view show what the car has and what it lacks. Sample offers carry the same, so testers see the real layout.
- **Side-by-side offer comparison**, reusing the trim comparison table's layout (sticky label column, column widths, collapsible sections) with new rows: price, Total SRP, savings, delivery, add-ons, **the dealer's out-the-door total**, trim, colour, interior, included options, distance. Built after the two items around it.
- **Out-the-door pricing is part of every offer, built on top of the sticker price** (Brett, 2026-10-17; replaces "out-the-door quotes tracked like delivery estimates"):
  - **Price structure, on every offer, agent and customer side:**
    1. **Sticker price (Total SRP)**, always recorded. The guarantee is measured against it.
    2. **Negotiated vehicle price** (the offer), with the discount against sticker shown as an amount and a %.
    3. **In addition:** sales tax, title and registration, doc fee, delivery (if any) and add-ons. These sum with the vehicle price to **the dealer's out-the-door total**.
  - **The guarantee check compares only the negotiated vehicle price to sticker.** Taxes, fees, delivery and add-ons never count toward it.
  - **What the agent records:** when a dealer submits an offer, the dealer's itemized breakdown (doc fee, sales tax, title and registration, delivery, add-ons) and the dealer's out-the-door total.
  - **Rule: requested with every offer, required before acceptance.** An offer may be logged without it. The customer then sees "Out-the-door quote requested" on that offer, and acceptance, including any deposit step, can't be completed until it's recorded.
  - **Where it shows:**
    - offer card: sticker, price and discount;
    - offer detail and acceptance: the full breakdown and the out-the-door total;
    - side-by-side comparison: all three levels.
  - **The tax, title, registration and fee numbers come from the dealer.** (Later, 2026-10-18: OE-3 plans an "our estimate" sales tax and title figure, labelled as estimates that never unblock acceptance; parked until the tax research exists.)
  - **Wording to settle when it's built** (all needs Brett's sign-off): the "requested" state, the breakdown labels, the acceptance block, and whether the card's "Excludes tax, title, registration, doc fee and add-ons" line changes once a total exists.
  - **FAQ "What will I actually pay?" redraft, for sign-off once the feature is built** (the live text stays until then):
    > "Every offer shows three things: the sticker price (Total Suggested Retail Price), the price your agent negotiated for the car, and the dealer's out-the-door total. The out-the-door total adds sales tax, title and registration, the dealer's documentation fee, delivery if you need it, and any add-ons you keep, itemized by the dealer. You'll see the full breakdown before you accept. If a dealer hasn't sent it yet, the offer says "Out-the-door quote requested," and you can accept once it arrives. Our guarantee compares only the negotiated price with the sticker price. Taxes and fees never count toward it."
  - **How the code records sticker and checks the guarantee today** (checked 2026-10-17):
    - **Recording sticker:** `qualifying_offers.msrp_cents` is required (`not null`) and is a snapshot taken when the offer is logged. Its column comment says: Total Monroney, base + factory options + destination, excluding tax, title, doc fee and dealer add-ons.
      - The agent types it in Log Offer, in a field labelled "MSRP ($) *"; the AI parser never fills it.
      - Linking a listing pre-fills it from `listings.msrp_cents` (MarketCheck).
      - Tester sample offers use the trim's dataset price (`true_starting_price_cents`, else `msrp_cents`).
    - **The guarantee check:** `is_below_msrp` is a generated column, `offer_price_cents < msrp_cents`. `evaluateOfferGuaranteeContribution` (`src/lib/guarantee.ts`) and the Day-30 job (`assessSearch`, `src/lib/guarantee-assessment.ts`) read only that column, plus the delivered/sold/responded timestamps.
      - The "Below Total SRP" badge, the savings line and the Deal-of-the-Week selector use the same column.
      - Add-ons (`offer_addons`) and delivery estimates (their own columns) are never read by any of these.
      - Delivery affects only the "Best total price" sort and the "Best value" badge.
  - **Places where add-ons, fees or delivery could still affect the guarantee today:**
    1. **Destination split off the price:** fixed 2026-10-17 (`2d4f7a4`). The AI parser folds a separately listed destination into the price, and Log Offer refuses a typed destination add-on.
    2. **What the agent types as the offer price is unchecked.** A price typed net of destination (without using an add-on line) makes an offer look further below sticker than it is. One that already includes doc fee or add-ons makes it look less so. Only the out-the-door breakdown above can catch either.
    3. **What the agent types as sticker is unchecked**, and the label says "MSRP". A base MSRP without destination and options understates sticker, so a real discount can look smaller. A sticker that includes a dealer addendum (add-ons, "market adjustment") **overstates it, which can make an offer qualify when it shouldn't.** Suggest relabelling it "Total SRP (window sticker total, no dealer addendum)" and warning when it differs from the linked listing or the dataset price (agent wording needs sign-off).
    4. **The listing pre-fill:** whether MarketCheck's `msrp` is the Monroney total, base MSRP, or includes a dealer addendum hasn't been verified. Worth checking against a few window stickers before relying on it.
  - ~~**Withdrawn offers (decided, Brett, 2026-10-17): kept as is.**~~ **Superseded 2026-10-27 (Brett):** a withdrawn offer doesn't count toward the guarantee unless the reason is "Car sold", when the sold rule decides (offer-entry plan 3.3c; built on `offer-entry`). The live site on `main` still counts withdrawn offers until offer entry deploys.
  - **Sticker integrity (approved 2026-10-17; branch `sticker-integrity`):**
    - The agent's field is now labelled "Total SRP (window sticker total, no dealer addendum)".
    - It warns, never blocks, when the typed sticker:
      - differs from the linked listing's MSRP by more than $100;
      - is more than $500 below our base price + destination for the typed trim;
      - is above our base + destination + every factory option we price, by more than the greater of $5,000 or 15%.
    - Each warning shows both numbers. Thresholds and wording are proposals awaiting Brett's sign-off. Code: `src/lib/sticker-check.ts`, `src/lib/sticker-ranges.ts`.
    - **What MarketCheck's MSRP contains** (checked 2026-10-17 against 4,125 synced listings whose trim name matches the Matchmaker dataset; no API calls):
      - It's the window-sticker total for that VIN: base + destination + factory and port-installed options.
      - Median $1,895 above our base + destination (middle half $455 to $3,894).
      - Honda, which sells almost no factory options, matches base + destination exactly in 284 listings, and is $455 above (premium paint) in many more.
      - Only 44 listings equal the base price without destination.
      - **No sign of dealer addenda as a pattern.** The larger gaps are explained by trim names covering two powertrains (Civic Sport gas and hybrid), option prices our data lacks (Ford and GM engines, cabs and beds; Honda paint priced at $0), and a few data errors (one Telluride at $438,800).
      - So a linked listing is the best check. Our own range is incomplete for some makes, which is why its upper tolerance is wide: it would flag about 4.5% of real listings, and about 4% on the low side.
      - **Limitation:** a typical $1,000 to $5,000 dealer addendum on a car without a linked listing will usually stay under the upper threshold. The offer-entry phase's itemized out-the-door breakdown is the stronger safeguard.
- ~~**No LEVR-computed tax estimate.**~~ Revised 2026-10-18: OE-3 plans labelled tax and title estimates (parked until the tax research).

**Work-queue phase (Phase 3):**
- **"Ask my agent" messages** from the customer (e.g. about other trims or options) land in the agent's queue.
- **Offers missing an out-the-door quote** shown as a to-do for the agent, like "Delivery estimates to get" on `/internal/outreach`.
- **Optional alert when a customer changes their pickup range** on a live search.

**Later, decisions for Brett:**
- **A read-only "explore" view** on a live search: trim comparison and option lists from Your Car with nothing saved.
- **Whether options can ever change on a live search** (trim, colour, options within the same make and model), and if so what happens to the guarantee and existing offers.
