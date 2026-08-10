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
  - Auth — Supabase Auth email/password sign-up + login (`/login`, `/signup`, `/account`), a DB trigger auto-creates the matching `customers` row on signup. Custom SMTP (ZeptoMail, distinct SMTP credentials from the API key already in use) is configured in Supabase Auth settings — Supabase's default email sender only delivers to Supabase org team members, which was silently blocking password reset and would have blocked real customer signup confirmations too. Verified with a real password reset email sent to `bjohnston@levrauto.com` and confirmed delivered to the actual inbox.
  - Password reset landing page — `/auth/reset-password` catches the incoming recovery link and lets the user set a new password (`updatePasswordFromRecovery`, `src/lib/auth-actions.ts`), then signs them out and redirects to `/login`. Root cause of why this was missing/broken: **this project's Auth email templates use the implicit flow**, not PKCE — recovery links redirect back with `access_token`/`refresh_token` in the URL hash fragment, which is client-only and never reaches the server. The existing `/auth/callback` route (server-side, expects a `?code=` query param to exchange) can never see a hash fragment, so pointing recovery links there — the natural first instinct — silently fails and dumps the user on `/login` with no session. The fix: `/auth/reset-password` is a client component that parses `window.location.hash` itself and calls `supabase.auth.setSession()` client-side to establish the session, then shows the form. Verified end-to-end: a real recovery link (via `admin.generateLink`, same token format `resetPasswordForEmail` produces) was opened in a real browser, correctly landed on the form, a new password was set, the app signed the session out and redirected to `/login` with a confirmation message, and logging back in with the new password succeeded — genuinely proving the new password works, not just that the form submits. Also confirmed a stale/missing link correctly shows an error instead of a broken form.
  - `/auth/callback` fixed with the same approach — was a server route (`route.ts`, `exchangeCodeForSession`), now a client page (`page.tsx`) that parses the hash fragment and calls `setSession()`, same as reset-password. This one was directly confirmed broken, not just suspected: a **genuine signup** through the real `/signup` UI (not the admin-API bypass every earlier test used) sent a real confirmation email via ZeptoMail, and clicking the equivalent real confirmation link landed on `/login?error=Could not verify your email` with the tokens visibly stuck in the URL hash — while Supabase's own side had already marked the email confirmed. So the account was actually usable, but the app told the user it wasn't and dropped their session, on every real signup. After the fix, a second genuine signup + real confirmation link landed cleanly on `/account`, fully signed in. If any other flow ever points `emailRedirectTo`/`redirectTo` at `/auth/callback` or `/auth/reset-password`, it'll work the same way — both now expect hash-fragment tokens, matching this project's actual email template configuration.
  - Intake flow → real DB — the homepage intake filter (make/model/trim/color/zip) writes real `customer_searches` rows. Not signed in? An inline modal prompts login/signup right at the "Continue" click (not before) — no separate nav entry point exists for this on purpose. Rows land at `search_status = 'pending_refinement'` / `guarantee_status = 'pending'` / `paid_at = null` by default.
  - Payment — Stripe Checkout (test mode), tied to the 3 tiers. After saving the intake rows, "Proceed to Payment" creates a Checkout Session (via `createCheckoutSession`, `src/lib/payment-actions.ts`) and redirects to Stripe's hosted page. On `checkout.session.completed` (`src/app/api/stripe/webhook/route.ts`), the webhook sets `paid_at` and `stripe_checkout_session_id` on the paid `customer_searches` row(s) — this is the Day-30/Day-60 guarantee clock anchor. Verified end-to-end with a real test-mode payment and a real webhook delivery (via `stripe listen`), including a replay test proving the `paid_at IS NULL` guard makes it idempotent. Deliberately does **not** touch `search_status` — that only moves to `'searching'` once the 24h post-payment refinement window closes, which is separate, unbuilt logic. Live keys not configured anywhere — test mode only until the business is actually ready to take real money.
  - `/matchmaker` page — still front-end only, mock data, not wired to the DB
  - MarketCheck sync, core (single make/model) — `syncListingsForMakeModel` (`src/lib/marketcheck-sync.ts`) calls the MarketCheck active-listings search (`src/lib/marketcheck.ts`, always with an explicit `car_type=new`) and upserts into `listings` on `vin`, paginated (50/page, capped at 3 pages per call for now — MarketCheck free tier is 500 calls/mo and a popular model can have 10k+ national listings). `car_type=new` alone isn't fully reliable (confirmed against real data — MarketCheck still lets through older model years, e.g. a 2019 model tagged `car_type: new`), so there's a second trust check: a listing is only upserted if its model year is the current year or one year ahead (`isTrustworthyNewListingYear`); anything older or missing a year is excluded and counted in the sync response as `excludedForYear`. Manually triggerable via `POST /api/internal/sync-listings` (`{ make, model }` body) for ad-hoc single-model syncs/backfills.
  - MarketCheck sync, demand-driven scheduling — `src/lib/marketcheck-scheduler.ts`: `getNightlyMakeModels()` (distinct make/model from `customer_searches` where `search_status = 'searching'`) and `getWeeklyMakeModels()` (distinct make/model already known via `listings`, minus whatever's in the nightly set). `runBatchSync()` syncs a list of make/models sequentially, continuing past individual failures. Two Vercel Cron targets (`vercel.json`): `/api/cron/sync-listings-nightly` (`0 6 * * *`) and `/api/cron/sync-listings-weekly` (`0 7 * * 0`), both GET, both authenticated via `Authorization: Bearer $CRON_SECRET` (Vercel sends this automatically on cron-triggered requests once `CRON_SECRET` is a project env var — now set on Vercel Production and Preview). The "monthly for consistently low-movement makes/models" tier from the original strategy is deliberately not built yet — needs real usage data to define "low-movement," which doesn't exist with zero real customers. Verified end-to-end against real data: nightly correctly empty with no active searches, weekly correctly synced the two make/models already in `listings` (Civic, Camry), and — using a real temporary test customer/search — nightly correctly picked up a newly-`searching` make/model (Ford Mustang) while weekly correctly excluded it (diffed against the just-updated nightly set). Test data cleaned up after.
  - All authenticated routes reject requests with a missing/wrong `CRON_SECRET` (verified: 401).
  - Outreach queue (manual work tool, not automation) — `/internal/outreach`, gated by `requireAgent()` (`src/lib/agent-auth.ts`): reuses the existing customer-facing Supabase Auth session (no separate agent login system), a signed-in user only counts as staff if their email matches an active row in `agents`. Brett's real agent login now exists (`bjohnston@levrauto.com`, linked to the pre-existing `agents` row) — note signing in via the normal `/login` form also auto-creates a `customers` row for that email via the existing trigger, a harmless accepted side effect of reusing customer auth. The page (`src/lib/outreach-queue.ts`) lists `customer_searches` at `search_status = 'searching'`, each with dealers pulled from `listings` by exact make/model match (aggregated to distinct dealers, sorted by inventory count — no zip/radius filtering) and any `qualifying_offers` already logged. An inline expandable form per search (`src/components/log-offer-form.tsx`) logs a real dealer offer via the `logQualifyingOffer` Server Action (`src/lib/outreach-actions.ts`), which re-checks agent auth server-side and writes through the admin client (mirrors the MarketCheck sync writes — `qualifying_offers` has no client-facing insert policy). Deliberately leaves `delivered_at` and `status` at their defaults (`null`/`'pending'`) — those belong to the customer dashboard/24h-response-window flow, not built yet. No automated calling/emailing — purely a human work queue. Verified end-to-end via real browser login as Brett's actual agent account: real matching dealers rendered correctly for a temporary test search, a real below-MSRP offer was logged through the actual form and confirmed correct in the DB (`is_below_msrp` computed `true`), and all three auth-gate cases were confirmed (unauthenticated → `/login`, signed-in-non-agent → `/`, signed-in-agent → the page). Test data cleaned up after; Brett's own login's temporary test password was rotated to an unknown value — use "Forgot password" to set a real one.
- **Not built yet:** the monthly low-movement sync tier (see above), outreach automation (deliberately manual for now), dealer-reply parsing, customer dashboard, change-request logic (incl. the 24h refinement window → `search_status = 'searching'` transition), financing/document flow, delivery coordination, fuller admin views — see Build order below for the sequence

## Pre-launch to-dos — don't forget these once there's real customer data

- **Preview deployments point at the same production Supabase project as live** (same DB, same auth users — no separate staging/test project exists yet). Fine for now since there's no real customer data, but this needs a proper split — a separate Supabase project for Preview, or branch-aware config — before real launch, so a test PR can never touch live customer data.
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
5. ~~MarketCheck integration — single make/model sync, manually triggered~~ — **done**; ~~demand-driven scheduling (nightly for active make/models, weekly for everything else already known)~~ — **done, via Vercel Cron**. Monthly low-movement tier deferred until real usage data exists.
6. ~~Outreach engine — manual work queue (not automation): `/internal/outreach` + offer-logging form~~ — **done**. Actual dealer contact (call/email automation) is still **mechanism deliberately unproven, deferred** — don't over-build automation here yet; keep this manual/lightweight until real-world dealer response patterns are observed
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
