# LEVR Auto — Business Plan & Launch Roadmap

*Master document — pulls together everything already drafted (Core Processes, Website Copy, Developer Brief, Dealer Agreement) into one outline, then lays out a prioritized, sequenced action plan to actually launch.*

---

## Progress Log

**Aug 1, 2026 — Landing page built and deployed.** Next.js + Tailwind marketing site built solo in one evening using Claude Code, based on the Developer Brief and Website Copy docs. Includes the full intake filter (make/model/trim/color/options, live tier pricing, zip validation) as a working front-end UI — no backend/payment/DB yet, by design. Pushed to GitHub (`brettjohnston80/levr-auto`), deployed on Vercel, and connected to the live `levrauto.com` domain (DNS now correctly pointed after resolving a Namecheap URL-redirect-record conflict). Next up: trademark attorney outreach, MarketCheck contact, and the dealer outreach spike — see Stage 0/1 above.

---

## PART 1: BUSINESS OUTLINE

### 1. Concept & Positioning

LEVR Auto is a nationwide service that negotiates new-car deals on the buyer's behalf. Customers tell LEVR what they want; LEVR sources inventory across dealers nationwide, negotiates by email, and delivers offers to a dashboard — with a money-back guarantee if no below-MSRP offer shows up in 30 days.

- **Name:** LEVR Auto (pronounced "Lever") — leverage belongs with the buyer.
- **Tagline:** "Car buying, with the leverage on your side."
- **Tone:** pro-buyer, not anti-dealer. Dealers are a partner in the transaction, not an adversary in the marketing.

### 2. Business Model

**Pricing (per search engagement):** Flat **$699** for one make/model, with unlimited free flexibility on trim/color/options within it. No concurrent-model tiers — one vehicle per engagement, always.

