# LEVR Auto — Project Summary (as of tonight)

*Paste this into a new chat to pick up where we left off. The four detailed docs already created still exist and can be re-uploaded for full fidelity if needed — this is the compact version.*

---

## Brand & Identity

- Name: **LEVR Auto** (spelled L-E-V-R, pronounced "Lever," short for leverage)
- Domains purchased: levrauto.com, levrauto.net, levrauto.co (~$31 total)
- Positioning: leverage belongs with the buyer, not the dealership — explicitly **no anti-dealer/dealer-bashing tone**
- Tagline: "Car buying, with the leverage on your side."
- **Trademark risk, not yet cleared:** two close matches found — Levr.ai (exact spelling, lending-brokerage fintech) and "Lever Auto" (phonetic twin, auto dealer floor-plan financing company). Recommendation was a $300–500 attorney clearance opinion before spending further on branding. **Not started yet.**

## Entity & Legal

- Kansas LLC application: **submitted** (~$85 fee)
- State-by-state broker/dealer licensing survey: **not started.** California and New York confirmed as stricter (CA requires broker endorsement on dealer license; NY requires a $100k bond). Plan was to get quotes from 2–3 attorneys for a full 50-state survey.
- **Total tracked spend so far: ~$116** ($31 domains + $85 LLC)
- Budget: under $10k for first 3–6 months, no upfront hires
- Time: part-time, nights/weekends; some no-code/technical skill
- A friend is handling the actual coding, using Claude Code

## Business Model

**Pricing tiers:**
- $500 — one make/model, full flexibility on trim/color/options within it (inclusion/exclusion logic)
- $600 — two makes/models concurrently
- $700 — three makes/models concurrently (max)

**Guarantee:**
- Clock starts at payment. Evaluated at **Day 30**: refund (full, automatic, within ~7 days) if no Qualifying Offer (below "Total MSRP" per the Monroney label — includes destination, excludes tax/title/doc fees/dealer add-ons) has been presented.
- Regardless of Day 30 outcome, active search continues **free through Day 60** — customer can opt out early if they want.
- Past Day 60: $100 buys another renewable ~30-day search period.

**Switching make/model:** $100 fee, resets both Day 30/60 clocks. Exception: a **5-day unadvertised grace period** for one free switch (not public — internal policy only).

**Acceptance & close:** small refundable deposit required to reserve the car; dealer must immediately revoke an offer if the unit sells elsewhere; LEVR confirms availability before finalizing.

**Financing:** workflow/data-capture only for now — customer either uploads proof of their own financing, or submits a financing *preference* (not a credit pull — actual credit pulls are FCRA-regulated and need a compliant vendor partner later). Lender-referral revenue is a **deferred** monetization stream.

**Transportation:** concierge referral to existing car-shipping services only, no fee yet. Transporter marketplace fee is **deferred**.

**Dealer subscription/marketplace (Stage 3):** deferred but conceptually scoped — dealers would log in to see active local-adjacent buyer counts, benchmark pricing, submit bids, and see buyer's state/region only (never personal info, for tax-calculation purposes).

## Customer-Facing Flow

1. Landing page → "Get Started" → progressive filter (make → model → trim → color → options → **zip code**, captured for tax/registration purposes, never shown to dealers beyond state/region) with a **live nationwide inventory count** narrowing per filter. No dealer names shown yet.
2. Account creation + payment (tiered fee). Guarantee clock starts here.
3. 24-hour refinement window to fine-tune trim/color/options (not make/model) — auto-solidifies with original selections if the customer doesn't return.
4. Sourcing + outreach begin. Dashboard initially shows a regional summary only (e.g. "10 dealers West Coast, 5 Midwest").
5. As real offers land: dashboard shows dealer city, a photo of the actual car, itemized price and add-ons.
6. Customer can request specific dealer add-ons be removed — unlimited back-and-forth rounds with the dealer.
7. Acceptance → "congratulations" moment → deposit → availability confirmed → financing path → LEVR e-signed docs → dealer's own purchase paperwork → delivery/pickup coordination → close.
8. *(Phase 2, once real deal data exists)* Average-savings-by-model stat on the landing page (e.g. "we help buyers save $X on a Highlander").

## Technical Plan

- Custom-built (not no-code), via **Claude Code**
- Stack: **Next.js + Supabase** (DB/auth/storage) + **Vercel** hosting
- Inventory data: **MarketCheck API** (not yet contacted for access/quote)
- Outreach: email-only at launch, likely via **ADF/XML** lead format (industry-standard dealer CRM ingestion) or dealer web-form-fill — exact mechanism is still an **untested technical spike**, needs proving against ~30–50 real dealers before deeper build
- Inbound reply parsing: **Claude API** extracts structured offers from freeform dealer replies
- E-sign: DocuSign or PandaDoc API
- Payments: Stripe
- Claude.ai Project collaboration with the friend isn't available (Team/Enterprise-only feature) — recommended putting docs directly in the GitHub repo (e.g. a CLAUDE.md file) instead

## Documents Already Created

1. **LEVR-Auto-Core-Processes-v1.md** — guarantee, pricing, switching policy, full operational workflow, dealer outreach email template
2. **LEVR-Auto-Website-Copy-v1.md** — landing page + FAQ
3. **LEVR-Auto-Developer-Brief-v1.md** — pages, data model, integrations, build order *(created before some later details — may need a refresh pass to match the Core Processes doc)*
4. **LEVR-Auto-Dealer-Agreement-v1.md** — itemization rules, no hidden fees, offer revocation, buyer confidentiality, quality standards

## Genuinely Open — Needs Real-World Action, Not More Planning

- Trademark clearance opinion on "LEVR" (attorney)
- State licensing survey (attorney)
- MarketCheck outreach for API access/quote
- Outreach technical spike (prove dealer lead delivery actually works)
- Whether a Qualifying Offer that sells to someone else before the customer decides still counts toward the guarantee
- Dealer expected response-time standard (not yet defined)
- Scaled/automated customer support system (direction stated, not designed)
