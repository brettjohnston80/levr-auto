# LEVR Auto — Project Context for Claude Code

This file exists so any Claude Code session (yours, your collaborator's, or a future one) has full context without re-explaining the business. Read this before starting build work.

## What this business does

LEVR Auto negotiates new-car purchases on behalf of consumer buyers, nationwide. Customer picks a make/model (up to 3), pays an upfront fee, LEVR sources matching dealer inventory and negotiates by phone/email, offers land in a dashboard, customer accepts one. Money-back guarantee if no below-MSRP offer within 30 days.

Legal entity: **LEVR Holdings LLC** (Kansas). Public brand: **LEVR Auto**.

Full business logic lives in `LEVR-Auto-Core-Processes-v1.md` and `LEVR-Auto-Business-Plan-and-Roadmap.md` in this repo — read those for anything not covered here.

## Current state (updated 2026-08-09 — keep this current, it's the first thing read each session)

- **Live site:** levrauto.com (Next.js + Tailwind, deployed on Vercel, GitHub repo `brettjohnston80/levr-auto`)
- **Built and live:**
  - Database schema — `agents`, `customers`, `customer_searches`, `listings`, `qualifying_offers`, RLS on all five (`supabase/migrations/`)
  - Auth — Supabase Auth email/password sign-up + login (`/login`, `/signup`, `/account`), a DB trigger auto-creates the matching `customers` row on signup
  - Intake flow → real DB — the homepage intake filter (make/model/trim/color/zip) writes real `customer_searches` rows. Not signed in? An inline modal prompts login/signup right at the "Continue" click (not before) — no separate nav entry point exists for this on purpose. Rows land at `search_status = 'pending_refinement'` / `guarantee_status = 'pending'` / `paid_at = null` by default.
  - Payment — Stripe Checkout (test mode), tied to the 3 tiers. After saving the intake rows, "Proceed to Payment" creates a Checkout Session (via `createCheckoutSession`, `src/lib/payment-actions.ts`) and redirects to Stripe's hosted page. On `checkout.session.completed` (`src/app/api/stripe/webhook/route.ts`), the webhook sets `paid_at` and `stripe_checkout_session_id` on the paid `customer_searches` row(s) — this is the Day-30/Day-60 guarantee clock anchor. Verified end-to-end with a real test-mode payment and a real webhook delivery (via `stripe listen`), including a replay test proving the `paid_at IS NULL` guard makes it idempotent. Deliberately does **not** touch `search_status` — that only moves to `'searching'` once the 24h post-payment refinement window closes, which is separate, unbuilt logic. Live keys not configured anywhere — test mode only until the business is actually ready to take real money.
  - `/matchmaker` page — still front-end only, mock data, not wired to the DB
  - MarketCheck sync (single make/model, manually triggered) — `syncListingsForMakeModel` (`src/lib/marketcheck-sync.ts`) calls the MarketCheck active-listings search (`src/lib/marketcheck.ts`, always with an explicit `car_type=new`) and upserts into `listings` on `vin`, paginated (50/page, capped at 3 pages per call for now — MarketCheck free tier is 500 calls/mo and a popular model can have 10k+ national listings). Triggered via `POST /api/internal/sync-listings` (`{ make, model }` body), authenticated with `Authorization: Bearer $CRON_SECRET` — same convention Vercel Cron uses natively, so this route needs no changes to become a real cron target. Verified end-to-end with a real sync (Honda Civic, 150 listings) and a real re-sync proving the VIN upsert is idempotent (row count unchanged, `synced_at` refreshed). Deliberately does **not** yet implement the demand-driven scheduling loop (deciding which make/models to sync, on what cadence, from `customer_searches`) — that's next.
- **Not built yet:** MarketCheck demand-driven scheduling (nightly for active make/models, weekly/monthly otherwise), outreach engine, dealer-reply parsing, customer dashboard, change-request logic (incl. the 24h refinement window → `search_status = 'searching'` transition), financing/document flow, delivery coordination, admin views — see Build order below for the sequence

## Pre-launch to-dos — don't forget these once there's real customer data

- **Preview deployments point at the same production Supabase project as live** (same DB, same auth users — no separate staging/test project exists yet). Fine for now since there's no real customer data, but this needs a proper split — a separate Supabase project for Preview, or branch-aware config — before real launch, so a test PR can never touch live customer data.
- **`CRON_SECRET` (for `/api/internal/sync-listings`) is only set locally**, not on Vercel yet — add it to Production/Preview once the actual cron schedule is built, same pattern as the Stripe/Supabase env var setup.
- **Stripe is in test mode everywhere** (`sk_test_...` / `whsec_...`, "LEVR Auto sandbox" account). No live keys configured anywhere — local, Preview, or Production. A real (test-mode) webhook endpoint is registered in the Stripe sandbox pointing at `https://levrauto.com/api/stripe/webhook` (`we_1U2cbg8FQdYEFttXePzCHvX8`, `checkout.session.completed` only), and `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are set on both Vercel Production and Preview (Preview shares the endpoint/keys for now, consistent with Preview sharing the production Supabase project above). Before real launch: switch to live keys, and register a separate live-mode webhook endpoint (test-mode endpoints don't receive live events).

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

1. ~~**Database schema first**~~ — **done**
2. ~~Auth (Supabase Auth)~~ — **done**
3. ~~Intake flow → writes to real DB~~ — **done**
4. ~~Payment (Stripe) tied to the 3 tiers: $699 / $899 / $999~~ — **done, test mode**
5. ~~MarketCheck integration — single make/model sync, manually triggered~~ — **done**; demand-driven scheduling (nightly/weekly/monthly per the strategy below, looping `customer_searches`) — **next up**
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