**The Guarantee:**
- "MSRP" = Total MSRP on the Monroney label (base + factory options + destination) — excludes tax/title/doc/dealer add-ons.
- "Qualifying Offer" = any dealer offer below that MSRP on a matching vehicle.
- Assessed at **Day 30** from solidification (when the customer's 24h refinement window closes and search criteria lock in) — not from payment. No qualifying offer → automatic full refund within ~7 days. Qualifying offer found → fee earned, whether or not the customer buys.
- Either way, active search continues **free through Day 60**.
- After Day 60: **$100** per renewable ~30-day extension.

**Switching make/model:** $100, resets Day 30/60 clocks — except one free switch in an unadvertised 5-day grace period after signup.

**Revenue streams held for later (not v1):**
- Lender referral fees (financing data is captured now; monetization added once a compliant vendor partnership exists — actual credit pulls are FCRA-regulated).
- Transporter marketplace fee (concierge referral only for now).
- Dealer subscription/lead-marketplace (Stage 3) — dealers pay to see active regional buyer demand and bid in.

### 3. Customer Journey

1. Landing page → progressive intake filter (make → model → trim → color → options → zip) with a live nationwide inventory count.
2. Account creation + payment. Guarantee clock starts here.
3. 24-hour refinement window (trim/color/options only — make/model locked); auto-solidifies if untouched.
4. Sourcing + outreach begin. Dashboard shows regional summary only at first ("10 dealers West Coast, 5 Midwest").
5. Offers land: dealer city, car photo, itemized price/add-ons shown.
6. Customer can request add-on removal; unlimited back-and-forth with dealer.
7. Acceptance → refundable deposit → dealer re-confirms availability → financing path → LEVR e-sign → dealer's own paperwork → delivery/pickup → close.
8. *(Later)* Landing page shows real average-savings-by-model stats once deal data exists.

### 4. Technical Plan

- **Stack:** Next.js + Supabase (DB/auth/storage) + Vercel, built with Claude Code, friend doing the coding.
- **Inventory data:** MarketCheck API (not yet contacted).
- **Outreach:** email-only at launch, likely ADF/XML lead format or dealer web-form-fill — **mechanism unproven, needs a real-world test.**
- **Reply parsing:** Claude API turns freeform dealer replies into structured offers.
- **Payments:** Stripe. **E-sign:** DocuSign/PandaDoc.
- Suggested build order: auth/intake/payment → inventory matching → outbound outreach engine → inbound parsing/dashboard → change-request logic → financing/documents → delivery → admin views.

### 5. Entity, Legal & Brand Status

| Item | Status |
|---|---|
| Kansas LLC | Submitted (~$85) |
| Domains | levrauto.com/.net/.co purchased (~$31) |
| Trademark clearance ("LEVR") | **Not started (attorney opinion) — preliminary free search done Aug 1, 2026.** Findings: (1) **LEVR — Black Rock Innovations LLC**, filed Jan 2024, SaaS serial #98369125, for OEM project/resource management software in industrial/**automotive**/aerospace — exact word match, touches automotive, appears live — highest-priority conflict to flag with the attorney. (2) LEVR — skyTran Inc. (maglev transit) — abandoned May 2023, low risk. (3) LeVR — 2015 filing (electronics), abandoned, low risk. (4) Lever Auto — operating auto-dealer floor-plan financing co. since 2020, domain leverauto.com, phonetically identical, no federal filing found but real common-law use in the auto-dealer space. (5) Levr.ai / Levr Finance — Canadian fintech lending platform, active US commerce, no federal filing found under "Levr" itself. |
| State broker/dealer licensing survey | **Not started** — CA and NY confirmed stricter |
| Customer agreement | Drafted, not attorney-reviewed |
| Dealer agreement | Drafted, not attorney-reviewed |

**Total spend to date: ~$116.** Budget ceiling: <$10k for first 3–6 months, part-time nights/weekends.

---

## PART 2: PRIORITIZED ROADMAP

The build is not the risky part — it's well-specified. The two things that could actually kill this business are (a) a legal structure problem discovered *after* you're taking customer money, and (b) discovering the outreach mechanism doesn't work only after the full platform is built around it. Both of those get tested cheaply and early, in parallel with everything else.

### Stage 0 — De-risk before spending real time (next 1–2 weeks)

1. **Trademark clearance — now the top priority, not a "before Stage 1" nice-to-have.** A preliminary free search (Aug 1, 2026) surfaced a live-looking federal application for the exact word "LEVR" (Black Rock Innovations LLC, filed Jan 2024, SaaS for automotive/aerospace/industrial OEM project management) plus a confirmed operating company using "Lever Auto" in the auto-dealer space since 2020 (leverauto.com). Get the paid clearance opinion ($300–500) now, specifically asking the attorney to weigh in on the Black Rock Innovations conflict — before spending more on branding, signing any customer contract, or investing further build time under this name.
2. **Get 2–3 attorney quotes for the state licensing survey.** Search "dealer broker license" + your state, or ask in a small-business/startup legal marketplace (e.g., a fixed-fee service or a local business attorney) for a 50-state (or top-15-state) survey on whether what LEVR does counts as vehicle brokering and what's required. This gates Section 2.9 of the customer contract and affects which states you can even operate in at launch — so it's worth doing before, not after, soft launch.
3. **Resolve the open guarantee edge case now, not later:** does a Qualifying Offer that sells to someone else before the customer decides still count toward the Day 30 guarantee? Pick a position (recommend: yes, it counts — the offer existed and was real; the buyer's delay isn't LEVR's failure) and add it to the Core Processes doc so it's not an open question when a real customer hits it.

### Stage 1 — Prove the riskiest technical assumption (weeks 1–4, parallel to Stage 0)

4. **Outreach spike.** Before any more building, manually (or with a lightweight script) send your draft outreach email/ADF-XML lead to 30–50 real dealers for a real or test vehicle spec and see what comes back: response rate, format, how usable the replies are for parsing. This determines whether the whole "email-only, AI-parsed" model is viable or needs rethinking (e.g., a human-in-the-loop fallback for the first few months). Do this before your friend builds the outreach engine around an untested assumption.
5. **Contact MarketCheck** for API access and pricing. This is a hard dependency for sourcing — get the quote and confirm coverage (all makes, dealer contact data availability) early so it doesn't block Stage 2.
6. **Define a dealer response-time standard** (e.g., "we expect a reply within 24–48 hours, follow up once, then mark unresponsive") — needed both for the dealer agreement and for how the dashboard communicates timing to customers.

### Stage 2 — Core build (weeks 2–10, once Stage 1 confirms the outreach mechanism works)

7. Hand your friend the existing docs via a `CLAUDE.md` in the GitHub repo (Claude.ai Projects isn't available on your plan tier for this).
8. Build in the order already specified in the Developer Brief: auth/intake/payment → MarketCheck integration → outreach engine → inbound parsing/dashboard → change-request logic → financing/document flow → delivery coordination → minimal admin views.
9. Get Stripe, Supabase, and DocuSign/PandaDoc accounts set up early so integration isn't blocked mid-build.
10. Attorney review of the customer agreement and dealer agreement should land *before* this stage finishes — not after — so contract language isn't retrofitted onto a live product.

### Stage 3 — Soft launch (once build + legal are both ready)

11. Launch narrow on purpose even though the *system* is nationwide/all-makes: pick a small number of real customers (friends-of-friends, local network) to run through the full flow manually-assisted if needed, before opening broadly. This catches process gaps (dealer non-response handling, edge cases in the dashboard) with low stakes.
12. Track real outcomes from these first deals — they're also the seed data for the "average savings by model" stat planned for the landing page later.

### Stage 4 — Deferred revenue streams (post-launch, once core loop is proven)

13. Lender referral partnership (compliant vendor for actual credit pulls).
14. Transporter marketplace fee.
15. Dealer subscription/portal (Stage 3 concept in the Core Processes doc) — dealers see regional buyer demand and bid in directly.
16. Scaled/automated customer support layer — direction is set, design work hasn't started.
17. **In-house review video content** (see Future Feature Ideas below) — real scope shift into media production, deferred deliberately.

---

## Future Feature Ideas

### AI Vehicle Matchmaker (candidate for Stage 2/3 — pre-negotiation discovery tool)

**Concept:** A guided quiz — dropdown/selector questions plus one free-text field — that recommends 2-3 specific make/model/trim options from LEVR's own database, each with a rationale and links to trusted third-party review videos. Deliberately *not* open free-text-only, and *not* a live internet search on every query — grounded in LEVR's own curated data for speed, cost, and consistency.

**Why it matters:** turns LEVR Auto from a tool only useful to people who already know what they want into a full-funnel product — captures visitors earlier, doubles as lead capture, reinforces the "advisor + negotiator" positioning.

**Question flow:**
1. **Primary purpose** (dropdown) — Commuting / Family trips / Road trips & adventure / Hauling & towing / Fun & performance / Off-road / First car / Luxury
2. **What matters most** (rank top 3 from a fixed list) — Safety, Fuel economy, Reliability, Price/value, Cargo & passenger space, Performance, Tech & features, Comfort, Resale value
3. **Price range** (dropdown or slider)
4. **Body type** (optional dropdown) — Sedan / SUV / Truck / Hatchback / Minivan / No preference
5. **Free text field** — catch-all for anything the dropdowns don't capture (car seats, towing, AWD for snow, etc.)

**Matching logic:**
- Structured answers run against LEVR's own curated vehicle database first — a deterministic filter/scoring pass, no AI call needed for this step.
- The free-text nuance is then handed to Claude *along with the shortlist that survived the filter* — reasoning over ~10-15 relevant candidates, not an open search. Cheaper, faster, and more reliable than a cold AI search per query.
- Output: top 2-3 from that narrowed, reasoned shortlist, each with a "why this fits you" explanation tied to their actual answers, plus review video links.

**Design notes:**
- Each recommendation should have a "Start My Search" CTA that pre-fills the existing intake filter for that model — this is what converts a free tool into a paying customer.
- **Real prerequisite: the database itself has to be built before this can launch** — a curated table of ~50-150 popular models tagged with purpose-fit, safety/reliability/MPG/cargo specs, and price range. That's a content/data task, not just a UI build.
- **Hold on shipping until it's grounded in real MarketCheck data**, not a static table alone, once that integration exists — otherwise recommendations can go stale on pricing/availability.
- Review video links: start with a manually curated mapping of popular models → trusted reviewer channels (Doug DeMuro, Consumer Reports, MotorTrend, etc.); a live YouTube API search is a fancier v2, not needed for launch.
- Open question to resolve before building: standalone page, or an optional "not sure which car?" branch inside the main intake flow?

### In-House Review Video Content (Stage 4 — deliberately deferred)

**Concept:** Eventually produce LEVR Auto's own in-depth vehicle review videos, rather than only linking to third-party reviews.

**Honest scope note:** this is a real shift into media production — different skillset and cost structure (equipment, editing, on-camera talent, vehicle access) than the core software/negotiation business. Not a small add-on.

**Interesting angle, with a real tension to resolve on purpose:** dealers could loan review vehicles in exchange for exposure — but LEVR's core brand promise is buyer-side leverage/trust, so a dealer-loaned review needs a clear editorial-independence policy (or disclosure) or it undercuts the thing that makes the brand credible in the first place. Worth deciding deliberately, not defaulting into.

---

## Immediate Checklist (this week)

- [ ] **Tonight:** Update pricing in the live website's intake filter code from $500/$600/$700 to $699/$899/$999 (Claude Code, in `~/Projects/levr-auto` — check the FAQ and other pages for old pricing references too)
- [ ] Free USPTO TESS trademark search on "LEVR" / "LEVR Auto"
- [ ] Reach out to 2–3 attorneys: one quote for trademark clearance, one for the state licensing survey
- [ ] Draft the 30–50 dealer test list and send the outreach spike
- [ ] Email MarketCheck for API access/pricing
- [ ] Decide the Qualifying-Offer-sold-elsewhere edge case and update the Core Processes doc
- [ ] Set up the GitHub repo + CLAUDE.md for your friend to start building from

---

## Budget Tracker

| Item | Cost |
|---|---|
| Domains | ~$31 |
| Kansas LLC | ~$85 |
| **Spent so far** | **~$116** |
| Trademark clearance opinion (est.) | $300–500 |
| State licensing survey (est.) | varies by attorney/scope |
| MarketCheck API (est.) | TBD from quote |
| **Remaining runway** | under $10k for months 1–6 |

---

## Attorney Prep — Trademark Clearance Call/Email

*Send this to whoever you contact for the clearance opinion — it saves them (and you) an initial round of back-and-forth, since the preliminary search legwork is already done.*

### Background to give them upfront
- Proposed mark: **LEVR Auto** (word mark, spelled L-E-V-R)
- Business: nationwide service negotiating new-car purchases on behalf of consumer buyers — contacts dealers, collects/compares offers, coordinates closing (financing data capture, e-sign, delivery coordination). Revenue: consumer fee now; dealer subscription and lender/transporter referral fees planned later.
- Platform: website/SaaS at levrauto.com, nationwide dealer email outreach, eventual dealer-facing portal.
- Entity: Kansas LLC (application submitted). Domains owned: levrauto.com, levrauto.net, levrauto.co.
- **Pre-launch** — no "first use in commerce" date yet, which matters for filing basis (intent-to-use vs. use-based application).

### Known conflicts to ask about specifically (serial numbers included so they don't have to re-run the search)
1. **LEVR — Black Rock Innovations LLC**, Serial #98369125, filed Jan 22, 2024, Class 042 — "SaaS...for OEMs in industrial equipment, automotive and aerospace industries." *Highest concern: exact word, appears live, explicitly touches "automotive."*
2. LEVR — skyTran Inc., Serial #97229213, filed Jan 20, 2022, Classes 012 & 039 (maglev transit) — **abandoned** May 22, 2023.
3. LeVR — Serial #86768209, filed Sept 25, 2015, Class 009 (electronics) — **abandoned** June 24, 2019.
4. **Lever Auto** — operating company, auto-dealer floor-plan financing, leverauto.com, active since ~2020 — no federal registration found in this search, but real common-law use in the auto-dealer space.
5. **Levr.ai / Levr Finance** — Vancouver-based fintech, active US business-lending customers since 2021 — no federal registration found under "Levr" in this search.

### Questions to get answered
1. Does the Black Rock Innovations LEVR application create a real risk of blocking LEVR Auto's own registration — or a future dispute risk — given the different specific service (industrial OEM project-management SaaS vs. consumer car-buying negotiation) but same word and same broad "automotive" category?
2. Does adding "Auto" to "LEVR" meaningfully reduce collision risk, or is "Auto" treated as merely descriptive of the industry and therefore not a real point of distinction?
3. Which international classes should LEVR Auto actually file under? (Candidates to raise: Class 35 — negotiation/business services on behalf of buyers; Class 36 — financial-affairs adjacent, if the financing data-capture role counts; Class 42 — SaaS platform, notably the same class as Black Rock's filing.)
4. What's the common-law risk from Lever Auto and Levr.ai — could either oppose an application or send a cease-and-desist based on prior use, even without a federal registration on file?
5. Since the business hasn't launched (no first-use date yet), should LEVR Auto file an intent-to-use application now to lock in a priority filing date before investing further — is there urgency here relative to how far along Black Rock Innovations' application is?
6. If risk is meaningful, what's the practical path — proceed and monitor, add a distinguishing logo/stylization, or is a rename advisable before going customer-facing?
7. Cost and timeline for (a) the clearance opinion itself, and (b) actually filing LEVR Auto's own application if the attorney recommends proceeding.

### What the opinion should ultimately deliver
- A go / go-with-caution / don't-go recommendation on "LEVR Auto"
- Recommended filing classes
- Whether to file now (intent-to-use) or hold off
- A specific risk rating on the Black Rock Innovations conflict, since it's the closest match found
- Any recommended adjustments to reduce risk (stylization, logo, disclaiming "Auto," etc.)
