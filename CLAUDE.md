# LEVR Auto — Project Context for Claude Code

This file exists so any Claude Code session (yours, your collaborator's, or a future one) has full context without re-explaining the business. Read this before starting build work.

## What this business does

LEVR Auto negotiates new-car purchases on behalf of consumer buyers, nationwide. Customer picks a make/model (up to 3), pays an upfront fee, LEVR sources matching dealer inventory and negotiates by phone/email, offers land in a dashboard, customer accepts one. Money-back guarantee if no below-MSRP offer within 30 days.

Legal entity: **LEVR Holdings LLC** (Kansas). Public brand: **LEVR Auto**.

Full business logic lives in `LEVR-Auto-Core-Processes-v1.md` and `LEVR-Auto-Business-Plan-and-Roadmap.md` in this repo — read those for anything not covered here.

## Current state (as of this file's creation)

- **Live site:** levrauto.com (Next.js + Tailwind, deployed on Vercel, GitHub repo `brettjohnston80/levr-auto`)
- **Built so far:** landing page with intake filter UI, `/matchmaker` page — both front-end only, no backend, mock/no data persistence
- **Not built at all yet:** auth, database, payments, dealer matching, outreach, dashboard — everything below this line is genuinely greenfield

## Pre-launch to-dos — don't forget these once there's real customer data

- **Preview deployments point at the same production Supabase project as live** (same DB, same auth users — no separate staging/test project exists yet). Fine for now since there's no real customer data, but this needs a proper split — a separate Supabase project for Preview, or branch-aware config — before real launch, so a test PR can never touch live customer data.

## Tech stack (decided)

- Next.js — app framework
- Supabase — Postgres DB, auth, storage
- Vercel — hosting
- MarketCheck API — dealer inventory data (live key exists, tested manually, not yet wired into the app)
- Stripe — payments
- ZeptoMail — transactional email (already set up via Zoho, same account as business email)
- Claude API — parsing freeform dealer reply emails into structured offers
- DocuSign or PandaDoc — e-signing

## Build order (do in this sequence)

1. **Database schema first** (see below) — everything else depends on this
2. Auth (Supabase Auth)
3. Intake flow → writes to real DB (replace the current mock intake filter)
4. Payment (Stripe) tied to the 3 tiers: $699 / $899 / $999
5. MarketCheck integration — nightly/weekly sync per the demand-driven refresh strategy below
6. Outreach engine — **mechanism deliberately unproven, deferred.** Don't over-build automation here yet; keep this manual/lightweight until real-world dealer response patterns are observed
7. Inbound reply parsing (Claude API) → populates `qualifying_offers`
8. Dashboard (customer-facing)
9. Change-request logic (add-on negotiation back-and-forth)
10. Financing/document flow
11. Delivery coordination
12. Minimal admin views

## Critical schema decisions already made — implement these correctly from the start

**`listings` vs `qualifying_offers` — these must be separate tables, not one.**
- `listings` = raw MarketCheck data (VIN, dealer, price, MSRP, trim, synced_at). Just sourced inventory, refreshed on a cadence.
- `qualifying_offers` = ONLY populated when a dealer actually responds to outreach with a real, itemized offer they're willing to honor. **An advertised listing price is never automatically a Qualifying Offer** — this is a hard business rule, not a UI nuance. Only rows in this table count toward the 30-day guarantee.

**`customer_searches` table doubles as the demand registry.** Drives MarketCheck sync cadence:
- Any make/model with an active row here → sync nightly
- Everything else → weekly, or monthly for consistently low-movement makes/models
- Rationale: most of the national inventory has zero active customers on any given day; pulling all of it nightly wastes API budget for no product benefit

**`assigned_agent_id` on every customer case, from day one** — even though right now it only ever points to Brett. This is what guarantees continuity (same agent stays with a customer) once there's ever a second person on the team. Cheap to build in now, annoying to retrofit later.

**VIN is the de-duplication key** for `listings` — upsert on VIN, never insert-always, or re-syncs create duplicate rows.

**Every MarketCheck sync call needs an explicit `car_type=new` filter** — testing showed the API defaults to mostly used inventory without it.

## The guarantee — exact rule (already decided, implement precisely)

- MSRP = Monroney label total (base + factory options + destination), excludes tax/title/doc/dealer add-ons
- Qualifying Offer = any dealer offer below that MSRP on a matching vehicle
- Assessed at Day 30 from payment
- **Sold-to-someone-else edge case:** customer gets a 24-hour response window from when a Qualifying Offer is delivered. No response within 24hrs + car sells → offer still counts (guarantee satisfied). Customer responds within 24hrs but car sells before it goes through anyway → doesn't count, LEVR keeps searching.
- Free search continues through Day 60 either way. After Day 60: $100 per ~30-day extension.

## Known open problems — don't design around false assumptions

**Outreach mechanism is unproven.** MarketCheck gives dealer phone + website, NOT email. ADF/XML lead delivery (the "real" scalable path) typically requires being a recognized lead vendor with the dealer's specific CRM system — a business relationship, not just an API call. Don't build heavy automation on an assumed email-outreach flow. This has been deliberately deferred as a business decision, not an oversight — revisit once real transactions are running.

**MarketCheck has no single-query nationwide radius.** Every tier caps a single search to 100-500 miles from one point. Genuine nationwide coverage requires running multiple searches anchored at different regional centers and stitching/deduping results (by VIN).

**MarketCheck pricing:** Free tier (500 calls/mo) currently in use for testing. Realistic production tier is ~$749/mo + an unspecified usage-based "data fee" — confirm exact numbers once their sales team replies with a real quote.

## Brand assets

- Logo files: `levr-auto-logo-final.png`, `levr-holdings-llc-logo-final.png` — both have real transparency, already in site header/footer/favicon
- Primary color: `#1746A2`
- Tagline: "Car buying, with the leverage on your side."

## Things NOT to build yet (explicitly deferred, don't scope-creep into these)

- Dealer subscription/lead-routing marketplace (Stage 4 — needs real transaction volume first)
- In-house review video content
- AI voice-calling for dealer outreach (real open question, needs legal review before any real use)
- Post-purchase mailer/giveaway program (has an unresolved sweepstakes-law question — needs attorney review before it's real)
- Lender referral, transporter marketplace revenue streams
