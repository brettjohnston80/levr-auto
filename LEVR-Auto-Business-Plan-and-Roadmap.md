# LEVR Auto — Business Plan & Launch Roadmap

*Master document — pulls together everything already drafted (Core Processes, Website Copy, Developer Brief, Dealer Agreement) into one outline, then lays out a prioritized, sequenced action plan to actually launch.*

---

## Progress Log

**Aug 18, 2026 — Cancellation & Discretionary Refunds + Purchased celebratory state built and verified end-to-end.** Two new search_status values (cancelled, purchased) — closed deliberately left alone, still unused, per the earlier note flagging it as never actually committed to a meaning. Part 4 (agent reactivation) was scoped out entirely during planning, not deferred: a cancelled search is final — a customer who wants back in logs in and starts a fresh $699 search, same as any customer would.

New payments/cancellation_log/refunds tables give this app its first durable, per-charge payment tracking — previously the $699 fee had a single column, extension fees shared one column overwritten on every extension (and weren't even type-consistent between manual extend-now and auto-renew), and switch fees weren't tracked at all. All 4 charge-writing paths now record into payments, verified via real Stripe test-mode PaymentIntents and real signed webhook deliveries.

**Part 1 (self-service cancellation)** and **Part 2 (agent-mediated cancellation with discretionary refunds)** verified via real browser sessions as real signed-in test customer/agent. Part 2 supports per-payment partial refunds against any combination of the search fee, a switch fee, or an extension fee in one resolution — a real gap was caught and fixed during review (the remaining-balance check originally only ran after the Stripe refund succeeded; moved to a pre-check before any Stripe call, with the DB-level record_refund lock kept as the concurrency backstop, not the only defense). Over-refund rejection tested directly ($800 against a $699 balance) and confirmed rejected before any money moved.

**Part 3 (purchased celebratory state)** — agent-marked only, no deposit/Stripe automation. Verified rendering in a real browser with the locked congratulations copy displaying correctly, offer-tracking UI correctly suppressed underneath.

Full plan and reasoning in plan.md (repo). Migration: 20260818120000_cancellation_purchased_payments.sql.

**Aug 17, 2026 — Day-60 reminder (email + dashboard banner) now branches on auto-renew status.** Closes a real gap in the auto-renew feature shipped earlier the same day: a search with auto-renew on was still getting the old "extend anytime" reminder copy, telling the customer to take an action that was actually already going to happen automatically. `sendDay60Reminders` (`src/lib/day60-extension.ts`) now reads `auto_renew_enabled` and sends one of two emails — unchanged copy when off, a new "your card will be charged $100 in [X] days" copy when on, both fired from the existing 7-day-before-deadline trigger, no new cron. `/account`'s reminder banner (`getReminderBannerCopy`, `src/app/account/page.tsx`) branches the same way: the auto-renew-on case shows "Auto-renew is on — your card will be charged $100 in [X] days..." with an inline "Turn off auto-renew" link (new `AutoRenewOffLink` component, reuses the same `setAutoRenewEnabled` action as the existing `AutoRenewToggle`) in place of the "Extend now" button, since a manual extend button doesn't make sense once the charge is already scheduled. Verified end-to-end via a scratch test route (deleted after) against two real temporary accounts backdated into the reminder window, one with auto-renew on and one off: hit the real `/api/cron/day60-deadline-reminder` route and confirmed both reminders sent with the right branch (checked via `deadline_reminder_sent_for` being stamped on both, and by loading each account in a real browser via a real magic-link sign-in); the on-case rendered the new banner copy with no Extend button, clicking "Turn off auto-renew" correctly flipped `auto_renew_enabled` to `false` in the DB; the off-case rendered the original unchanged banner copy and the Extend button with its auto-renew opt-in checkbox, untouched. Test data and the scratch route cleaned up, confirmed removed. Two of the actual reminder emails were sent to real inboxes (`brettjohnston80@yahoo.com` for the on-case, `bjohnston@levrauto.com` for the off-case) during this test — Brett, worth a quick check that both landed with the right subject line, since this assistant can't read email itself.

**Aug 17, 2026 — Auto-renew built and verified end-to-end, one item pending Brett's confirmation.** Opt-in automatic $100 extensions, built to the mechanism decided 2026-08-16: `setup_future_usage: 'off_session'` on a customer's first extension checkout (not Stripe Subscriptions), triggered from the existing Day-60 pause cron rather than a new one. Migration applied (`customer_searches.auto_renew_enabled`, `customers.stripe_customer_id`/`stripe_default_payment_method_id`). Verified against real Stripe test-mode data: a real browser checkout with the auto-renew box checked correctly captured and vaulted the payment method (`stripe_customer_id`/`stripe_default_payment_method_id` set, `auto_renew_enabled` → true); the dashboard toggle correctly turned it back off; a real off-session charge (`pm_card_visa`) against a backdated overdue search succeeded, extended the deadline exactly +30 days, and left the search `searching` (never paused); a real decline (`pm_card_chargeDeclined`) correctly fell through to the existing pause flow with no special handling (`paused`, `paused_at` set, deadline untouched); idempotency held at both the Stripe layer (duplicate call returned the same PaymentIntent) and the DB layer (repeat update matched zero rows, a full repeat cron run found nothing left to process). Toggle placement: lives directly on the `SearchCard` rather than a dedicated account-settings page, since `auto_renew_enabled` is search-scoped like `search_deadline_at`/`paused_at` and no settings page exists yet (same gap already flagged for `communication_frequency`) — reasonable call, not sent back for a settings page that would've been a separate, bigger piece of work. Real bug caught mid-build: scratch-route cleanup was matching on `customers.email` (non-unique, already a documented anti-pattern in CLAUDE.md) — fixed to resolve through `auth.users` instead. Test data and the scratch route cleaned up, confirmed removed. **One thing not yet confirmed: actual delivery of the "Your LEVR Auto search was automatically extended" confirmation email** — it was sent as part of the verified successful charge above, but inbox delivery itself needs Brett to check `brettjohnston80@yahoo.com` directly, since this assistant can't access email. If it's missing, the send failed silently server-side (logged, non-fatal to the charge) and needs a follow-up look. See `CLAUDE.md` for full technical detail.

**Aug 17, 2026 — Extend-now UI shipped and verified end-to-end, closing out the Day-60 extension policy.** The last open piece of the Day-60 extension feature — the dashboard UI (reminder/paused-state banners plus a real "Extend now" button wired into `createExtensionCheckoutSession`) — passed a full real-browser test: both banner states (a still-searching row 5 days from its deadline, a paused row 5 days into its 30-day resume window) rendered correct live-countdown copy on `/account`; two real Stripe test-mode checkouts were completed via actual browser click-through (test card `4242 4242 4242 4242`), confirmed against the real Checkout Session line item before paying; the webhook's `handleExtensionFeePayment` branch was verified via a manually signed event simulation (no `stripe listen` set up for this project) — both searches' deadlines correctly extended +30 days, the paused search correctly flipped back to `searching` with `paused_at` cleared, and `/account` reflected both extensions cleanly with no stale banners afterward. Test data and the scratch route were cleaned up and confirmed removed. See `CLAUDE.md` for full technical detail. **Auto-renew is next** — mechanism already decided (see Business Model and Future Feature Ideas below), not yet built.

**Aug 13, 2026 — Trademark clearance now in progress.** Brett is in direct conversation with an attorney on the "LEVR" clearance opinion (see the Attorney Prep section below for the background/conflicts that were sent). Opinion still pending — status only logged here, not the substance of any advice received, since that's privileged attorney-client communication. Updates entity/legal status table above from "Not started."

**Aug 13, 2026 — Vercel Pro upgrade (fixes hourly cron), and the payment/finalization split shipped and verified.** Upgraded to Vercel Pro ($20/mo) to unlock sub-daily cron frequency — Hobby tier was silently capping cron jobs to once/day, and a batch of hourly-cron code had also only ever existed locally, never actually pushed. Both fixed; all 4 cron jobs confirmed registered and firing correctly in production. Then built and shipped the payment/finalization split scoped in "Full flow, resolved Aug 12, 2026" below: intake now only collects make/model/zip; `/finalize/[searchId]` lets the customer pick trim/color/required options either self-service (a Matchmaker-style flow backed by real synced listings) or by requesting a call, which now surfaces in a new "Finalization calls requested" section of `/internal/outreach` for an agent to complete on their behalf. New `awaiting_finalization` status and `finalized_at`/`call_requested_at` columns; the 24h self-edit window and the auto-solidify cron now anchor to `finalized_at` instead of `paid_at`. `/account` shows a live countdown and self-edit form during that window. Verified end-to-end against real production data via direct SQL matching the exact server-action logic, since driving an authenticated customer session isn't something this assistant can do without entering credentials; test row cleaned up after. See `CLAUDE.md` for full technical detail.

**Aug 1, 2026 — Landing page built and deployed.** Next.js + Tailwind marketing site built solo in one evening using Claude Code, based on the Developer Brief and Website Copy docs. Includes the full intake filter (make/model/trim/color/options, live tier pricing, zip validation) as a working front-end UI — no backend/payment/DB yet, by design. Pushed to GitHub (`brettjohnston80/levr-auto`), deployed on Vercel, and connected to the live `levrauto.com` domain (DNS now correctly pointed after resolving a Namecheap URL-redirect-record conflict). Next up: trademark attorney outreach, MarketCheck contact, and the dealer outreach spike — see Stage 0/1 above. *(Historical note, added Aug 17, 2026: "live tier pricing" here reflects the original 3-tier $699/$899/$999 structure that existed at the time of this build — since simplified to a single flat $699 on 2026-08-12, see Business Model above and CLAUDE.md. Left as-is since this is a point-in-time log entry, not current status.)*

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
- **Scope of "fee earned, whether or not the customer buys" — confirmed explicitly (Aug 16, 2026), not a new refund trigger, a clarification of the existing one.** Once a Qualifying Offer exists, the fee is earned, full stop. That covers: the customer buying a different vehicle than the one LEVR searched for; buying a used vehicle instead of new; buying the exact matched vehicle direct through the dealer, cutting LEVR out of the transaction (a real risk once a customer has been in a dealership in person — see the Test Drive Coordination idea under Future Feature Ideas below). **Nothing the customer does themselves ever triggers a refund.** The only refund paths are (a) LEVR failing to produce a Qualifying Offer by the Day 30 deadline, or (b) an agent's discretionary decision on a customer-requested cancellation call — see "Cancellation & Discretionary Refunds" under Future Feature Ideas below for the full policy and mechanism, finalized Aug 17, 2026, built and verified Aug 18, 2026. This "no customer-initiated refund" language needs to reach the Customer Agreement, not just this doc, since it's a real contract term — flag for attorney review alongside the rest of that agreement.
- Either way, active search continues **free through Day 60**.
- After Day 60: **$100** per renewable ~30-day extension.

**Switching make/model:** $100, resets Day 30/60 clocks — except one free switch in an unadvertised 5-day grace period after signup.

**Revenue streams held for later (not v1):**
- Lender referral fees (financing data is captured now; monetization added once a compliant vendor partnership exists — actual credit pulls are FCRA-regulated). See "Financing & Insurance Referral Partnerships" under Future Feature Ideas below for a discovery pass on specific vendors.
- Insurance referral fees (new candidate, discovery pass Aug 16, 2026 — see Future Feature Ideas below) — offering customers an insurance-shopping option at signup/switch, through a partner marketplace, with LEVR earning a referral bonus.
- Transporter marketplace fee (concierge referral only for now).
- Dealer subscription/lead-marketplace (Stage 3) — dealers pay to see active regional buyer demand and bid in.

### 3. Customer Journey

1. Landing page → progressive intake filter (make → model → zip) with a live nationwide inventory count. Trim/color/options are no longer collected here — see step 3.
2. Account creation + payment (flat $699, one vehicle).
3. **Finalization (added 2026-08-13, see "Full flow, resolved Aug 12, 2026" below):** customer either finalizes trim/color/must-have options themselves — a Matchmaker-style flow built off real current inventory — or requests a call with an agent to do it together. This explicit action, not payment, is what starts the 24-hour self-edit window.
4. 24-hour self-edit window (trim/color/options only — make/model locked); auto-solidifies once elapsed.
5. Sourcing + outreach begin. Dashboard shows regional summary only at first ("10 dealers West Coast, 5 Midwest").
6. Offers land: dealer city, car photo, itemized price/add-ons shown.
7. Customer can request add-on removal; unlimited back-and-forth with dealer.
8. Acceptance → refundable deposit → dealer re-confirms availability → financing path → LEVR e-sign → dealer's own paperwork → delivery/pickup → close.
   - **"Purchase confirmed" signal — concrete spec below still not built; a simpler v1 shipped instead (2026-08-18).** Surfaced as a real gap during the Day-60 extension policy's discovery pass (2026-08-14): no purchased/converted/deal-closed signal exists anywhere in the schema today — confirmed by grep, not assumed (see CLAUDE.md's Step 4 discovery notes). Without it, nothing can ever tell a customer who's already bought their car apart from one whose search just hasn't produced an offer yet — which matters directly for step 8 above (closing this loop) and for the Day-60 job (it should never nag or pause a search that's already closed). Full spec (still not built): customer selects a vehicle (via an agent, or self-service from their own dashboard) → dealer confirms availability and the deposit amount → deposit is paid → the account reflects the search as purchased → reversible if the deal falls through after that point (financing denied, dealer backs out, customer walks away), rather than a one-way, unrecoverable state. **What actually shipped is deliberately simpler than this**, as part of the Cancellation & Discretionary Refunds pass (see Progress Log, Aug 18, 2026): `search_status = 'purchased'`, agent-marked only, no deposit/Stripe automation, not reversible. Closes the "can't tell a purchased search from a quiet one" gap well enough for now; the fuller reversible deposit-driven pipeline described above is still a real, separate future build if the business ever wants it.
9. *(Later)* Landing page shows real average-savings-by-model stats once deal data exists.

### 3a. Full flow, resolved Aug 12, 2026

Decisions locked in while scoping the payment/finalization split (implemented and verified 2026-08-13, see Progress Log above):

- **Self-service finalization is a Matchmaker-style flow, not a simple form.** Something built off the initial Matchmaker tool that's more in-depth — trim (from real live inventory, with price ranges), color, and must-have options, one step at a time, ending in a review/confirm screen — not a bare set of dropdowns.
- **The "schedule a call" path is manual for now.** No real calendar/scheduling integration — a customer's request just surfaces in the agent's outreach queue, same as every other manual outreach step in this business today. A real calendar app is a later addition once there's enough volume to justify it.
- **Reuses `customer_searches`, no new table.** Finalization is new columns/status on the existing row (`finalized_at`, `call_requested_at`, `awaiting_finalization`), not a separate finalization-tracking table — keeps the whole lifecycle of one search on one row.

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
| Trademark clearance ("LEVR") | **In progress (as of 2026-08-13)** — Brett is in direct conversation with an attorney; opinion pending. Preliminary free search done Aug 1, 2026 surfaced the conflicts below for the attorney to weigh in on; the substance of the attorney's actual advice is deliberately not logged here (privileged communication) — see Progress Log for status only. Findings from the preliminary search: (1) **LEVR — Black Rock Innovations LLC**, filed Jan 2024, SaaS serial #98369125, for OEM project/resource management software in industrial/**automotive**/aerospace — exact word match, touches automotive, appears live — highest-priority conflict flagged with the attorney. (2) LEVR — skyTran Inc. (maglev transit) — abandoned May 2023, low risk. (3) LeVR — 2015 filing (electronics), abandoned, low risk. (4) Lever Auto — operating auto-dealer floor-plan financing co. since 2020, domain leverauto.com, phonetically identical, no federal filing found but real common-law use in the auto-dealer space. (5) Levr.ai / Levr Finance — Canadian fintech lending platform, active US commerce, no federal filing found under "Levr" itself. |
| State broker/dealer licensing survey | **Not started** — CA and NY confirmed stricter |
| Customer agreement | Drafted, not attorney-reviewed |
| Dealer agreement | Drafted, not attorney-reviewed |

**Total spend to date: ~$121.** Budget ceiling: <$10k for first 3–6 months, part-time nights/weekends.

---

## PART 2: PRIORITIZED ROADMAP

The build is not the risky part — it's well-specified. The two things that could actually kill this business are (a) a legal structure problem discovered *after* you're taking customer money, and (b) discovering the outreach mechanism doesn't work only after the full platform is built around it. Both of those get tested cheaply and early, in parallel with everything else.

### Stage 0 — De-risk before spending real time (next 1–2 weeks)

1. **Trademark clearance — now the top priority, not a "before Stage 1" nice-to-have.** A preliminary free search (Aug 1, 2026) surfaced a live-looking federal application for the exact word "LEVR" (Black Rock Innovations LLC, filed Jan 2024, SaaS for automotive/aerospace/industrial OEM project management) plus a confirmed operating company using "Lever Auto" in the auto-dealer space since 2020 (leverauto.com). Get the paid clearance opinion ($300–500) now, specifically asking the attorney to weigh in on the Black Rock Innovations conflict — before spending more on branding, signing any customer contract, or investing further build time under this name.
2. **Get 2–3 attorney quotes for the state licensing survey.** Search "dealer broker license" + your state, or ask in a small-business/startup legal marketplace (e.g., a fixed-fee service or a local business attorney) for a 50-state (or top-15-state) survey on whether what LEVR does counts as vehicle brokering and what's required. This gates Section 2.9 of the customer contract and affects which states you can even operate in at launch — so it's worth doing before, not after, soft launch.
3. **Resolve the open guarantee edge case now, not later:** does a Qualifying Offer that sells to someone else before the customer decides still count toward the Day 30 guarantee? Pick a position (recommend: yes, it counts — the offer existed and was real; the buyer's delay isn't LEVR's failure) and add it to the Core Processes doc so it's not an open question when a real customer hits it.

### Stage 1 — Prove the riskiest technical assumption (weeks 1–4, parallel to Stage 0)

4. **Outreach spike.** Before any more building, manually (or with a lightweight script) send your draft outreach email/ADF-XML lead to 30–50 real dealers for a real or test vehicle spec and see what comes back: response rate, format, how usable the replies are for parsing. This determines whether the whole "email-only, AI-parsed" model is viable or needs rethinking (e.g., a human-in-the-loop fallback for the first few months). Do this before your friend builds the outreach engine around an untested assumption. **Add-on for this spike (Aug 17, 2026):** also test whether dealers will disclose/pre-commit warranty and add-on pricing by email, or deflect to discussing it in person — see "Out-the-Door Price Estimation, Financing Breakdown & Add-On Transparency" under Future Feature Ideas for why this matters.
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

13. Lender referral partnership (compliant vendor for actual credit pulls) — see Future Feature Ideas below for named candidates.
13a. Insurance referral partnership (new, Aug 16, 2026) — see Future Feature Ideas below for named candidates.
14. Transporter marketplace fee.
15. Dealer subscription/portal (Stage 3 concept in the Core Processes doc) — dealers see regional buyer demand and bid in directly.
16. Scaled/automated customer support layer — direction is set, design work hasn't started.
17. **In-house review video content** (see Future Feature Ideas below) — real scope shift into media production, deferred deliberately.

### Three Dashboards (long-term product vision)

The long-term product is three connected dashboards, one per audience. Item 16 above ("scaled/automated customer support layer") is the agent dashboard below — this section formalizes what that placeholder actually points at.

1. **Client dashboard — exists today, this is its seed, not a separate build.** Already live at `/account`: search status, offers, accept/decline, add-on negotiation, switch UI, finalization. Future work here is incremental (more of the same categories of self-service), not a rebuild.
2. **Agent dashboard — not started.** Today there's only `/internal/outreach`, a manual page built as a series of individually-added queue sections (matching-dealer lookup, offer logging, finalization calls, switch calls, deal-progress actions) — functional, but not designed as a unified workspace. The real vision: one view that optimizes an agent's full day across all three things an agent actually does — dealer outreach, salesman/dealership interaction, and client follow-up (including the 48-hour follow-up clocks described below). `/internal/outreach`'s queue-section pattern (each new customer-facing flow gets its own section) is the seed of this, the same way `/account` is the seed of the client dashboard — but it needs real design work once there's enough real usage to know what an agent's day actually looks like, not just more sections bolted on ad hoc.
3. **Dealership dashboard — already loosely captured as a Stage 3 concept, formalized here as the third pillar.** Dealers see regional buyer demand and bid in directly (see Stage 4 item 15, and the Core Processes doc's Stage 3 concept). Explicitly sequenced after real deal volume exists — not being built now, and not useful to build before there's real demand data to show dealers.

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

### LEVRating (future idea — not started)

**Concept:** LEVR Auto's own internal dealership rating system — a scorecard and relationship-management tool for LEVR's own team, not a public-facing rating. Distinct from the "Dealership dashboard" pillar in the Three Dashboards section above — that one is dealer-facing/external (dealers seeing demand and bidding in); LEVRating is internal-only, LEVR's own view *of* dealerships, not something dealers see or interact with.

**Real prerequisite: dealerships would need to become a first-class entity in the schema.** Today "dealer" only exists as denormalized fields on synced `listings` rows (`dealer_name`, `dealer_city`, etc.) — there's no standalone, trackable dealership record with history. This is real data modeling work, not a small add-on, and would need to happen before any of the below could be built.

**Components:**
- **A salesperson roster per dealership** (name, phone, email) — lets an agent go back to a specific person who was good to work with, rather than starting cold with the dealership again on the next deal.
- **Two-sided rating feeding one score per dealership** — agent-side (against criteria to be defined later: communication, willingness to deal, etc.) and customer-side (specifically post-handoff experience — did the dealership stay pleasant once LEVR's part of the deal was done).
- **Google Reviews synced in alongside LEVR's own score, shown side by side** — an addition to the public rating, not a replacement for it. A new external API integration, the same category of work as the ZeptoMail integration was — not just a checkbox to flip on.

**Scope: internal/agent-facing only for now.** Surfacing any of this to customers is explicitly a "maybe later," not in scope. Worth noting LEVRating could plausibly gate access to the future dealer-facing portal eventually (e.g. a minimum score to participate) — but that's speculative, not decided.

### Cancellation & Discretionary Refunds (policy finalized Aug 17, 2026, built and verified Aug 18, 2026 — see Progress Log)

**Built as scoped below, with one deliberate change made during planning: Part 4 (agent reactivation) was cut entirely, not deferred.** A cancelled search is final — no reactivation path exists in the app. A customer who wants back in starts a brand-new $699 search, same as anyone else. Everything else below (self-service cancellation, agent-mediated cancellation with discretionary per-payment refunds) shipped as designed. Full technical detail in CLAUDE.md; full design reasoning in plan.md (repo).

**Concept:** Two customer-facing paths, both from `/account`. (1) **Self-service cancellation** — immediate, irreversible, no refund, ever, no exceptions. (2) **Request to talk to an agent about cancelling** — the customer explains their circumstances on a call, and the agent decides, entirely at their own discretion, whether to issue a full refund, a partial refund, or none. **A customer can never request a refund directly, in either path** — the only two things a customer can do about cancellation are cancel outright with no refund, or ask to talk to someone who might refund them. Refund decisions are agent-only, always.

**Illustrative example (Brett's, kept here for context on the intent):** a customer signs up, locks in search criteria, LEVR runs an early search — then the customer loses their job and is no longer in the market for a new vehicle at all. They want to cancel. This isn't the customer being difficult or trying to game a refund — it's a real change in circumstances, and the agent should be able to use judgment (full refund, partial, or none) rather than being boxed into a fixed rule. The same discretion also covers the reverse case: LEVR made a real mistake or gave the customer a bad experience, and refunding (fully or partially) is the right call even though the guarantee itself wasn't technically missed.

**1. Self-service cancellation:**
- A "Cancel this search" action on the relevant `SearchCard` on `/account`.
- Must show a clear, explicit warning before the customer can confirm: cancelling ends the search immediately, it cannot be restarted or resumed, and no refund is issued under any circumstances via this path. A customer who wants to search again later has to start an entirely new $699 search.
- No refund option is ever presented here — this path is deliberately one-way and refund-free, matching the "nothing the customer does themselves triggers a refund" policy above.
- **Real open question, not resolved here:** which search states this applies to. Straightforward for `searching`/`paused`; less obvious once a Qualifying Offer has been accepted and a deposit/financing/e-sign is already in motion (Customer Journey step 8) — does self-service cancellation still make sense that late, or should it be agent-only past that point? Needs a decision before build.
- **Real schema gap, not resolved here:** `search_status`'s 6 allowed values (CLAUDE.md's exhaustive trace) have no "cancelled" state. The existing unused `closed` value looks earmarked for the separate "purchase confirmed" signal already logged under Customer Journey step 8 above, not for this — so reusing it here would likely be wrong. This probably needs its own new status value and a migration, for whoever picks this up to design properly, not decided here.

**2. Agent-mediated cancellation with discretionary refund:**
- The customer's alternative to self-service cancel: a "Request to talk to an agent about cancelling" action, mirroring the exact call-request pattern already built twice in this codebase for finalization and switching (a `*_call_requested_at`-style column, surfacing in a new "Cancellation calls requested" section on `/internal/outreach`, resolved by an agent-only form — same shape as `AgentFinalizeSearchForm`/`AgentSwitchSearchForm`).
- On the call, the agent hears the customer out and decides the outcome. That decision is captured the same way the existing extension/switch bypass already captures agent discretion (Day-60 Pass 3, CLAUDE.md): **a reason category (dropdown) plus a free-text notes field**, logged to an audit trail. Whether this extends the existing `agent_bypass_log` table with a new action type or gets its own dedicated table is a real design choice, not decided here — but the audit-everything standard that table already established should carry over.
- **Real build item, not just a status flip:** actually issuing a refund means calling Stripe's refund API for a specific amount against the original Checkout Session's payment — full or partial. This is real payment code, not a UI-only feature, and should get the same "real data verification, no shortcuts" testing standard as every other Stripe-touching pass in this project.
- Likely reuses the two-stage customer/search lookup already built for the extension bypass (search by name/email → disambiguated customer list → their searches → pick the one) rather than building a new lookup from scratch.

### Out-the-Door Price Estimation, Financing Breakdown & Add-On Transparency (expanded Aug 17, 2026, not built)

**Concept:** Rather than just disclaiming that tax/title/registration/financing aren't included in a shown price (the interim copy above), actually estimate them as accurately as possible, let a customer plug in their own pre-approved financing for a real payment breakdown, and make warranty/add-on decisions explicit and itemized rather than an open-ended negotiation ask. Brett's standard: "as accurate as possible," not a rough guess.

**1. Tax, title, and registration — build an internal 50-state fee estimator, don't just disclaim it.** Research (Aug 17, 2026) confirms this is genuinely buildable, but it's real engineering work, not a lookup table:
- Every state DMV publishes its fee schedule publicly and for free, so a 50-state table is buildable in-house. Complexity is real, though: roughly a dozen-plus states compute registration fees by vehicle weight or value/age (Colorado, Virginia, Georgia's ad valorem TAVT, and Montana were specifically named as more complex) rather than a flat fee, and at least ~20 states layer county or city sales tax on top of the state rate (Alabama, Arizona, California, Colorado, Florida, Kansas, Missouri, Nebraska, New York, Ohio, Oklahoma, South Dakota, Utah, Washington, among others) — a per-zip or per-county rate, not just per-state.
- **Named vendors that already solved this, worth a direct pricing conversation before committing to build-it-yourself:** **Vitu** (developer.vitu.com) — a public developer portal with a "National API" explicitly marketed as 50-state title/registration fee estimates, white-label, built for third-party integration (not dealer-only). **ATC Solutions** (autotitling.com) — a "DMV Data API for Automotive SaaS Companies" (their own positioning matches LEVR directly), claims state/county/city tax rates plus taxable-value and registration-fee calculations, including trade-in and weight-based adjustments. Neither publishes pricing; both need a direct sales conversation. Avalara was also checked — it's a strong general sales-tax API but not confirmed to handle vehicle-specific title/registration logic out of the box, so it's a partial fit at best. CDK/Reynolds and Reynolds/RouteOne/Dealertrack compute this internally for dealers but don't appear to offer access to an outside party like LEVR.
- **Recommendation given LEVR's current stage:** start by building the internal 50-state table from free public DMV data (refreshed quarterly, extra care on the ~15-20 "complicated" states), and get pricing/demos from Vitu and ATC Solutions in parallel — licensing one of them may end up cheaper than the ongoing engineering/maintenance burden once real volume exists, but that's a real cost comparison to make later, not a decision to make now.

**2. Financing payment breakdown — let a customer with their own pre-approved financing enter it for a real number.** Two paths, not yet built:
- **Customer already has pre-approved financing** (their own bank or credit union): a simple input — APR, term in months, down payment, lender name optional — and LEVR computes a real estimated monthly payment off the negotiated price plus the estimated tax/title/registration from item 1 above, using standard loan amortization math. No credit pull involved since it's the customer's own already-obtained terms being entered, not LEVR originating anything — this sidesteps the FCRA "permissible purpose" question that a real credit pull would raise.
- **Customer doesn't have financing yet:** point them at the financing referral partners already researched (Union Credit, myAutoloan — see "Pricing Transparency, Invoice/Incentive Data..." above) so they can go get a rate, then come back and enter it.
- **Real guardrail, not resolved here:** until a customer enters real terms, LEVR should never show a fabricated or "typical" interest rate as if it were a real quote — that would recreate exactly the kind of surprise-cost problem this whole feature is meant to prevent. Either show no financed-payment estimate until real terms are entered, or clearly label anything illustrative as an example, not a quote.

**3. Warranties and other add-ons — document and let the customer explicitly accept or waive each one.** This extends the existing Customer Journey step 7 ("Customer can request add-on removal; unlimited back-and-forth with dealer") rather than replacing it — the change Brett wants is making it a structured, itemized accept/waive decision per add-on (extended warranty, GAP insurance, paint/fabric protection, etc.) instead of an open-ended request.
- **Real open question Brett raised himself, genuinely unresolved:** whether LEVR's email-based negotiation can actually get a dealer to commit to warranty/add-on pricing and terms in advance, or whether that's realistically something only settled in person at the dealer's finance office. This isn't something to guess at — dealer finance offices are widely known in the industry to prefer handling these products face-to-face (it's where a lot of their margin and their best chance to upsell lives), so there's a real risk dealers deflect an email ask on this the same way they might on other terms. This is exactly the same "mechanism unproven, needs a real-world test" situation already flagged for the core outreach engine in Stage 1 — **recommend adding it as a specific thing to test in the existing 30-50 dealer outreach spike** (Stage 1, item 4): ask a subset of test dealers to disclose and pre-commit warranty/add-on pricing by email, and see whether they actually do or deflect to "let's go over that when you're here."

**4. Hard rule for any total/breakdown UI, wherever this gets built: the $699 (or any $100 switch/extension fee) never appears inside a "total investment" or out-the-door total shown to the customer.** Brett was explicit on this — the $699 is a past, already-settled decision, not part of what they owe the dealer, and showing it inside a running total would make it look like the car costs $699 more than it does or that the customer's being charged twice. Applies to any payment breakdown, financing estimate, or OTD total this feature (or anything else) ever builds.

**Copy implication, not decided yet:** once tax/title/registration are actually estimated rather than just excluded, the interim disclaimer copy above stops being accurate — it should shift from "doesn't include" to something like "includes an estimated tax, title, and registration for your area." Exact wording is a later decision, once the estimator itself exists — not proposing new copy for a feature that isn't built yet.

### Test Drive Coordination (future idea — post-payment only, not started, Aug 16, 2026)

**Concept:** For a customer who's paid but isn't fully sure/ready to commit to their chosen make/model without physically driving it first, LEVR locates nearby dealer inventory they could test drive, contacts the dealer directly (call or email) to schedule the test drive on the customer's behalf, and schedules a follow-up call with the customer afterward to keep the process moving.

**Why post-payment only — deliberate, not an oversight.** Brett flagged the real risk driving this: once a customer is physically in a dealership, the salesperson will try to convert them into a direct sale, cutting LEVR out of the transaction entirely. Restricting test-drive coordination to after payment keeps LEVR as the intermediary of record throughout — and per the refund-scope clarification above, if a customer does get poached into buying direct, that's already a no-refund outcome once a Qualifying Offer exists, so the business is protected either way, but avoiding the poaching attempt in the first place is still the better outcome.

**Proposed workflow, not built:**
1. Trigger point is an open question — self-service request button on `/account`, folded into the finalization flow, or agent-only at first (matching how every other new outreach mechanism in this codebase has started, e.g. the switch and finalization call-request flows) — not decided here.
2. Locate nearby matching inventory — reuses the real zip-radius query already built for the Step 2 inventory-count work (`inventory-count.ts`), not a new lookup.
3. An agent contacts the dealer (call/email) to schedule the test drive — same "manual for now, mechanism unproven" caveat that already applies to the core dealer-outreach engine itself (Stage 1 checklist item).
4. LEVR confirms the appointment with the customer, then schedules a follow-up call after the test drive to check in and continue toward finalizing or accepting an offer.

**Real open question, not resolved here:** whether the dealer contact made to schedule a test drive is the same relationship/person LEVR later negotiates an offer through, or a deliberately separate contact — a dealer who's already spoken with the customer once (even indirectly, to book a test drive) may behave differently once real offer negotiation starts. Worth deciding deliberately once this is actually scoped for build, per the same "worth deciding deliberately, not defaulting into" standard used for the review-video dealer-loan question below.

### Pricing Transparency, Invoice/Incentive Data, and Financing & Insurance Referral Partnerships (discovery pass — Aug 16, 2026)

Four related ideas Brett raised together: knowing real dealer cost to negotiate harder, making sure customers are never surprised by tax/title/fees at the dealership, staying on top of manufacturer rebates so customers don't leave money on the table, and adding financing/insurance referral options (with a referral bonus for LEVR) on the site. Discovery only below — research findings and a proposed copy draft, nothing built or committed to yet.

**1. Dealer invoice pricing — feasible as an informed estimate, not as a certainty.** True dealer net cost (after undisclosed OEM holdback and volume incentives) is confidential and not reliably obtainable from any vendor — Edmunds itself says determining a dealer's real net cost is "difficult even for seasoned automotive insiders." What is available: *estimated* invoice pricing (Edmunds Vehicle Data API, J.D. Power/Chrome Data) built from the published factory order-guide price, which can be combined with publicly known **manufacturer holdback percentages** (a well-documented rule of thumb — roughly 3% of MSRP for Ford/GM/Chrysler/Hyundai/Kia/Jeep/Ram/Mercedes, ~2% for Honda/Toyota/Lexus/Acura/VW, ~1% for Mazda/Volvo, $0 for Audi/BMW/Porsche/MINI/Land Rover/Jaguar) to produce a realistic negotiating floor — framed to agents and customers as an estimate, never a guarantee. **Confirmed: MarketCheck (LEVR's existing inventory vendor) does not offer invoice data** — its Price product is MSRP and live market/listing comparisons only. **Next step, not yet done:** contact Edmunds Developer Network and J.D. Power/Chrome Data sales for API scope and pricing — neither publishes cost publicly.

**2. Tax/title/fee transparency — superseded by the fuller spec below, kept here as the interim copy until that's built.** Interim standing line, trimmed per Brett's feedback (Aug 17, 2026 — the original draft's "the same as with any car purchase" read as over-explaining, cut), **approved by Brett Aug 17, 2026 and clear to go into code as the interim copy:** *"Doesn't include tax, title, and registration — set by your state — or your financing rate, if you finance."* Short variant: *"Excludes tax, title, registration, and financing rate."* **Confirmed with Brett: dealer doc fees and add-ons are NOT in this excluded list** — those should already be itemized in the offer itself per Customer Journey step 6 ("itemized price/add-ons shown"), so the only genuinely location- or credit-dependent unknowns are government tax/title/registration and the financing rate. **This is an interim disclaimer only — see "Out-the-Door Price Estimation, Financing Breakdown & Add-On Transparency" under Future Feature Ideas below for the real build Brett wants:** actually computing these numbers, not just excluding them. Not built either way yet, but the interim copy itself is signed off and ready to ship.

**3. Rebate/incentive awareness — MarketCheck already sells this, worth a quote given the existing relationship.** MarketCheck runs a dedicated **OEM Incentives Data Feed / Incentive Search API** on the same platform LEVR already uses for inventory — scrapes 35+ OEM sites weekly, covers cash rebates, APR/lease offers, and critically, **zip/region-level targeting** (incentives are tied to registration location and can swing thousands of dollars between metros on the identical vehicle, per Cox Automotive's published example — a national lookup table would misstate savings). General API tiers run free (500 calls/mo) up to $749/mo unlimited, plus a separate incentives data fee not publicly listed — worth asking the MarketCheck rep directly for a bundled quote. Cox Automotive Rates & Incentives is a comparable enterprise option (contact-only pricing). **Recommended for now, at pre-launch volume: manual per-deal checks** against Edmunds's and CarsDirect's public incentive pages, plus asking the dealer directly (since some dealer-only cash isn't published anywhere) — free, and likely sufficient until deal volume justifies the paid feed.

**4. Financing referral partnerships — Union Credit is the closest architectural fit; myAutoloan is the fastest to start.** LEVR needs *purchase* financing (not refinance) referral partners, since customers are buying new — this ruled out several refi-focused platforms (Caribou/formerly MotoRefi, RateGenius, OpenRoad Lending, Auto Approve). Two real candidates: **Union Credit** (unioncredit.app) — an embeddable credit-union loan marketplace designed to plug directly into a partner's own site at the point of shopping (already integrated into Way.com); credit unions pay Union Credit only for members actually acquired, which is the closest match to "financing options on our own site, with a referral bonus for us" — exact partner payout terms need a direct conversation. **myAutoloan.com** (LendingTree-owned) — covers new/used/lease-buyout financing, runs a public Commission Junction affiliate program paying up to $15 per qualified application, low-friction to join. **Compliance flag, not yet confirmed by counsel:** a pure referral link generally shouldn't trigger FCRA registration since LEVR itself wouldn't be pulling credit, but some states separately require loan-broker/lead-generation registration — get this confirmed in writing before launch, same standard as the trademark/licensing items in Stage 0 above.

**5. Insurance referral partnerships — new revenue stream, not previously in this doc.** Two platforms explicitly target LEVR's exact scenario (a customer who just financed/bought a car and isn't yet being offered insurance): **Insurify** and **The Zebra** — both compare 100+ carriers, offer API/iframe/white-label embed options, and run negotiated commission-based partnerships (no public flat rate; terms set directly with their partnerships teams). Compare.com and Experian's insurance marketplace (formerly Gabi) are secondary options worth a parallel inquiry. **Licensing nuance to get right:** an unlicensed referrer can generally be paid for a referral only if the fee is a **flat amount, not contingent on the sale/bind** — a few states (e.g. PA) cap this explicitly, and stricter states (WA, NY) scrutinize it closely. Since LEVR operates nationwide, this needs the same per-state care as the broker/dealer licensing survey already in Stage 0 — worth asking Insurify/The Zebra directly whether their standard deal is flat-per-lead or contingent-on-bind, since that answer determines whether any state registration is triggered.

**Not yet decided anywhere above:** whether financing/insurance referral links live on `/account` (post-purchase, alongside deal-progress UI) or earlier in the funnel — this is a placement decision for whenever these partnerships are actually pursued, not decided in this pass.

**Vendor outreach sequencing — decided Aug 17, 2026: build first, outreach second.** Draft outreach emails exist for all 9 vendors named above (MarketCheck, Edmunds, J.D. Power/Chrome Data, Union Credit, Insurify, The Zebra, Vitu, ATC Solutions, plus a note that myAutoloan is a self-serve CJ affiliate signup rather than an email) — drafted Aug 17, 2026, none sent. Brett's explicit call: hold each vendor email until its corresponding feature actually reaches build stage, rather than front-loading vendor conversations for features that are still just ideas. Sequencing follows the feature build order, not a fixed calendar date. **Also flagged for later exploration, not decided or built:** using Claude agents to actually perform this outreach and populate the results (contact vendor, gather pricing/coverage/terms, write findings back into this doc) rather than Brett sending manually — genuinely useful once real send-and-receive email automation exists, but worth being honest that no outbound-email-sending tool is connected in this environment today; this session can only draft copy, not dispatch it. Revisit this idea once each feature is actually queued for build.

### In-House Review Video Content (Stage 4 — deliberately deferred)

**Concept:** Eventually produce LEVR Auto's own in-depth vehicle review videos, rather than only linking to third-party reviews.

**Honest scope note:** this is a real shift into media production — different skillset and cost structure (equipment, editing, on-camera talent, vehicle access) than the core software/negotiation business. Not a small add-on.

**Interesting angle, with a real tension to resolve on purpose:** dealers could loan review vehicles in exchange for exposure — but LEVR's core brand promise is buyer-side leverage/trust, so a dealer-loaned review needs a clear editorial-independence policy (or disclosure) or it undercuts the thing that makes the brand credible in the first place. Worth deciding deliberately, not defaulting into.

---

## Data & Policy Freshness — Periodic Review Schedule (added Aug 17, 2026)

**Concept:** Brett flagged a real risk while reviewing the tax/title/registration estimator plan: unlike a zip code (fixed, never changes), several of the data sources and policy assumptions LEVR's pricing and negotiation accuracy will depend on *do* change over time — state legislatures adjust tax and fee amounts, manufacturers revise incentive programs constantly, licensing rules shift, vendor terms get renegotiated. None of the features below are built yet, but the moment any of them are, they need a standing review cadence from day one — not something that quietly goes stale until a customer catches a wrong number before LEVR does.

| Data / policy area | Why it goes stale | Recommended review cadence | Notes |
|---|---|---|---|
| State tax/title/registration rates & fee schedules (Out-the-Door estimator, item 1) | State legislatures adjust rates, most commonly at fiscal-year (July 1) or calendar-year (Jan 1) boundaries; county/city rates can change on their own, less predictable schedule | **Quarterly full pass**, plus a targeted spot-check right around Jan 1 and July 1 each year | If Vitu or ATC Solutions ends up licensed instead of building in-house, this maintenance burden shifts to the vendor — one more real factor in that build-vs-buy comparison, not just sticker price |
| Manufacturer holdback percentages (Dealer invoice pricing, item 1 of Pricing Transparency section) | Changes are infrequent but do happen by manufacturer/model year | **Annually**, timed to fall model-year changeover | Sourced from published rule-of-thumb tables, not official OEM disclosure — worth re-verifying accuracy on this cadence, not just checking for changes |
| OEM rebates/incentives (Rebate/incentive awareness, item 3) | Changes constantly — monthly or more, and varies by region/zip | **Weekly at minimum** if checked manually — this is the one item that can't tolerate a slow cadence | MarketCheck's own incentives feed already refreshes weekly on their end — a real point in favor of licensing that feed once volume justifies the cost, rather than trying to hand-track this one specifically |
| State broker/dealer licensing requirements (Stage 0, item 2) | States periodically revisit vehicle-broker regulation | **Annually**, and again any time LEVR expands into a new state | Low-frequency but high-consequence if missed — operating without required licensing in a state is real legal exposure, not just a stale-data inconvenience |
| Insurance-referral licensing rules per state (Insurance referral partnerships, item 5) | Same category as above — state-by-state, changes occasionally | **Annually** | Scope to whichever states LEVR is actually running insurance referrals in at the time |
| FCRA / lending-referral compliance posture (Financing referral partnerships, item 4) | Federal and state regulatory guidance evolves | **Annually**, and again whenever a new financing partner is added | Re-confirm with counsel each time — not a one-time launch check |
| Vendor API terms, pricing, and coverage (MarketCheck, Edmunds/J.D. Power, Vitu/ATC Solutions, Union Credit/myAutoloan, Insurify/The Zebra) | Vendors periodically renegotiate pricing, terms, or coverage (new makes/models/states) | **Annually**, aligned to each contract's renewal date once signed | Check coverage expansion at the same time, not just price |
| Trademark status / new conflicting filings | Other applicants can file new marks after LEVR's own clearance or registration | **Annually** | A low-cost USPTO trademark watch service can automate this rather than relying on a manual check |

**Not decided yet, worth revisiting once there's a real Agent Dashboard (see Three Dashboards above):** this whole table is a manual calendar-reminder process for now, appropriate at pre-launch stage. Once the Agent Dashboard gets real design work, this is a natural candidate to become an actual recurring checklist/reminder system inside the product itself, rather than something living only in this doc.

---

## Immediate Checklist (this week)

- [x] ~~Update pricing in the live website's intake filter code from $500/$600/$700 to $699/$899/$999~~ — **superseded, already done differently.** This checklist item was itself stale (corrected Aug 17, 2026): the business model isn't 3 tiers at all, it's a single flat $699 (no tiers), simplified 2026-08-12. CLAUDE.md confirms the live code, FAQ, and DB schema are already consistent with that flat-fee model (verified 2026-08-14) — nothing left to build here. What *was* still stale: the Developer Brief, Project Summary, and Website Copy docs still described the old 3-tier structure — all corrected today to match.
- [ ] Free USPTO TESS trademark search on "LEVR" / "LEVR Auto"
- [ ] Reach out to 2–3 attorneys: one quote for trademark clearance, one for the state licensing survey
- [ ] Draft the 30–50 dealer test list and send the outreach spike
- [ ] Email MarketCheck for API access/pricing
- [x] ~~Decide the Qualifying-Offer-sold-elsewhere edge case and update the Core Processes doc~~ — **done (Aug 17, 2026).** This was actually already decided well before this checklist item was written — the 24-hour response-window rule has been live in CLAUDE.md's guarantee section (and built into the app as `evaluateOfferGuaranteeContribution`) since early on. This pass just propagated that resolution into `LEVR-Auto-Core-Processes-v1.md`, which had never been updated to match and was still listing it as an open decision.
- [ ] Set up the GitHub repo + CLAUDE.md for your friend to start building from

---

## Budget Tracker

| Item | Cost |
|---|---|
| Domains | ~$31 |
| Kansas LLC | ~$85 |
| Anthropic API credits | ~$5 |
| **Spent so far** | **~$121** |
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
