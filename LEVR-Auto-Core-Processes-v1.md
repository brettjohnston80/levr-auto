# LEVR Auto — Core Business Processes (Working Draft v1, updated with flat pricing + switching policy)

*This is a working draft to think through and iterate on — not legal advice, and not ready to use with real customers until an attorney has reviewed it (especially the guarantee/refund language and the broker-licensing question still pending).*

---

## 1. The Guarantee — Precise Definition

This is the single most important piece of language in the whole business, because it's the promise everything else hangs on. Ambiguity here creates disputes later.

**"MSRP" means:** the Total Manufacturer's Suggested Retail Price as printed on the vehicle's federally mandated Monroney label (window sticker) for that exact VIN — base MSRP, plus factory-installed options/packages, plus the manufacturer's destination/delivery charge. It does **not** include: sales tax, title/registration/license fees, dealer documentation fees, or any dealer-added addendum items (accessories, "market adjustment," paint protection, etc.).

*Why define it this way:* customers colloquially think of "MSRP" as "the full sticker price before tax and title." Using the Total MSRP line (including destination) matches that expectation and avoids a customer feeling tricked by a technicality. The negotiated price you compare against it should also exclude tax/title/license/doc fees — apples to apples, government and admin fees stripped out of both sides.

**"Qualifying Offer" means:** any offer, from any dealer nationwide, where the total negotiated vehicle price (as defined above, excluding tax/title/license/doc fees) is lower than that vehicle's MSRP (as defined above). One qualifying offer, on any vehicle matching the customer's specified make/model/trim/required options, satisfies the guarantee — regardless of color, regardless of whether the customer likes that particular offer, and regardless of whether the customer ultimately buys anything at all.

**Timing:** the guarantee is assessed at **Day 30** from solidification — when the customer's refinement window closes and their make/model/trim/color/options are locked in (see Section 3, Phase A, step 3), not from when the fee is paid (step 2). The clock starts once the search criteria that determine what counts as a Qualifying Offer are final. If at least one Qualifying Offer has been presented by then, the guarantee is met and the fee is earned/non-refundable — even if the customer declines it. If zero Qualifying Offers have been presented by Day 30, the fee is refunded in full, automatically, within about a week (up to 7 days, accounting for holidays/weekends), without the customer needing to request it.

Either way — guarantee met or refunded — LEVR Auto continues fielding offers through **Day 60** at no additional cost; this is part of what the customer signed up for, not conditional on the Day 30 outcome. If a refund already went out and a Qualifying Offer later shows up before Day 60, the customer keeps both the refund and the offer. The customer can opt to stop receiving notifications and further negotiation at any point before Day 60 if they'd rather be done.

**Past Day 60:** the customer can pay an additional **$100** to continue active searching for another fixed period (~30 days), renewable indefinitely at $100 per period. These extension periods aren't attached to a new guarantee — the original below-MSRP promise was already resolved at Day 30.

**Sold-to-someone-else edge case (resolved):** the customer gets a 24-hour response window from when a Qualifying Offer is delivered. If the customer doesn't respond within 24 hours and the unit sells before they do, the offer still counts — the guarantee is satisfied. If the customer responds within the window but the unit sells before the deal goes through anyway, it doesn't count, and LEVR keeps searching.

---

## 1a. Pricing

- **Flat $699** — one make and model, with full flexibility on trim, color, and options within it. The intake form needs to support inclusion/exclusion logic (e.g., "EX or Limited trim, any color except black") — this flexibility is free and unlimited within a single make/model, no fee, no cap on how often it's adjusted.
- No concurrent-search tiers — LEVR searches exactly one make/model per engagement, always, for the flat fee. A customer who wants a different vehicle uses the switching policy below (1b) instead of paying for a second concurrent search.

*Not on the landing page* — this lives in the FAQ/terms only, per your call.

---

## 1b. Switching Policy

Customers can change which make/model they're searching for mid-engagement — but not for free, and not without limits, to avoid the system getting gamed.

- **First 5 days after signup (unadvertised grace period):** one free switch, no fee. Not mentioned anywhere public — internal policy only.
- **After the grace period, or for a second switch within it:** switching costs **$100** and **resets both the Day 30 and Day 60 clocks** for the new make/model. The customer is effectively starting a new engagement on the new vehicle.
- **Guardrail:** switches happen through a single "Change Request" action in the customer's dashboard — never a silent edit to the original intake. This creates a clean record of what was requested and when, which matters both for your own tracking and if a customer ever disputes what they asked for.
- Trim/color/option adjustments *within* the same make/model are not "switches" — those stay free and unlimited under section 1a, since the make/model itself hasn't changed.

---

## 2. Customer Agreement — Working Outline

Sections you'll want, with a few drafted as starting language and the rest flagged for attorney input:

**2.1 Parties & Definitions** — LEVR Auto, "Customer," "MSRP," "Qualifying Offer," "Negotiation Window" (definitions from Section 1 above go here).

**2.2 Scope of Services** *(draft language)*: "LEVR Auto searches nationwide dealer inventory matching the Customer's specified vehicle criteria, contacts dealers on the Customer's behalf to solicit pricing, and presents resulting offers to the Customer. LEVR Auto is not a party to any vehicle sale, does not take title to any vehicle, and does not receive compensation from any dealer in connection with a Customer's purchase [pending legal confirmation of exact wording needed for broker-licensing purposes]."

**2.3 Fee & Payment** *(draft language)*: "Customer agrees to pay LEVR Auto a flat fee of $699 for one make/model, due upon Customer's election to proceed after initial intake, in exchange for the services described in Section 2.2."

**2.4 The Guarantee** — insert Section 1 definitions and refund mechanics.

**2.5 Negotiation Window** *(draft language)*: "LEVR Auto will actively search and negotiate on Customer's behalf for 30 days from the date Customer's search criteria are finalized (the close of the 24-hour Refinement Window described in Section 3, Phase A), at which point the guarantee in Section 2.4 is assessed and, if applicable, refunded within approximately 7 days. Regardless of outcome, LEVR Auto will continue searching and presenting offers through Day 60 (measured from the same date) at no additional cost, unless Customer opts out earlier. Thereafter, Customer may pay $100 per additional ~30-day period to continue the search, renewable indefinitely."

**2.5a Switching** — insert Section 1b switching policy and grace-period terms.

**2.6 No Obligation to Purchase** *(draft language)*: "Customer is under no obligation to accept any offer presented, including a Qualifying Offer, and may decline all offers without affecting the fee already paid."

**2.7 Customer Obligations** — accurate vehicle specs at intake, timely responses to offers, notice of any change in specs/budget.

**2.8 Limitation of Liability** — flag for attorney: LEVR Auto isn't responsible for dealer conduct, financing approval, vehicle availability at time of close, or the terms of the eventual sale contract, which is strictly between Customer and dealer.

**2.9 [Reserved] Legal Characterization Clause** — exact wording depends entirely on the outcome of the state-by-state broker/dealer-licensing research. Don't draft this section until that comes back.

**2.10 Data & Privacy** — how Customer's personal/financial info is used, stored, and shared with dealers during negotiation.

**2.11 Termination** — either party may end the engagement; effect on fee/refund.

**2.12 Governing Law & Disputes** — likely Kansas law; consider whether arbitration makes sense.

---

## 3. Core Operational Workflow

The step-by-step path from a customer landing on the site to a closed deal:

### Phase A — Discovery & Signup

1. **Browse** — Customer starts at the intro page, hits "Get Started," and moves through a progressive filter: make → model → trim → color → other options, plus zip code (captured for accurate tax/registration-fee calculations, not shown to dealers beyond state/region). A live, nationwide inventory count narrows with each filter (e.g. "40,000 Toyotas" → "5,000 Highlanders" → "400 in black/white/gray" → "20 matching this trim"). No specific dealers are shown at this stage. *(Phase 2 feature, once real deal data exists: show an average-savings stat per make/model, e.g. "we help customers save $X off MSRP on a Highlander," sourced from actual completed deals and refreshed weekly/monthly.)*
2. **Account & Payment** — Customer creates an account and pays the flat $699 fee.
3. **Refinement Window** — Customer has up to 24 hours to fine-tune trim/color/option details (make/model is locked at this point — changing it requires the switching process). If they don't return to confirm, the system auto-solidifies using their original selections after 24 hours. Search doesn't start until solidification. **The Day 30/Day 60 guarantee clock starts here, at solidification — not at payment in step 2.** The customer has locked in every decision that determines what counts as a Qualifying Offer before the clock starts; assessing from payment would start it before the search criteria are even final.

### Phase B — Search & Offers

4. **Sourcing** — System queries nationwide inventory data for matching vehicles across dealers.
5. **Outreach** — System contacts matching dealers requesting their best out-the-door price on the specific unit. *(Template below.)*
6. **Capture** — Dealer replies are parsed (price, terms, unit details, itemized add-ons) and logged as a structured Offer. *Dealer offers must be complete and itemized — no undisclosed fees added beyond financing-related terms (interest rate is fine; a surprise "no trade-in" fee tacked on later is not).*
7. **Early Notify** — Before individual offers land, the dashboard shows a regional/state-level summary of active outreach only (e.g. "10 dealers on the West Coast, 5 in the Midwest") — no specific dealer names.
8. **Offer Notify** — As real Offers arrive, the dashboard shows full detail per offer: the dealer's city, a photo of the actual car from the dealer's site, itemized price, and any dealer add-ons.
9. **Add-On Negotiation (optional)** — Customer can flag specific dealer add-ons for removal; the request routes to the dealer, who can accept, decline, or counter. No cap on rounds.
9a. **Change Request (if applicable)** — Customer submits a Change Request to switch make/model via the dashboard. System checks whether it falls inside the 5-day grace period (free, one-time) or requires the $100 fee; on approval, resets Day 30/Day 60 clocks and restarts sourcing/outreach for the new vehicle.

#### Outbound Dealer Message — Draft Template

*This is the human-readable message a salesperson actually reads — whether it lands as the "comments" field in an ADF/XML lead or as a fallback plain email depends on what the outreach spike proves works (still an open technical item). Either way, the wording matters, since this is what determines whether a dealer takes it seriously.*

> **Subject:** Buyer Inquiry — {{Make}} {{Model}} — LEVR Auto
>
> Hi {{Dealership Name}} Sales Team,
>
> I'm reaching out on behalf of a verified, ready-to-buy customer through LEVR Auto (levrauto.com), a service that helps car buyers nationwide find and negotiate their next vehicle.
>
> Our customer is specifically looking for:
> - **Make/Model:** {{Make}} {{Model}}
> - **Trim(s):** {{Trim}}
> - **Color(s):** {{Color}}
> - **Additional options:** {{Options}}
>
> They're located in {{Customer State/Region}} and ready to move forward quickly with the right offer.

*Internally, the system captures the customer's full zip code at intake — needed for accurate tax/registration-fee calculations — but only state/region is ever exposed to dealers, consistent with the privacy approach elsewhere in this doc.*
>
> Could you send your best out-the-door price for a matching unit currently in stock? To help us present a clear offer, please include:
> - A full itemized price (vehicle price, destination, and any dealer-added items called out separately — not bundled in)
> - VIN and a photo of the specific unit, if available
> - Confirmation the vehicle is currently in stock
>
> We're reaching out to multiple dealers with matching inventory, and our customers can see itemized pricing and request specific add-ons be removed — so a clean, itemized quote gives you the best shot at winning this sale. We'd also ask that any add-on fees be disclosed upfront rather than added after the customer selects your offer.
>
> You can reply directly to this email — it routes straight to the customer's offer dashboard.
>
> Thanks for your time,
> LEVR Auto
> {{Reply Email}} · levrauto.com

*Placeholders ({{...}}) get filled per-deal by the system. Once there's a real logo/brand kit, this probably deserves an HTML version — plain text is the right starting point for testing deliverability and response rates.*

### Phase C — Acceptance & Close

10. **Acceptance** — Customer accepts an offer: a "congratulations" moment, clear next-step messaging (dealer contacted, confirmation expected within [X]), and a small refundable deposit collected to help reserve the car.
11. **Availability Re-Confirmation** — Before finalizing, the dealer confirms the specific unit is still on-site/available. Dealers must immediately revoke or update an offer if the car sells to someone else first — this needs to be an explicit term in the dealer-facing agreement, not just a hope.
12. **Financing Path** — Customer chooses: (a) bringing their own financing — upload proof (pre-approval letter, bank statement, etc.) or (b) wants help — submits a financing *preference* form (income range, down payment, desired term). This is self-reported information, not a credit pull — see note below.
13. **LEVR Documents** — Customer e-signs LEVR Auto's own required paperwork virtually (service completion, financing-preference record, trade-in disclosure if applicable).
14. **Dealer Paperwork** — The actual purchase contract, financing application/credit pull (if applicable), and title work happen directly between Customer and dealer — ideally through the dealer's own virtual/e-contracting system where they offer one. LEVR Auto supports and coordinates but isn't a party to that contract.
15. **Delivery/Pickup** — Customer chooses in-person pickup or delivery. For delivery, LEVR Auto helps coordinate a transporter — for now, a concierge referral to established car-shipping services, no fee. *(A bidding marketplace with a coordination fee is a later-stage build, not v1.)*
16. **Human Assist (optional, any step)** — Customer can request a callback instead of doing a step online. Near-term this is manual; a more scaled/automated support layer is planned but not designed yet.
17. **Close** — Dealer finalizes the sale directly with Customer; LEVR Auto's engagement on that deal ends.
18. **Guarantee Check** — At Day 30, if no Qualifying Offer was presented, the automatic refund process triggers (Section 1).
19. **Archive** — Deal record closed out; optional feedback request.

> **Compliance note on financing:** actually pulling a credit report is a regulated activity under the Fair Credit Reporting Act — it requires a "permissible purpose" relationship with a credit bureau, which in practice means going through a compliant vendor (e.g. a soft-pull prequalification API) or a licensed lending partner, not something to build in-house from scratch. That's exactly why the plan for now is to capture financing *preference* and *documentation* only, and add real credit-pull/lender integration later once that partnership exists.

---

## Still open, worth flagging

- Section 2.9 waits on the state licensing research.
- Trademark clearance on "LEVR" is still pending — affects how much you want to commit to this name in signed customer contracts before that comes back.
- Lender referral fees and the transporter marketplace fee are intentionally not built into v1 — the workflow captures the data/coordination now, monetization on both gets designed once real lender/transporter partnerships exist.
- Scaled/automated customer support (Step 12) is a stated direction, not yet designed — worth its own pass once the core build is further along.
