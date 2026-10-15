# Agent dashboard Phase 1: code plan

**Status:** plan only (2026-10-12; revised the same day for Brett's agent sign-in decisions). No code has been written.
- **Chunk 0 may proceed.**
- **Chunk 1 (agent sign-in) is on hold until Brett approves this revision.**
- **Step 11 (LEVRID)** is written for Brett to run: `supabase/migrations/20261012120000_agent_levrid.sql`.

**Depends on:** the Phase 1 database work (Steps 1–10 plus 6b), applied and committed through `4f215fb`. The database plan is `docs/plans/agent-dashboard-phase1-plan.md`, cited below as "the DB plan".

**Ships:** only after the outside tester round ends, and only when Brett says to push to `main`.

## Scope

**In scope now (Brett, 2026-10-12):**
1. Role-aware sign-in checks, and activity logging on every agent action.
2. Assignment at payment, plus the hourly sweep. Its first run after the deploy assigns any real paid search left unassigned in the meantime.
3. The alert-email sweep over `agent_alerts.notified_at`.
4. Guarantee-refund recording on `/internal/refunds-due` ("Issue refund" and "Record a refund already issued in Stripe"), plus a per-refund reason on the cancellation form.
5. Call-request resolution (switch and cancellation), with call-request emails going only to the assigned agent.
6. Queue fixes: the 1,000-row callback queue, the admin table reading `customer_searches.assigned_agent_id`, and the vehicle-consultation queue filter.

**Held until the internal shell exists (redesign Phase 3), so they're built once in the new design:**
- the team-management screens: add agent, roles, rotation, away, alerts;
- the dealer outreach log screen.

Until then, agent management happens through the database functions (`add_agent`, `set_agent_role`, `set_agent_rotation`, `set_agent_active`, the away functions, `resolve_agent_alert`, `reassign_search`), run by Brett in the SQL Editor.

---

## 1. Where the work happens, and keeping it away from live data

**Branch:** `agent-dashboard-phase1-code`, created from `main` at `7f02cb5`. Commits stay on the branch. **Nothing is pushed to `main` until Brett says so.**

**The problem:** Preview deployments share the production database (there's no Preview/Production split yet), so a preview build of this branch could write real rows. Four guards prevent that, each enough on its own for its own risk:

| Risk | Guard |
|---|---|
| The branch builds a preview at all | **Preview builds turned off for this branch.** On the branch, `vercel.json` gets `"git": { "deploymentEnabled": { "agent-dashboard-phase1-code": false } }`. Pushing the branch to GitHub (for backup and sync) then creates no Vercel deployment. The setting names only this branch, so it's harmless once merged; it comes out at merge time anyway. |
| The hourly jobs running from a preview | Vercel only runs cron jobs on the **production** deployment, so a preview never triggers them. Beyond that, the new sweep route returns `skipped: not production` unless `process.env.VERCEL_ENV === "production"` or it's running locally under `next dev`. |
| Assigning real searches, sending emails, or calling Stripe from a preview | One helper, `src/lib/runtime-env.ts`, provides `isPreviewDeploy()` (how it tells local, preview and production apart is in section 1.1). Every new side-effecting path refuses to run on a preview: the payment-time assignment, the sweeps, alert emails, refund issuing and recording, and the assigned-agent call email. Stripe's webhook only points at `www`, so a preview never receives payments in the first place. |
| Local testing reaching a real inbox or real money | Local `next dev` uses the production database, Stripe **test mode** keys, and the real ZeptoMail key. So:<br>(1) all test data is on disposable scratch accounts, created, used, deleted and confirmed by count;<br>(2) scratch agents are inserted with `in_rotation = false`, so no real payment can be assigned to one;<br>(3) outside production, agent and alert emails are only ever sent to `@levrauto-test.invalid` recipients, which `sendEmail` already suppresses. Any other recipient is logged, not sent. So local testing never emails Brett;<br>(4) refunds only touch payments on scratch accounts, in Stripe test mode. |
| A test acting as a real agent (added 2026-10-12) | **No test ever acts as LEVRID 1 or any real agent, even for writes deleted afterwards.** Runs needing a lead or admin actor act as the persistent test admin `claude-verify-admin@levrauto-test.invalid` (Brett's choice (a); created by Step 13: no LEVRID, out of rotation, never linked to a login, never deleted). Each run deletes only the rows it wrote, confirms by count, and fails if Brett's activity count changed. Step 13 also makes the last-admin/lead checks, the no-lead alert fallback, admin-audience alerts and agent lists ignore test-domain agents. Before Step 13, Brett created a one-off test admin with a SQL Editor snippet. |

### 1.1 Telling local, preview and production apart (found 2026-10-12)
Brett's local `.env.local` contains `VERCEL_ENV="production"`, put there by `vercel env pull`. So `VERCEL_ENV` alone can't tell local dev from production. `src/lib/runtime-env.ts` therefore uses:

| Helper | True when |
|---|---|
| `isLocalDev()` | `NODE_ENV === 'development'` (only `next dev` sets this) |
| `isProductionDeploy()` | `NODE_ENV === 'production'` **and** `VERCEL_ENV === 'production'` **and** `VERCEL_REGION` is set. That variable is set only by Vercel's runtime and isn't in `.env.local`. |
| `isPreviewDeploy()` | `NODE_ENV === 'production'` and `VERCEL_ENV === 'preview'` |

Anything else, for example a local `next start`, counts as **not production**, so the side-effect guards stay on. Deploy day checks that `isProductionDeploy()` is true on the live site (the sweep's response reports it).

**Testing assignment locally needs a "real" scratch customer.** `assign_search` deliberately skips test accounts (`@levrauto-test.invalid`, `@levrauto.invalid`), so a normal scratch customer can't exercise round-robin.

- **Recommended approach (open question C1):** scratch customers for assignment tests use `claude-verify-<ts>-<rand>@verify.invalid`. Any `.invalid` address is undeliverable by definition (RFC 2606), and this chunk extends `sendEmail`'s suppression to every `.invalid` address. Such a customer then counts as real for assignment but can never receive mail.
- **The rest of the app treats it as a real customer:**
  - the nightly MarketCheck sync would pick up its make/model if the search were live at 06:00 UTC;
  - a real checkout would trigger the payment-time sync.
- **So those scratch searches are created directly in the database** (paid, but left in `awaiting_finalization`, never `searching`), are never paid through Checkout, and are deleted in the same session. **No MarketCheck calls.**

---

## 2. Build order

Each chunk ends with a stop for Brett's review. Nothing moves on until he approves.

| # | Chunk | Screens? |
|---|---|---|
| 0 | Branch and safety rails | no |
| 1a | Agent accounts kept separate from customer accounts (Step 12 database: sign-up trigger, sign-in attempts table, relink function, activity types) | no |
| 1b | `/agent` sign-in page with an internal look, generic errors and rate limiting | **yes** |
| 1c | Invite → set password → enroll two-factor | **yes** |
| 1d | Two-factor and agent-account checks on every agent page and agent action; customer sign-in refuses agent accounts | no |
| 1e | Two-factor reset (leads for agents, admins for anyone) | no (internal route until Phase 3) |
| 1f | Brett's own agent login (cutover; done on deploy day) | no |
| 1g | Minimal "Add agent" form (C9 answer): name, work email, role; sends the invite | **yes** |
| 2 | Activity logging on every agent action | no |
| 3 | Assignment at payment, the hourly sweep, and lead reassignment (server action only) | no |
| 4 | Alert-email sweep | no |
| 5 | Guarantee refunds on `/internal/refunds-due`, and the per-refund reason on the cancellation form | **yes** |
| 6 | Call-request resolution and assigned-agent call emails | **yes** |
| 7 | Queue fixes | **yes** (admin table) |
| 8 | Deploy rehearsal | no |

### Chunk 0: branch and safety rails
- **Changes:**
  - create the branch **in a separate git worktree** (`../levr-auto-phase1`), so Brett's running dev server in the main folder never sees branch files;
  - `vercel.json`: preview builds off for the branch;
  - new `src/lib/runtime-env.ts` (`isProductionDeploy()`, `isPreviewDeploy()`, `isLocalDev()`);
  - `src/lib/email.ts`: suppress every `.invalid` recipient (needs C1), and outside production never send agent or alert emails to anything but test-suffix recipients. The guard goes at the top, before the env checks, the same placement rule as the existing test-account guard.
- **Files:** `vercel.json`, `src/lib/runtime-env.ts`, `src/lib/email.ts`.
- **Verified by:**
  - `next build` and `tsc --noEmit` pass;
  - a unit-style script calls `sendEmail` with five recipients (`x@levrauto-test.invalid`, `x@verify.invalid`, `x@levrauto.invalid`, a real address in local mode, a real address with `VERCEL_ENV=production` set) and checks the console output. Expected: suppressed / suppressed / suppressed / suppressed-not-production / send attempted. The production case runs with a fake ZeptoMail key so nothing goes out;
  - after pushing the branch, the Vercel deployments list shows **no** new deployment for it.

### Chunk 1: agent sign-in (replaced 2026-10-12; full design in section 7)
Chunk 1 is now six small chunks, **1a–1f**, described in section 7. Each one ends with a stop for review. The role-aware checks from the earlier draft (`getAuthorizedAgent` returning the role, `hasRole`, `requireAgent({ minRole })`) are still part of 1d. **Link-by-email on first sign-in is dropped** (it was C2); agents are linked only by the invite.

### Chunk 2: activity logging on every agent action
- **Changes:** new `src/lib/agent-activity.ts`, with `logAgentActivity()`, which calls the `log_agent_activity` database function. If the call itself fails:
  - it logs `[agent-activity-failed]` with the action and error;
  - it tries to insert an `activity_log_failed` alert;
  - it never throws.
- **Wired into every app-level path in DB plan 5.3:**
  - offers: log, add-on, add-on removal, mark sold, delivery estimate, release;
  - deal steps: availability, deposit, signing check, mark purchased;
  - finalize: agent finalize, undecided finalize;
  - inventory refresh;
  - messages: reply (offer and general), mark reviewed;
  - notification flag resolved;
  - dealer identities and salespeople;
  - articles and social: save, approve, regenerate, image, mark posted.
- **The new attribution columns are written at the same time:**
  - `qualifying_offers.logged_by_agent_id` and `dealer_alias_id` (the alias from the linked listing, or `getOrCreateDealerAlias` for an off-lot dealer);
  - `deal_progress.availability_confirmed_by_agent_id` and `deposit_confirmed_by_agent_id`;
  - `notification_events.flag_resolved_by_agent_id`;
  - customer message sends also set `last_customer_message_at`.
- **Not touched:** the database-function paths (switch, bypass, cancel, revert, refund, reassign) already log themselves.
- **Files:**
  - `src/lib/agent-activity.ts` (new);
  - `src/lib/outreach-actions.ts` (16 actions);
  - `src/lib/offer-message-actions.ts`;
  - `src/lib/dealership-actions.ts`;
  - `src/lib/article-actions.ts`;
  - `src/lib/social-actions.ts`.
- **Verified by:** on one scratch customer and scratch agent, each action is run once through its real server action. The result is a table of action → activity rows written, each expected to be exactly **1**, plus the attribution column set.
  - Failure path: point one call at a non-existent action code. Expected: the action still succeeds, 0 activity rows for it, and 1 `activity_log_failed` alert.
  - Everything is deleted afterwards and confirmed 0 by count.
  - Article and social actions are verified on scratch draft rows only, never on November's real draft.

### Chunk 3: assignment
- **Changes:**
  - new `src/lib/search-assignment.ts`:
    - `assignSearch(searchId)` calls `assign_search` and returns its result;
    - `assignUnassignedPaidSearches()` pages through `customer_searches where paid_at is not null and assigned_agent_id is null` (500 at a time, ordered by `paid_at, id`), calls `assign_search` for each, and returns counts by method;
  - **payment-time assignment:** the Stripe webhook's `search_payment` branch calls `assignSearch` right after `paid_at` is set. It's non-fatal (logged), so a failure never fails the payment; the sweep retries. It's skipped on a preview;
  - `reassignSearch(searchId, agentId, reason)` server action, lead or admin only, calling `reassign_search`. **No screen yet** (open question C3);
  - the new hourly route is in section 4.
- **Files:** `src/lib/search-assignment.ts` (new), `src/app/api/stripe/webhook/route.ts`, `src/app/api/cron/agent-sweeps/route.ts` (new), `vercel.json`.
- **Verified by:**
  1. Webhook path, Stripe test mode: a signed test `checkout.session.completed` event is posted to the local webhook for a scratch `@verify.invalid` customer's search, the same technique used in earlier verification. Expected: `paid_at` set, `assigned_agent_id` = the scratch agent in rotation, `search_assignments.method = 'round_robin'`.
     - For this test only, the scratch agent is put in rotation and Brett is temporarily taken out of rotation under the flag route, then restored. That way a test search never lands on Brett (open question C4).
     - **The MarketCheck sync on this path is skipped** by using a make/model synced within 24 hours, confirmed beforehand by query (the 24-hour rule already in `syncListingsForMakeModel`), so no API call is made.
  2. Sweep: three scratch searches are inserted paid and unassigned (one real-style, one `@levrauto-test.invalid`, one already assigned). One sweep run should return `assigned 1 | skipped_test 1 | already 0` (the assigned one isn't selected). A second run returns `0 | 1 | 0`.
  3. Preview guard: the sweep route called with `VERCEL_ENV=preview` returns `skipped: not production`, and nothing is written.
  4. `reassignSearch`: refused for an agent, allowed for a lead (scratch lead), and writes a `search_assignments` row with method `manual` plus an activity row.

  Everything is deleted afterwards and confirmed 0 by count. Brett's rotation is checked restored (`true`).

### Chunk 4: alert-email sweep
- **Changes:** `sendPendingAgentAlerts()` in `src/lib/agent-alerts.ts` (new):
  1. **Claims** up to 50 un-notified alerts with one conditional update: `update agent_alerts set notified_at = now() where notified_at is null and id in (…) returning *`. If two runs overlap, each alert is claimed by exactly one.
  2. **Emails each alert's audience:**
     - `leads` = active agents with role lead, or admins too when there's no active lead;
     - `admins` = active admins.
     - The wording is in section 3.
  3. If every send to an alert fails, it **un-claims** it (`notified_at = null`) so the next run retries. A partial failure is logged and not retried, to avoid sending duplicates.

  It runs from the hourly sweep route, and straight after any `assignSearch` that returned an `alert_id`. Skipped on a preview. Outside production, only test-suffix recipients get mail (chunk 0).
- **Files:** `src/lib/agent-alerts.ts` (new), `src/app/api/cron/agent-sweeps/route.ts`, `src/lib/search-assignment.ts`.
- **Added in review (2026-10-14, Brett):**
  - **Auto-resolve:** an open `assignment_failed` alert closes itself once the search has an agent (payment-time or sweep assignment, any switch path for the old and new search, or `reassignSearch`). `resolved_by_agent_id` stays null; `details` gains `auto_resolved: true` and `auto_resolved_by`.
  - **Known gap, accepted for now:** a reassignment run directly in the SQL Editor (`reassign_search` outside the app) does **not** close the alert. Closing it there would need a database trigger; revisit with the Phase 3 alerts screen.
  - The immediate lead-fallback / no-lead emails are tested with a test-only empty-rotation simulation (`AGENT_ASSIGN_SIMULATE_NO_ROTATION=1`, ignored in production), never by changing a real rotation.
- **Verified by:**
  - scratch lead and admin agents (`@levrauto-test.invalid`, so sends are suppressed and logged), plus three scratch alerts:
    - one `assignment_lead_fallback` → leads;
    - one `assignment_no_lead` → admins;
    - one `activity_log_failed` → leads.
    - Expected: three `[email suppressed — test account]` log lines with the right recipients and subjects, `notified_at` set on all three, and a second run sending 0;
  - an overlap test: two sweeps started at once claim each alert once (total sends = 3);
  - everything deleted afterwards and confirmed 0.

### Chunk 5: guarantee refunds and the cancellation refund reason (screens)
**What Brett will see:**

1. **`/internal/refunds-due`:** each row (customer, search, resolved date) gains:
   - the payment amount still refundable;
   - an **"Issue refund"** button, with an inline confirm step;
   - a **"Record a refund already issued in Stripe"** link, which opens a field for the Stripe refund id;
   - once a row is fully refunded, it disappears from the list. That's derived: the search's `search_fee` payment has a `guarantee` refund and nothing left to refund.
2. **Cancellation form** (`AgentCancellationResolutionForm`): each refund line gains a **Reason** picker. It lists the refund reasons from `refund_reasons` and defaults to "Cancellation".

**How it works:**
- **Issue refund** (`recordGuaranteeRefund`):
  1. re-checks that the search is still `guarantee_status = 'refunded'`, and finds its `search_fee` payment and remaining balance;
  2. `stripe.refunds.create` for the remaining balance, with idempotency key `guarantee_<search id>_<payment id>`, so a double click or retry can't refund twice;
  3. `record_payment_refund(…, 'guarantee')`.
  - **If Stripe succeeded but recording failed,** the message says so and points to "Record a refund already issued in Stripe". It never retries the Stripe call.
  - Refused on a preview deploy.
- **Record an existing refund:**
  1. retrieves the refund from Stripe;
  2. requires `status = 'succeeded'`, that it belongs to the payment's `stripe_payment_intent_id`, and that it isn't already recorded (the unique index);
  3. records it for its real amount, with reason `guarantee`.
- **Cancellation reasons:** `resolveCancellation` takes a reason per refund line and calls `record_payment_refund` instead of `record_refund`.
- **Who can use them:** any agent (decided).
- **Decided in review (2026-10-14, Brett):**
  - **Switch chains:** a guarantee refund follows the switch chain back to the original $699 payment.
  - **$100 paid-switch fees are refunded too:** each fee on the chain is its own Stripe refund (its own idempotency key `guarantee_<search>_<payment>`), recorded with reason `guarantee`; the confirm and success texts show the total and each part. "Record a refund already issued in Stripe" accepts a refund of any fee on the chain.
  - Part-refunded rows stay on the list, showing what's left.
- **Files:**
  - `src/app/internal/refunds-due/page.tsx`;
  - `src/lib/refunds-due.ts` (remaining balance, refunded rows dropped);
  - `src/lib/guarantee-refund-actions.ts` (new);
  - `src/components/refund-due-actions.tsx` (new);
  - `src/lib/agent-cancellation-actions.ts`;
  - `src/components/agent-cancellation-resolution-form.tsx`.
- **Verified by:**
  - a scratch `@verify.invalid` customer with a scratch paid search, `guarantee_status = 'refunded'`, and a **real Stripe test-mode PaymentIntent** (`pm_card_visa`, confirmed through the API), so refunds are real test-mode refunds. Expected:
    1. Issue refund creates one Stripe test refund, with status `succeeded` read back from Stripe; `payments.refunded_cents = 69900`; a `refunds` row with reason `guarantee` and the scratch agent; one `refund_processed` activity row; and the row gone from the list;
    2. clicking Issue refund twice gives one Stripe refund (idempotency), and the second click reports "nothing left to refund";
    3. Record-existing: a refund made directly in Stripe test mode, then pasted in, is recorded with its real amount. Pasting the same id again is refused with "already recorded"; a refund for a different payment is refused;
    4. cancellation form with two lines, "Goodwill" and "Cancellation": two `refunds` rows with those reasons, the goodwill one also linked to the cancellation record;
  - **screenshots** of each state, desktop 1440px and phone 390px, saved as PNG files in `~/Downloads/agent-phase1-chunk5/`: the row before, the confirm step, success, each error message, the record-existing field, and the cancellation form with the reason picker. Brett approves from the screenshots;
  - everything deleted afterwards, including the Stripe test objects' rows in our database, confirmed 0 by count.

### Chunk 6: call-request resolution and the assigned-agent call email (screens)
**What Brett will see:** in the **Switch calls requested** and **Cancellation calls requested** sections of `/internal/outreach`, each card gains:
- a **"Mark call resolved"** control: an outcome picker, an optional note, and a confirm button;
- a resolved request leaves the section.

**How it works:**
- **Automatic resolution:** when the agent switches or cancels from that card, the request is resolved automatically with outcome `switched` / `cancelled`. So the manual picker only offers the other outcomes (section 3).
- **Recording:** `resolveSwitchCall` and `resolveCancellationCall` (any agent) set the resolved trio and log `call_request_resolved`, with the note in details.
- **Queues:** `getSwitchCallQueue` and `getCancellationCallQueue` exclude resolved rows.
- **Who gets the call-request email (`notifyAgentsOfCallRequest`):**
  1. the search's **assigned agent only** (Q6);
  2. if the search has no agent: a real customer gets `assignSearch` first, then the email; a test account (never auto-assigned) goes to leads (admins if there's no lead), with no alert;
  3. if assignment leaves it unassigned (no rotation and no lead), admins get the email and the `assignment_no_lead` alert already exists;
  4. an away agent still gets the email (Q6). Surfacing it to leads is the attention-engine phase.
- **Files:**
  - `src/app/internal/outreach/page.tsx`;
  - `src/components/resolve-call-request-form.tsx` (new);
  - `src/lib/call-resolution-actions.ts` (new);
  - `src/lib/outreach-queue.ts`;
  - `src/lib/switch-actions.ts`;
  - `src/lib/agent-cancellation-actions.ts`;
  - `src/lib/agent-call-notifications.ts`.
- **Verified by:**
  - two scratch searches with switch and cancellation call requests. Expected for each: resolving with "Didn't switch" / "Didn't cancel" sets all three resolved columns, removes the card, and writes one activity row;
  - an agent switch from a card resolves the request as `switched`;
  - call-request email recipients, captured from the suppression log: assigned scratch agent only (1 recipient); an unassigned test-account search goes to the scratch lead; with no rotation and no lead, it goes to the scratch admin;
  - **screenshots**, desktop and phone, in `~/Downloads/agent-phase1-chunk6/`;
  - everything deleted afterwards and confirmed 0.

### Chunk 7: queue fixes (admin table screen)
- **Callback queue** (`getNotificationCallbackQueue`, OQ:1252): filter on `agent_callback_requested_at is not null or flagged_no_deliverable_channel` at the database, plus paging. Today it reads every unresolved event.
- **Admin table** (`getAdminSearches`):
  - the "Assigned agent" column reads `customer_searches.assigned_agent_id` (today it's always blank);
  - searches are paged;
  - user emails are resolved page by page, not one 1,000-user call.
- **Vehicle-consultation queue:** adds `search_status = 'awaiting_finalization'`, so cancelled undecided searches drop out.
- **What Brett will see:** `/internal/admin`'s "Assigned agent" column filled in. It shows blank for unassigned searches, which is all test accounts.
- **Files:** `src/lib/outreach-queue.ts`, `src/lib/admin-actions.ts`, `src/components/admin-searches-table.tsx` (only if the column needs a tweak).
- **Verified by:**
  - **callback queue:** 1,005 scratch `notification_events` rows (1,000 plain plus 5 callback-flagged, all on one scratch customer). Expected: the queue returns exactly the 5 callbacks; before the fix it returned 0 of them, because they're past the first 1,000;
  - **consultation queue:** a cancelled undecided scratch search no longer appears, and an `awaiting_finalization` one does;
  - **admin table:** a scratch search assigned to a scratch agent shows that agent's name;
  - **screenshots** of the admin table, desktop and phone, in `~/Downloads/agent-phase1-chunk7/`;
  - everything deleted afterwards and confirmed 0.

### Chunk 7b: unpaged reads and long id lists (added 2026-10-14, Brett)
Found by a codebase-wide sweep after a test cleanup hit PostgREST's silent 1,000-row limit. Two failure modes:
- **Row limit:** a plain read returns at most 1,000 rows and cuts the rest off silently.
- **Id-list length:** a `.in()` lookup puts every id in the request URL; measured 2026-10-14, 600 uuids work and about **650 or more are refused ("Bad Request")**. Most call sites ignored that error, so they quietly showed "unknown customer" or skipped everyone.

**Fixed in 7b** (shared helpers in `src/lib/supabase/paged.ts`: `fetchAllPages`, `chunks`, `fetchByIds`):
1. `dealership-queue.ts` listing counts per dealer (every listing; ~6,000 already, so `/internal/dealerships` counts were wrong on the live site too).
2. `dealership-queue.ts` unconfirmed dealer aliases (390, growing with every make).
3. `outreach-queue.ts` listings per searched make/model (dealer list and the Log Offer listing dropdown; Civic 715).
4. `outreach-queue.ts` listings per make/model for the agent finalization form's trims.
5. `inventory-count.ts` intake "matching listings near you" count (customer-facing), plus its dealer-ZIP lookup.
6. Long id lists: `outreach-queue.ts` customers, offers, add-ons, deal progress, documents, configurator selections, trim and combination preferences for active searches, and both message loaders in `offer-messages.ts` (found when the test with 700 active searches made the whole outreach queue fail to load); the customer lookup in all six other agent queues (switch calls, cancellation calls, overdue follow-ups, paused, consultation, blocked); `day60-extension.ts` both customer lookups. `notification-digest.ts` already chunked its lists; it now uses the shared helper.

**Verified 2026-10-14 (before → after, same tests on the code with and without 7b):** intake count 1,000 → 1,100 of 1,100; outreach dealer list 5 dealers / 1,000 listings → 6 / 1,100 (the dealer only in the last 100 listings now appears); agent finalize trims missing "Late Edition" → present; unconfirmed aliases shown 604 → 700 of 700 (queue 1,096); dealership counts 7 per dealer → 200 (late dealer 0 → 100). With 700 active searches (past the ~650-id limit): the outreach queue failed to load → all 700 with emails; switch and cancellation queues 700 rows with 0 emails → 700 with emails; the Day-60 lookup shape refused in one request → 700 rows in chunks.

**Left for the offer-entry phase** (they only grow with real-customer volume; each needs more than 1,000 rows in one state, or ~650 ids, before anything is lost):
- reads of all searches in one state: `outreach-queue.ts` active searches, finalization calls, switch calls, cancellation calls, overdue follow-ups, paused, consultation, blocked; `day60-extension.ts` reminders, pause and resume reminders; `guarantee-assessment.ts`; `search-solidification.ts`; `post-deal-survey.ts`; `refunds-due.ts`; `social-generation.ts` testimonial and deal selectors; `offer-sheet-cleanup.ts`;
- `notification-digest.ts` pending daily-update events (more than 1,000 a day);
- the offer-activity and general-thread queues' customer lookups (`outreach-queue.ts`, `.in("id", customerIds)` with names).

### Chunk 8: deploy rehearsal (no push)
- Full `next build`, `tsc --noEmit` and lint.
- One local end-to-end pass of chunks 3–7 together, on fresh scratch accounts.
- A written diff summary for Brett.
- The `vercel.json` branch setting is removed in the merge commit.
- The deploy-day checklist (section 5) is filled in with the exact commands.

---

## 3. Wording for sign-off (exact draft text)

All of this is agent-facing except where noted. **None of it ships until Brett approves it.** Money is shown as `$699.00` style (the real amount is filled in).

### 3.1 `/internal/refunds-due`
| Where | Draft text |
|---|---|
| Column heading | `Refundable` |
| Button | `Issue refund` |
| Confirm prompt | `Refund {amount} to {customer name} for the Day-30 guarantee? This sends the money back through Stripe and can't be undone.` |
| Confirm buttons | `Refund {amount}` · `Cancel` |
| Busy | `Refunding…` |
| Success | `Refunded {amount}. Stripe refund {re_…}.` |
| Error: no longer due | `This search is no longer due a guarantee refund.` |
| Error: nothing left | `Nothing left to refund on this payment.` |
| Error: Stripe failed | `Stripe didn't complete the refund: {Stripe message}. Nothing was recorded, and no money moved.` |
| Error: recorded failed after Stripe succeeded | `The refund went through in Stripe ({re_…}) but couldn't be recorded here: {message}. Don't refund again. Record it with "Record a refund already issued in Stripe".` |
| Link | `Record a refund already issued in Stripe` |
| Field label | `Stripe refund ID (starts with re_)` |
| Button | `Record refund` |
| Busy | `Recording…` |
| Success | `Recorded the {amount} refund {re_…}.` |
| Error: not found | `That refund ID wasn't found in Stripe.` |
| Error: not succeeded | `That refund hasn't gone through in Stripe yet (status: {status}).` |
| Error: other payment | `That refund belongs to a different payment, not this search's $699 fee.` |
| Error: already recorded | `That refund has already been recorded.` |
| Empty list (unchanged) | existing text |

### 3.2 Cancellation form refund-reason picker
| Where | Draft text |
|---|---|
| Label (per refund line) | `Reason` |
| Options (from `refund_reasons.label`, already in the database) | `Cancellation` (default) · `Day-30 guarantee` · `Goodwill` · `Duplicate charge` · `Other` |

### 3.3 Call-request resolution
| Where | Draft text |
|---|---|
| Control | `Mark call resolved` |
| Picker label | `Outcome` |
| Switch options (manual) | `Didn't switch` (`no_switch`) · `Couldn't complete the call` (`call_not_completed`) · `Other` (`other`) |
| Cancellation options (manual) | `Didn't cancel` (`not_cancelled`) · `Couldn't complete the call` (`call_not_completed`) · `Other` (`other`) |
| Automatic (no picker) | `switched` when the agent switches from the card; `cancelled` when the agent cancels from the card |
| Note field | `Note (optional)` |
| Confirm | `Resolve` |
| Busy | `Resolving…` |
| Error | `Couldn't resolve this request: {message}` |

The stored codes are the neutral ones Brett approved on 2026-10-11. The labels above are what agents see.

### 3.4 Alert emails (to leads, or admins)
| Alert | Subject | Body |
|---|---|---|
| `assignment_lead_fallback` | `Search assigned to {lead name}: nobody is in rotation` | `{customer name}'s {year make model} search was paid and assigned to {lead name}, because no agent is in rotation. Put an agent back in rotation, or reassign the search if someone else should take it. Search: {admin link}` |
| `assignment_no_lead` (to admins) | `A paid search has no agent` | `{customer name}'s {year make model} search is paid but couldn't be assigned: no agent is in rotation and there is no active lead. Put someone in rotation or assign it yourself. Search: {admin link}` |
| `activity_log_failed` | `An agent action wasn't recorded in the activity log` | `{agent name}'s action "{action label}" went through, but its activity record couldn't be saved ({error}). Nothing needs undoing; this only affects the history.` |
| `assignment_failed` | `Automatic assignment failed for a paid search` | `Assigning {customer name}'s {year make model} search failed: {error}. The hourly sweep will try again. Search: {admin link}` |

`{admin link}` points at `/internal/admin`. There's no alert screen yet; it's held for Phase 3.

### 3.5 Assigned-agent call email
- **Text unchanged:**
  - subject `{who} requested a {finalization|switch|cancellation} call — {vehicle}`;
  - body as today, with the contact list and the "Open this request on /internal/outreach" link.
- **Only the recipients change** (chunk 6).
- **Addition approved (C5):** one line at the top. The full email, as it will be sent:
  - **Subject:** `{customer name or email} requested a {finalization|switch|cancellation} call — {year make model}`
  - **Body:**
    > This search is assigned to you.
    >
    > {customer name or email} asked for a call to {finalize the trim, color, and options on their | switch away from their current | talk through cancelling their} {year make model} search.
    >
    > - Name: {name}
    > - Email: {email}
    > - Phone: {phone}
    >
    > [Open this request on /internal/outreach]({link to the request's section})
  - **Example:** "Jane Smith requested a switch call — 2026 Toyota Camry" / "This search is assigned to you. Jane Smith asked for a call to switch away from their current 2026 Toyota Camry search." Contact lines appear only when that detail is on file.
  - **Sent elsewhere:** when the email goes to leads or admins instead (no agent assigned, or a test account), the first line is left out.

### 3.6 Agent sign-in pages (`/agent`)
| Where | Draft text |
|---|---|
| Page title | `LEVR Auto agent sign-in` |
| Fields | `Work email` · `Password` |
| Button | `Sign in` · busy `Signing in…` |
| Two-factor step heading | `Enter your authenticator code` |
| Two-factor field | `6-digit code` |
| Two-factor button | `Verify` · busy `Verifying…` |
| **Generic error (any wrong email, password or code, an unknown or deactivated agent, or a customer account)** | `That didn't work. Check your details and try again.` |
| Too many attempts | `Too many sign-in attempts. Wait 15 minutes and try again.` |
| Invite email subject | `You've been invited to the LEVR Auto agent dashboard` |
| Invite email body | `{inviter name} added you as a LEVR Auto agent. Set your password and turn on two-factor sign-in to get started. This link works once and expires in 24 hours: {link}` |
| Set-password page | heading `Set your password`; fields `New password` · `Confirm password`; the existing password rule text; button `Continue` |
| Enroll page | heading `Turn on two-factor sign-in`; text `Scan this code with an authenticator app (such as Google Authenticator, 1Password or Authy), then enter the 6-digit code it shows.`; link `Can't scan? Enter this key instead: {secret}`; button `Turn on` |
| Signed-in header (internal look) | `LEVR Auto · Agent` · `{agent name} (LEVRID {n})` · `Sign out` |
| Two-factor reset done (to the agent, by email) | subject `Your LEVR Auto two-factor sign-in was reset`; body `{lead/admin name} reset your two-factor sign-in. The next time you sign in, you'll set it up again. If you didn't ask for this, contact {lead/admin name} straight away.` |

### 3.8 Add-agent form (Chunk 1g)
| Where | Draft text |
|---|---|
| Page title | `Add an agent` |
| Fields | `Name` · `Work email` · `Role` |
| Role options | `Agent` (all leads and admins) · `Lead` and `Admin` (shown to admins only) |
| Help line | `They'll get an email to set a password and turn on two-factor sign-in. The invite link works once and expires in 24 hours.` |
| Button | `Send invite` · busy `Sending invite…` |
| Success | `Invite sent to {email}. {name} is LEVRID {n}.` |
| Error: not a work email | `Use a @levrauto.com work email.` |
| Error: role not allowed | `Only admins can add a lead or an admin.` |
| Error: already exists | `An agent with that email already exists.` |
| Error: invite email failed | `{name} was added as LEVRID {n}, but the invite email didn't send: {message}.` plus a `Resend invite` button |
| Resend success | `Invite sent again to {email}.` |

### 3.7 Customer-facing wording
**None.** No customer-facing text changes in Phase 1. The Day-30 refund email customers already get is unchanged. Stripe sends its own receipt for a refund, depending on the Stripe receipt setting, which is unchanged.

---

## 4. The hourly jobs

- **New route `/api/cron/agent-sweeps`, scheduled `15 * * * *` in `vercel.json`.** It's separate from the solidify job at `:00`, so a failure in one doesn't block the other (open question C6). It runs in order:
  1. `assignUnassignedPaidSearches()`;
  2. `closeFollowUpsForInactiveSearches()`: closes dealer follow-ups on searches that left `searching`. This is data only; no screen yet;
  3. `sendPendingAgentAlerts()`.
- **Auth:** the same `Authorization: Bearer $CRON_SECRET` check as every cron route, plus the production/local guard (section 1).
- **Running twice can't double anything:**
  - **assignment:** `assign_search` takes a database advisory lock and is idempotent (an assigned search returns `already_assigned`), so overlapping runs assign each search once. Verified in chunk 3;
  - **alert emails:** each alert is claimed with one conditional update (`where notified_at is null`), so only one run can send it. Verified in chunk 4;
  - **follow-up closing:** a conditional update (`where follow_up_closed_at is null`), idempotent.
- **Bounded work per run:**
  - the assignment sweep pages 500 at a time, with a soft cap of 2,000 searches a run;
  - alerts go 50 at a time.
  - Each run returns its counts in the JSON response, so a manual run shows exactly what happened.

---

## 5. Risks, the tester round, and deploy day

### 5.1 Risks to the live site and the tester round
| Risk | Mitigation |
|---|---|
| A preview build writes real data | Preview builds off for the branch, plus `isPreviewDeploy()` guards on every side effect (section 1) |
| Payment-time assignment breaks payments | Non-fatal and logged; the payment is recorded first; the sweep retries. Verified in chunk 3 |
| The webhook change breaks the paid-switch or extension branches | Only the `search_payment` branch changes. Chunk 3 replays one signed test event for each branch and checks each still records its payment row |
| Activity logging slows or breaks agent actions | The helper never throws, and its failure path is tested. One extra function call per action |
| The 19 `getAuthorizedAgent` callers change behaviour | The default minimum role is agent (today's behaviour); chunk 1 checks agent, non-agent and deactivated sign-ins |
| Testers affected | Nothing deploys during the round. After the deploy, test accounts are never auto-assigned (N7), and their emails stay suppressed |
| Refund buttons move real money | Production Stripe is still in test mode until the live-mode launch item. Once live, Issue refund moves real money, so the wording says so, and it needs the confirm step plus the idempotency key |
| A merge conflict with `main` work during the round | The branch is rebased on `main` before the rehearsal (chunk 8); any conflict is shown to Brett |

### 5.2 Deploy-day checklist (after the tester round, on Brett's go-ahead; revised 2026-10-14)
Exact commands, ids and SQL are filled in by the Chunk 8 rehearsal.

0. **Brett's go-ahead:**
   - the tester round is over; tester cleanup is done or deferred;
   - every chunk is approved (0–7b and the Chunk 8 rehearsal) and all wording in section 3 is signed off;
   - **turn off `ALLOW_TEST_SEEDING`** in Vercel Production once tester cleanup is done;
   - Stripe stays in test mode (live mode waits for the offer-entry phase);
   - **Chunks 1b and 1d ship together, never 1b alone** (section 7.4), and **the 1f cutover completes before or at the deploy, never after** (section 5.3): once 1d is live, `bjohnston@levrauto.com` (a customer login) can no longer reach `/internal`, and Brett is the only admin.
1. **Migrations (read-only check):** Steps 1–16 are applied (`assign_search`, `claim_cron_job`, `record_payment_refund`, `revoke_login_sessions`, the `call_request_resolved_by_customer` activity type, `agent_activity_log.agent_id` nullable). No migration runs on the day.
2. **Environment:** `vercel env ls production` lists every variable the code reads (including `AGENT_SIGNIN_HASH_SECRET`) and none of the test-only switches (`AGENT_*_FORCE_*`, `AGENT_ASSIGN_SIMULATE_NO_ROTATION`, `AGENT_ADMIN_USERS_PAGE_SIZE`, `AGENT_IDLE_LIMIT_MS_OVERRIDE`); `NEXT_PUBLIC_SITE_URL` is `https://www.levrauto.com`; Supabase Email OTP Expiration is still 3600 (matches `SETUP_LINK_LIFETIME_SECONDS`).
3. **Record baseline counts** (read-only query, saved):
   - real paid searches with no agent;
   - open `agent_alerts`;
   - `agent_activity_log` rows;
   - LEVRID 1's row (admin, in rotation, linked to `bjohnston@`).
4. **1f Part A, before the merge** (section 5.3; Brett's old access keeps working): Claude runs `scripts/agent-cutover-prepare.mjs` on the branch's local server; Brett sets his password, enrolls his authenticator (plus a backup device) and signs in once on the local branch server.
5. **Merge and push:** rebase the branch on `main`, remove the branch's `git.deploymentEnabled` line from `vercel.json` in the merge commit, merge into `main`, push. Vercel builds production.
6. **Wait for Ready:** the `x-vercel-id` region is `pdx1`; the cron list shows `agent-sweeps` at `15 * * * *`.
7. **1f Part B, straight after Ready, before the sweep** (section 5.3): one SQL Editor transaction removes the holder row and runs `relink_agent_login`; Brett signs in at `www.levrauto.com/agent` as `brett@`; `bjohnston@` is refused at `/internal`.
8. **First sweep by hand:**
   ```
   curl -s -H "Authorization: Bearer $CRON_SECRET" https://www.levrauto.com/api/cron/agent-sweeps
   ```
   Expected: `assignment.assigned` and `assignment.examined` = the step 3 count of real paid searches with no agent; `assignment.testCustomersExcluded` > 0; `alerts.claimed` 0 unless nobody is in rotation.
9. **Checks after the sweep** (read-only):
   - real paid searches with no agent = **0**;
   - new `search_assignments` rows = `assigned`, method `round_robin` or `continuity`;
   - test-account searches with an agent = **0**;
   - the `agent-sweeps` lock in `cron_job_locks` is released;
   - no `[assignment-failed]`, `[agent-alert-failed]` or `[agent-activity-failed]` lines in production logs for the last 15 minutes.
10. **Smoke test as Brett:** `/internal/outreach`, `/internal/agents` load; `/internal/admin` shows assigned agents; `/internal/refunds-due` loads (no money buttons clicked); sign out and back in.
11. **Watch:** the next scheduled `:15` sweep (`assigned` 0); the next real payment gets an agent within seconds; any alert email reaches Brett's inbox.
12. **Roll back** if anything in 6–11 is wrong: Vercel Instant Rollback to the previous production deployment, then the prepared SQL that relinks LEVRID 1 to `bjohnston@` (the old code matches agents by email). The database needs no other rollback: the Phase 1 data stays valid and the old code doesn't read it.

### 5.3 Brett's cutover to brett@levrauto.com (Chunk 1f runbook, approved 2026-10-14)
Rehearsed with stand-in test accounts, 24/24 (2026-10-14). Part A runs before checklist step 3 (the merge); Part B straight after step 4 (Ready), before step 5. Starting state (checked read-only 2026-10-14): LEVRID 1 is admin, in rotation, linked to `bjohnston@` (a customer login with 1 customer record); no `brett@` login exists.

**Part A, before the merge (Brett's old access keeps working throughout)**
1. Have your authenticator app ready, ideally plus a backup device, and your password manager. Allow about 15 minutes.
2. Tell Claude to go. Claude starts the branch dev server on port 3100 and runs `scripts/agent-cutover-prepare.mjs --new-email brett@levrauto.com --levrid 1 --base http://localhost:3100`. It adds the holder row and the `brett@levrauto.com` login, and writes `~/Downloads/levr-agent-setup-link.html` (private file, link works once, lasts 1 hour). Claude shows you the ids it prints.
3. Open that file on this Mac and click "Open the setup page", then Continue.
4. Set your password.
5. Scan the QR code with your authenticator, and with the backup device too before you type a code. Enter the code. The entry will be named "levrauto.com".
6. You'll land on `/internal/outreach` showing "Brett Johnston (new login, temporary)". This is local code against the real database, so just look; don't click any actions.
7. Click Sign out, go to `http://localhost:3100/agent`, and sign in with `brett@levrauto.com`, your password and a code. You should land on the dashboard again. **This is the two-factor proof.**
8. Run this check in the SQL Editor:
   ```sql
   select a.email                                   as holder_email,
          a.levrid                                  as holder_levrid,
          a.in_rotation                             as holder_in_rotation,
          u.email                                   as new_login_email,
          u.raw_app_meta_data ->> 'account_type'    as new_login_type,
          (select count(*) from auth.mfa_factors f
            where f.user_id = u.id and f.status = 'verified') as verified_authenticators,
          (select count(*) from public.customers c where c.id = u.id) as new_login_customer_rows,
          (select b.email from public.agents b where b.levrid = 1)   as levrid1_email_still
   from public.agents a
   join auth.users u on u.id = a.auth_user_id
   where a.email = 'brett-cutover-holder@levrauto-test.invalid';
   ```
   Expected: 1 row with
   - `holder_levrid` null, `holder_in_rotation` false;
   - `new_login_email` brett@levrauto.com, `new_login_type` agent;
   - `verified_authenticators` 1 (a backup device that scanned the same QR code shares that one);
   - `new_login_customer_rows` 0;
   - `levrid1_email_still` bjohnston@levrauto.com.
9. Check that `www.levrauto.com/internal/outreach` still opens for you as `bjohnston@`.

If the link expires, Claude reruns the script for a fresh one. If you abandon Part A, run this, then delete `brett@levrauto.com` under Supabase → Authentication → Users:
```sql
begin;
delete from public.agent_activity_log
where agent_id = (select id from public.agents where email = 'brett-cutover-holder@levrauto-test.invalid');
delete from public.agents where email = 'brett-cutover-holder@levrauto-test.invalid'
returning email as removed_holder_email;
commit;
```
Expected: one `removed_holder_email` row.

**Deploy:** checklist steps 1–4 (counts, merge and push, wait for Ready). Your `bjohnston@` agent access ends at that moment. That's fine, because Part B doesn't need the app.

**Part B, right after Ready**
10. Run this as one block in the SQL Editor:
    ```sql
    begin;

    -- 1. Remove the temporary holder (its own activity rows first).
    delete from public.agent_activity_log
    where agent_id = (select id from public.agents where email = 'brett-cutover-holder@levrauto-test.invalid');
    delete from public.agents
    where email = 'brett-cutover-holder@levrauto-test.invalid';

    -- 2. Move LEVRID 1 to the new login (logged as agent_login_relinked, by LEVRID 1).
    select r.levrid       as moved_levrid,
           r.email        as moved_email,
           r.auth_user_id as moved_login_id
    from public.relink_agent_login(
      (select id from public.agents where levrid = 1),
      (select id from public.agents where levrid = 1),
      (select id from auth.users where lower(email) = 'brett@levrauto.com')
    ) r;

    commit;
    ```
    Expected: one row with `moved_levrid` 1, `moved_email` brett@levrauto.com, and `moved_login_id` the new login id from step 2. No flag route is needed; the function sets its own.
11. Run this check:
    ```sql
    select a.levrid                                  as after_levrid,
           a.email                                   as after_agent_email,
           a.role                                    as after_role,
           a.active                                  as after_active,
           a.in_rotation                             as after_in_rotation,
           u.email                                   as after_login_email,
           u.raw_app_meta_data ->> 'account_type'    as after_login_type,
           (select count(*) from auth.mfa_factors f
             where f.user_id = u.id and f.status = 'verified')            as after_verified_authenticators,
           (select count(*) from public.agents h
             where h.email = 'brett-cutover-holder@levrauto-test.invalid') as holder_rows_left,
           (select count(*) from public.agent_activity_log l
             where l.agent_id = a.id and l.action = 'agent_login_relinked') as relink_log_rows,
           (select count(*) from public.customers c
             where c.id = (select o.id from auth.users o where lower(o.email) = 'bjohnston@levrauto.com')) as old_login_customer_rows
    from public.agents a
    join auth.users u on u.id = a.auth_user_id
    where a.levrid = 1;
    ```
    Expected: 1 row with
    - `after_levrid` 1, `after_agent_email` brett@levrauto.com, `after_role` admin, `after_active` true, `after_in_rotation` true;
    - `after_login_email` brett@levrauto.com, `after_login_type` agent;
    - `after_verified_authenticators` 1, `holder_rows_left` 0, `relink_log_rows` 1, `old_login_customer_rows` 1.

    Your activity count goes from 2 to 3 (the relink row).
12. At `www.levrauto.com/agent`, sign in with `brett@levrauto.com`, your password and a code. You should land on `/internal/outreach` with the header "Brett Johnston (LEVRID 1)". On `/internal/agents`, your row should say "Two-factor on" and there should be no holder row.
13. At `www.levrauto.com/login`, sign in as `bjohnston@`. It should open `/account` as a customer, and `/internal` should send you to `/agent`.
14. Carry on with checklist step 5 (the sweep) and the rest.

**If step 12 fails:** use Vercel Instant Rollback to the previous deployment, then run:
```sql
update public.agents set email = 'bjohnston@levrauto.com' where levrid = 1
returning levrid as rolled_back_levrid, email as rolled_back_email;
```
Expected: one row, 1 / bjohnston@levrauto.com. Today's code finds agents by email, so `bjohnston@` reaches `/internal` again; the rehearsal proved this against Brett's dev server running `main`. When we redeploy later, set the email back to `brett@levrauto.com`.

---

## 6. Open questions for Brett (recommendation first)

**Answers (2026-10-12).** The questions below are kept for the record.
- **C1:** scratch customers on `@verify.invalid`, with every `.invalid` address suppressed in email (done in Chunk 0). Deleted, and checked by count, after each run.
- **C2:** replaced by the invite flow (section 7).
- **C3:** reassign through the SQL Editor (`reassign_search`) until the Phase 3 screens exist. No dropdown now.
- **C4:** Brett stays in rotation; his live rotation is never toggled during tests. Scratch assignments go when the scratch accounts are deleted (`search_assignments` cascades with the search).
  - **What does drift:** his `agents.last_assigned_at`, by test runs.
  - **Why that's harmless:** it only decides who is next among agents in rotation. While Brett is the only one, there is no one else to pick. Once others exist, a recent test run would at worst make Brett look "just assigned", so the next real search goes to someone else first.
  - **Nothing else moves:** no history row survives a deleted scratch search, assignment writes no activity row, and agent emails are suppressed outside production (Chunk 0).
- **C5:** add "This search is assigned to you." to the assigned-agent call email. Full text in section 3.5.
- **C6:** a new route, `/api/cron/agent-sweeps`, at `:15`.
- **C7:** Issue refund always refunds the full remaining fee.
- **C8:** push the branch after each approved chunk, with preview builds off.


**C1. How do I test assignment locally, given that test accounts are never auto-assigned?**
- (a) **Recommended:** scratch customers on `@verify.invalid` (undeliverable by definition), with `sendEmail` suppressing every `.invalid` address. They count as real for assignment, can't receive mail, are created directly in the database (never paid through Checkout), and are deleted the same session.
- (b) Only test assignment through rolled-back SQL, as in Steps 4 and 9. This doesn't exercise the webhook or sweep code.
- (c) Add a local-only override to `is_test_customer`, which needs a migration. Not recommended.

**C2. Replaced (2026-10-12).** Agents are linked only by the invite (section 7). There is no link-by-email on sign-in.

**C3. Reassignment before the Phase 3 screens.**
- (a) **Recommended:** leads use `reassign_search` in the SQL Editor (one line, which I'll document) until Phase 3. The server action exists but has no button.
- (b) Add a small "Reassign" dropdown to the `/internal/admin` table now. Agent-facing wording would need sign-off, and it would be rebuilt in Phase 3.

**C4. Keeping test assignments off you during local verification.** Round-robin would otherwise pick you for scratch searches, since you're the only person in rotation.
- (a) **Recommended:** during each local assignment test, take you out of rotation under the flag route and put a scratch agent in, then restore you. That's two logged changes per test, restored and checked by query.
- (b) Leave you in rotation and accept scratch searches briefly assigned to you; they're deleted after.

**C5. The assigned-agent call email.**
- (a) **Recommended:** keep the text unchanged.
- (b) Add the line `This search is assigned to you.` at the top.

**C6. Where the hourly sweeps run.**
- (a) **Recommended:** a new `/api/cron/agent-sweeps` at `:15`.
- (b) Inside the existing `:00` solidify job, so there's one fewer cron, but a failure in one delays the other.

**C7. Issue refund amount.**
- (a) **Recommended:** always the full remaining balance of the search fee (the guarantee is a full refund). Partial or other refunds go through the cancellation form.
- (b) Allow an editable amount.

**C8. Pushing the branch.**
- (a) **Recommended:** push it to GitHub after each approved chunk (backup and sync), with preview builds off for that branch.
- (b) Keep it local only until deploy day.


---

## 7. Agent sign-in (Brett's decisions, 2026-10-12)

### 7.1 Decisions
1. **A separate agent sign-in** at `levrauto.com/agent`, with an internal look (no marketing header or footer). It lands on the agent dashboard (`/internal/outreach` until Phase 3). Customer sign-in (`/login`) is unchanged.
2. **Sign-in is work email + password + required two-factor** (an authenticator-app code).
   - Two-factor is enforced **server-side on every agent page and every agent action**, not just at sign-in.
   - Every wrong sign-in detail gets the same generic error.
   - Attempts are rate-limited.
3. **Invite-only.** A lead or admin adds an agent, the agent gets an invite link, sets a password, and enrolls two-factor before reaching anything.
   - Agents can never sign themselves up.
   - The customer sign-up can never create or link an agent.
4. **Agent and customer accounts are fully separate.** An agent login is never a customer login.
5. **LEVRID** (Step 11, section 7.6).
6. **Later, not now:** passkeys or hardware security keys as a second-factor option (section 7.8).

### 7.2 What Supabase supports (from its docs, checked 2026-10-12)
- **Two-factor (TOTP authenticator app)** is built in: `mfa.enroll({ factorType: 'totp' })` returns a QR code and a secret, then `mfa.challenge` and `mfa.verify`. "If the verification succeeds, the factor immediately becomes active." ([TOTP guide](https://supabase.com/docs/guides/auth/auth-mfa/totp))
- **Assurance levels.** `aal1` = signed in with a password (or similar); `aal2` = a second factor also verified. The level is in the session token's `aal` claim, and server code can read it with `mfa.getAuthenticatorAssuranceLevel()`. ([MFA guide](https://supabase.com/docs/guides/auth/auth-mfa))
  - The same guide shows enforcing it in RLS with `(select auth.jwt()->>'aal') = 'aal2'` as a *restrictive* policy.
  - It recommends redirecting users at the wrong level to a sign-in step rather than returning an error.
- **Admin factor reset:** `auth.admin.mfa.deleteFactor({ id, userId })` deletes a user's factor. It requires the service role, and it logs the user out of all active sessions if the factor was verified. ([JS reference](https://supabase.com/docs/reference/javascript/auth-admin-mfa-deletefactor))
- **Invites and links:**
  - `auth.admin.inviteUserByEmail` sends an invite. ([reference](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail))
  - `auth.admin.generateLink` creates invite, magic-link and recovery links "to be sent via a custom email provider". ([reference](https://supabase.com/docs/reference/javascript/auth-admin-generatelink))
  - `auth.admin.createUser` creates a user server-side. ([reference](https://supabase.com/docs/reference/javascript/auth-admin-createuser))
- **Where to store "this is an agent account":** `raw_app_meta_data` cannot be updated by the user, so it's a good place for authorization data. `raw_user_meta_data` can be changed by the signed-in user and must not be trusted. ([RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security), [Users](https://supabase.com/docs/guides/auth/users))
- **Built-in rate limits** (per IP address):
  - password sign-in 150 requests per 5 minutes, configurable;
  - two-factor challenge/verify 15 per minute, **not configurable**.

  ([Rate limits](https://supabase.com/docs/guides/auth/rate-limits))
- **Hooks:** a per-user "MFA verification attempt" hook can reject repeated wrong codes, but it's on the **Teams/Enterprise** plans only ([MFA verification hook](https://supabase.com/docs/guides/auth/auth-hooks/mfa-verification-hook)). So per-account limits are built in our own code (section 7.4).
- **Passkeys:** Supabase added passkey *sign-in* as a **beta** (changelog, May 2026). WebAuthn as a *second factor* is still marked experimental. ([changelog](https://supabase.com/changelog/46458-passkeys-for-supabase-auth-beta), [Swift MFA reference](https://supabase.com/docs/reference/swift/auth-mfa-api))
- **Usernames:** Supabase Auth signs users in with an email (or phone) and password. There's no username field (same docs).

### 7.3 Keeping agent and customer accounts separate
Today, every new Supabase login gets a `customers` row from the `handle_new_user()` trigger. So inviting an agent would wrongly create a customer.

**Step 12 (a migration, written after this plan is approved)** makes the separation structural:
1. **Marking agent logins.** An agent login is created **server-side only**, with `auth.admin.createUser({ email, app_metadata: { account_type: 'agent', agent_id } })`. `app_metadata` can't be set or changed by the user, so a customer can never mark themselves as an agent.
2. **The sign-up trigger.** `handle_new_user()` skips creating a `customers` row when `raw_app_meta_data->>'account_type' = 'agent'`. It only looks at `app_metadata`; a customer putting `account_type` in their own sign-up data changes nothing.
3. **One login per agent.** `agents.auth_user_id` is set only by the invite step, which knows the new login's id, and by Brett's cutover function. A check refuses linking an `agents` row to a login that has a `customers` row.
4. **`agent_signin_attempts`** (email hash, IP hash, time, outcome), for per-account and per-IP limits. It gets both locks.
5. **New activity types:** `agent_invited`, `agent_two_factor_enrolled`, `agent_two_factor_reset`, `agent_login_relinked`.
6. **A `relink_agent_login(p_actor, p_agent_id, p_new_auth_user_id)` function** (admin only, logged), used once for Brett's cutover (section 7.7).

**What every agent page and action checks (Chunk 1d), on the server, every request:**
1. A valid session (`getUser`, verified by Supabase).
2. `app_metadata.account_type = 'agent'`.
3. An **active** `agents` row whose `auth_user_id` is this login.
4. The session's `aal` is `aal2`.

- If any fails, the page redirects to `/agent` (or to the two-factor step when only 4 fails), and the action returns the generic "not authorized".
- **Customer pages refuse agent accounts** the same way, so an agent login can't use `/account`.
- **Database layer:** agent data is read with the service role, so RLS doesn't see the agent's session. The `aal2` check therefore lives in `getAuthorizedAgent()`, the one function all 19 agent entry points already go through. If agent pages ever move off the service role, the restrictive `aal2` RLS policy from Supabase's guide is the second layer.

### 7.4 Sign-in, rate limiting and errors (Chunk 1b)
- **`/agent` is its own route group** with an internal layout: no `SiteHeader` or `SiteFooter`. The root layout's header and footer move into a site route group so `/agent` and `/internal/*` don't get them.
- **Steps:**
  1. email + password (`signInWithPassword`);
  2. if the account isn't an agent, or the password is wrong, the generic error;
  3. if it's an agent with a verified TOTP factor, the code step (challenge + verify);
  4. if it's an agent with no factor yet, straight to enrollment (an invited agent finishing setup).
- **The same generic error** for a wrong email, a wrong password, a wrong code, an unknown or deactivated agent, or a customer account. The response shape and timing are kept the same, so nothing reveals which part was wrong.
- **Rate limits:**
  - Supabase's per-IP limits apply underneath (section 7.2);
  - ours: 5 failed attempts per account per 15 minutes, and 20 per IP per 15 minutes, counted in `agent_signin_attempts`. Then `Too many sign-in attempts…` until the window passes;
  - successful sign-ins are recorded too, for the team activity screen in Phase 3.

**Chunk 1b review (Brett, 2026-10-12):**
- **⚠ Chunk 1b must never deploy without Chunk 1d.** 1b lets an agent sign in with a password and code, but only 1d makes every agent page and action require the code (`aal2`). Deployed alone, an agent who stops after the password step would still reach agent pages through the old email check. The deploy-day checklist (section 5.2) treats 1b and 1d as one unit.
- **The marketing header comes off `/internal/*` in Chunk 1d** (not Phase 3), using the same `SiteChrome` wrapper 1b added for `/agent`.
- **Scrambling key:** emails and IPs in `agent_signin_attempts` are keyed with a dedicated secret, `AGENT_SIGNIN_HASH_SECRET` (at least 32 characters), not the service-role key. If it's missing, sign-in fails closed with the generic error. Brett adds it to `.env.local` and to Vercel Production himself.
- **Wording changes, signed off:** heading `Agent sign-in` (the browser title stays `LEVR Auto agent sign-in`), and under Verify: `Lost access to your authenticator? Contact your lead.`

**Chunk 1d review (Brett, 2026-10-13):**
- **Agent header wording signed off:** `LEVR Auto · Agent` · `{agent name} (LEVRID {n})` · `Sign out`, busy `Signing out…`. A test agent with no LEVRID shows just the name.
- **The pages' own "Signed in as … (email)" lines are removed when the Phase 3 shell lands** (the header now says who is signed in). Not before.
- **For the Phase 3 shell (Brett, 2026-10-13):** the `/internal` pages are dark while the `/agent` sign-in pages are light, so pick one look for both; and on phones the agent header wraps onto two lines (logo, then name and Sign out), which the shell should fit on one.
- **Link lifetime confirmed:** Supabase Email OTP Expiration is 3600 seconds, so the emails say "expires in 1 hour" (`SETUP_LINK_LIFETIME_SECONDS`).
- Agreed: the idle timer counts from the later of the last request and the last sign-in; agent logins are sent away from customer pages; Brett's current agent access ends at deploy until 1f moves him to `brett@levrauto.com`.
- The three page-only loaders (`getAdminSearches`, `getUnconfirmedAliases`, `getConfirmedDealerships`) are no longer server actions; all 41 remaining agent actions were called directly with no session, a customer session and a password-only agent session: 123 of 123 refused with "Not authorized.", no table changed.

**C16. Role-gated pages and actions (proposed 2026-10-13; Brett to choose; not applied).** Rule of thumb: everything an agent needs to work a customer's deal stays open to every agent (refunds included, Brett's rule); things that publish publicly or undo someone else's work go to leads; nothing today needs admin. Each gate is set on the page (`requireAgent({ minRole })`) AND in each action (`getAuthorizedAgent({ minRole })`).
- **Agent:** `/internal/outreach` and its actions; `/internal/refunds-due` and the cancellation refund form; customer lookup; extension bypass and agent-comped switch (fee waivers, reason required and logged; the two to make lead if waivers should be tighter); `/internal/dealerships` confirm and salespeople.
- **Lead:** `revertPurchasedSearch` (undoes a closed deal); `mergeAliasIntoDealership` (not easily undone, changes ratings data); `/internal/admin` (oversight of every agent's work); `/internal/articles` and `/internal/social` (approving publishes publicly).
- Team actions stay as the database already enforces them.

**Chunk 1e review (Brett, 2026-10-14):**
- **Step 14 applied:** `revoke_login_sessions(p_auth_user_id)` (security definer, service role only). The reset ends every session FIRST, then removes the authenticators: deleting an authenticator alone left an open two-factor session working (found by the 1e test). The agent check also refuses any login with no verified authenticator right now.
- **No internal route for resets:** a shared secret plus a caller-supplied actor would let anyone with the secret act as any admin, and it would reuse the cron secret for a different job. The reset is a **"Reset two-factor" action on the Chunk 1g Add-agent page**, behind agent sign-in and two-factor, with the actor taken from the session and the same role rules. Until 1g, resets aren't needed (Brett is the only agent).
- **Reset email wording signed off** with "right away": `{lead/admin name} reset your two-factor sign-in. The next time you sign in, you'll set it up again. If you didn't ask for this, contact {lead/admin name} right away.` Route-era messages signed off and kept for the 1g action: `You can't reset your own two-factor sign-in.`, `Only leads and admins can reset an agent's two-factor sign-in.`, `Only admins can reset a lead's or an admin's two-factor sign-in.`, `That agent hasn't set up a login yet.`, `Agent not found.`, `Could not sign the agent out: …`.
- **C16 approved as tested.**

**Chunk 1g review (Brett, 2026-10-14): approved, branch pushed at `5aef2c9`.**
- **Wording signed off as shown**, including the help line with "1 hour" and all the new list, status and reset text.
- **Test agents are shown with a TEST badge outside production only**; in production they're hidden (Step 13).
- **Rotation defaults confirmed by test:** the form sends no rotation value for a real `@levrauto.com` address (`add_agent` then defaults agent = in rotation, lead/admin = out), and `false` for a test address. Checked at both layers: the real `addAgent` with the database call captured (nothing written), and `add_agent` called directly with test addresses (no LEVRID spent).
- **A LEVRID is spent when someone is added**, so adding with a typo'd email uses up that number. The fix is to deactivate that row and add the person again. Editing an agent's email can come with the Phase 3 team screen.
- **For the Phase 3 shell:** long emails wrap mid-address in the Work email column; handle it in the new layout.

**Found in the 1f rehearsal (2026-10-14), approved by Brett the same day: sign-outs that should be this browser only.** `signOut()` ends every session on the login by default. A customer (or Brett's old login) refused at `/agent` was signed out of their other devices too, and an idle device would sign an agent out of the device they were actively using. The refusals (agent sign-in, customer `/login` refusing an agent, setup-link accept) and the 8-hour idle sign-out now use `scope: "local"`; the header Sign out is unchanged. Branch commit `eace17f`, approved and pushed with the prepare script (`113f9f2`). **Chunk 1 (1a–1g, 1f rehearsed) is complete.**

**Forgot password: open question C15 (Brett to choose; not built).**
- **(a) Recommended: self-serve reset by email to the work address.**
  - **Why:** a password reset alone gets nobody in. The agent still needs their authenticator code (`aal2`), so a stolen inbox isn't enough. Self-serve saves a lead a call for the most common problem (a forgotten password).
  - **Cost:** it reuses Chunk 1c's set-password page and one-time link (the `/auth/confirm` pattern), so it's small.
  - **Leaks nothing:** the confirmation never says whether the address is an agent. It's rate-limited with the same counters as sign-in, and an email is only sent to an active agent's agent-only login.
  - **Wording:**
    - link under the password field: `Forgot your password?`;
    - page heading `Reset your password`; field `Work email`; button `Send reset link` · busy `Sending…`;
    - confirmation (always the same): `If that's an agent's work email, we've sent a link to reset the password. Check your inbox.`;
    - email subject: `Reset your LEVR Auto agent password`;
    - email body: `Use this link to set a new password for the LEVR Auto agent dashboard. It works once and expires in {expiry}. You'll still need your authenticator code to sign in. If you didn't ask for this, you can ignore this email: {link}`;
    - set-password page: the same as the invite (`Set your password`, `New password` · `Confirm password`, the password rule, `Continue`).
  - **Note:** the link lifetime is one project-wide Supabase setting, shared with customer sign-up and reset links (and with the invite, which section 3.6 says lasts 24 hours). `{expiry}` is filled from that setting, so the two emails can't disagree with it.
- (b) No self-serve: a line under the password field, `Forgot your password? Contact your lead.`, and a lead or admin sends a fresh invite-style link (Chunk 1g's form or the 1e route). Simplest, but every forgotten password needs a person.

### 7.5 Invite and two-factor recovery (Chunks 1c and 1e)
**Invite flow:**
1. A lead or admin adds the agent (until the Phase 3 screens: an internal CRON_SECRET-gated route, run like the seed route; open question C9). That runs `add_agent` (the agents row, with its LEVRID), then `auth.admin.createUser` with `app_metadata.account_type = 'agent'` and no password, then sets `agents.auth_user_id`.
2. A one-time link from `auth.admin.generateLink({ type: 'recovery' })` is sent **by our own email** (ZeptoMail, wording in section 3.6) to `/agent/accept`, which verifies it on click (the same `/auth/confirm` pattern, so inbox scanners can't use it up).
3. The agent sets a password (the existing password rule).
4. Enrollment page: QR code and secret, then the first code. Nothing else is reachable until it verifies, which takes the session to `aal2`.
5. Logged as `agent_invited` (by the inviter) and `agent_two_factor_enrolled`.

**Two-factor recovery (lost phone):**
- **Who can reset:** a lead for an agent; an admin for anyone. Never your own; the last admin is covered below.
- **How:** the reset calls `auth.admin.mfa.deleteFactor`, which per Supabase also signs that agent out of every session. The next sign-in takes them to enrollment again. Logged as `agent_two_factor_reset`, and the agent gets the email in section 3.6.
- **Before resetting,** the lead or admin confirms it's really the agent, by phone or video, never by email alone. This is a written rule in the team guide.
- **Backup device:** agents may enroll a second authenticator (Supabase supports several factors), so a lost phone doesn't lock them out.
- **No recovery codes:** Supabase doesn't provide them. Building our own isn't recommended now.
- **The last admin losing their phone** (Brett, today): a break-glass step in the SQL Editor or a CRON_SECRET-gated route that deletes the factor with the service role, logged. Written up in CLAUDE.md before the deploy.

### 7.6 Step 11: LEVRID (written; Brett runs it)
**File:** `supabase/migrations/20261012120000_agent_levrid.sql`. Offline parser: 18 statements, 2 function bodies; the test block also parses.

**What it does:**
- `agents.levrid integer unique`, a plain sequential number starting at 1.
- **Numbering.** A one-row `agent_levrid_counter` table holds the last number issued. A trigger on `agents` takes the next one inside the inserting transaction. Postgres sequences skip numbers when a transaction rolls back; this counter rolls back too, so rolled-back or failed adds never burn a number. The counter only goes up and LEVRIDs are unique, so a number is never issued twice, even if a row were ever deleted.
- **Test agents** (`@levrauto-test.invalid`) get **no** LEVRID, so verification never uses up real numbers. Every other agent must have one (check constraint).
- **Backfill:** existing non-test agents are numbered in creation order, so **Brett is 1**. The counter is set to the highest number.
- **Guard:** a trigger refuses setting a LEVRID by hand on insert, and changing or clearing it on update. The backfill uses a transaction-local flag (`levr.levrid_admin`), switched off before commit.
- **`add_agent`:** replaced with the same signature, adding the LEVRID to its `agent_added` activity row. Its return row already includes every agents column.
- The counter table gets both locks.

**Run:** paste the whole file in a new SQL Editor query and click Run. It's one transaction, so if it errors nothing is applied.

**Verify:**

```sql
-- A. Brett and the counter: expect bjohnston@levrauto.com | 1 | 1 | 1
select (select email from public.agents where levrid = 1) as levrid_1,
       (select levrid from public.agents where lower(email) = 'bjohnston@levrauto.com') as brett_levrid,
       (select last_value from public.agent_levrid_counter) as counter,
       (select count(*) from pg_trigger where tgname = 'agents_levrid') as levrid_trigger;

-- B. grant check including the counter table: expect 2 rows, every can_* false
select c.relname as table_name, r.role_name,
       has_table_privilege(r.role_name, c.oid, 'SELECT') as can_select,
       has_table_privilege(r.role_name, c.oid, 'INSERT') as can_insert,
       has_table_privilege(r.role_name, c.oid, 'UPDATE') as can_update,
       has_table_privilege(r.role_name, c.oid, 'DELETE') as can_delete,
       has_table_privilege(r.role_name, c.oid, 'TRUNCATE') as can_truncate
from pg_class c cross join (values ('anon'), ('authenticated')) as r(role_name)
where c.relnamespace = 'public'::regnamespace and c.relname = 'agent_levrid_counter'
order by 1, 2;

-- C. rules, rolled back. Run all lines together. Expect every row pass = true.
begin;
create temp table p11 (n int, test text, expected text, result text) on commit drop;
do $$
declare
  v_brett uuid; v_real public.agents; v_real2 public.agents; v_test public.agents; v_tmp text;
begin
  select id into v_brett from public.agents where lower(email) = 'bjohnston@levrauto.com';
  v_real := public.add_agent(v_brett, 'p11-real@verify.invalid', 'P11 Real');
  insert into p11 values (1, 'next real agent gets LEVRID 2', '2', v_real.levrid::text);
  v_real2 := public.add_agent(v_brett, 'p11-real2@verify.invalid', 'P11 Real 2');
  insert into p11 values (2, 'and the one after gets 3', '3', v_real2.levrid::text);
  v_test := public.add_agent(v_brett, 'p11-test@levrauto-test.invalid', 'P11 Test');
  insert into p11 values (3, 'a test agent gets no LEVRID', 'null', coalesce(v_test.levrid::text, 'null'));
  insert into p11 values (4, 'activity row records the LEVRID', '2',
    (select details->>'levrid' from public.agent_activity_log
      where action = 'agent_added' and details->>'agent_id' = v_real.id::text));
  perform public.set_agent_active(v_brett, v_real.id, false);
  insert into p11 values (5, 'deactivating keeps the LEVRID', '2',
    (select levrid::text from public.agents where id = v_real.id));
  begin update public.agents set levrid = 99 where id = v_real2.id; v_tmp := 'allowed';
  exception when others then v_tmp := 'refused'; end;
  insert into p11 values (6, 'changing a LEVRID by hand', 'refused', v_tmp);
  begin insert into public.agents (email, name, levrid) values ('p11-x@verify.invalid', 'X', 50); v_tmp := 'allowed';
  exception when others then v_tmp := 'refused'; end;
  insert into p11 values (7, 'setting a LEVRID on insert by hand', 'refused', v_tmp);
  begin update public.agents set levrid = null where id = v_real2.id; v_tmp := 'allowed';
  exception when others then v_tmp := 'refused'; end;
  insert into p11 values (8, 'clearing a real agent''s LEVRID', 'refused', v_tmp);
  insert into p11 values (9, 'counter after two real adds', '3',
    (select last_value::text from public.agent_levrid_counter));
end $$;
set constraints all immediate;
select n, test, expected, result, (expected = result) as pass from p11 order by n;
rollback;

-- D. the rollback gave nothing away: expect 1 | 1 | 0 | 0
select (select last_value from public.agent_levrid_counter) as counter,
       (select max(levrid) from public.agents) as highest_levrid,
       (select count(*) from public.agents where email like 'p11-%') as test_agents,
       (select count(*) from public.agent_activity_log where action = 'agent_added') as agent_added_rows;
```

**Undo:**

```sql
begin;
drop trigger agents_levrid on public.agents;
drop function public.agents_levrid();
alter table public.agents drop constraint agents_levrid_required;
alter table public.agents drop column levrid;
drop table public.agent_levrid_counter;
-- then re-run the add_agent block from 20261011220000_agent_team_functions.sql as "create or replace"
commit;
```

### 7.7 Separating Brett's agent login from his customer data (open question C10)
- **Today:** `bjohnston@levrauto.com` is one Supabase login that is both a customer (it has a `customers` row, used by our rolled-back tests and possibly real customer history) and the agent (`agents.auth_user_id`, linked in Step 10).
- **The agent record's id never changes** in any option below, so all agent history (activity rows, LEVRID 1, assignments) stays attached to it.

| Option | What happens | For | Against |
|---|---|---|---|
| **A. New agent login, keep the old one as a customer (recommended)** | Create a new agent-only login (for example `brett@levrauto.com`, a Zoho alias) through the invite flow, then `relink_agent_login` points agent LEVRID 1 at it and updates `agents.email`. `bjohnston@levrauto.com` becomes a customer login only, with its `customers` row and history untouched. | Nothing customer-side moves; the agent history keeps its id; reversible by relinking again | Brett has two logins (one per role), which is the decision |
| B. Keep `bjohnston@levrauto.com` as the agent login and move the customer data to a new customer login | Re-own every customer-side row (searches, offers, messages, payments, surveys) to a new `customers` row | `bjohnston@` stays the agent address | Re-owning customer history touches many tables, with real risk of a missed foreign key; not recommended |
| C. Keep `bjohnston@levrauto.com` as the agent login and delete its customer side | Delete the customer row and its test-only data | Simple | Loses whatever customer history it holds; can't be undone |

**Order for A, on deploy day (Chunk 1f):**
1. Step 12 has run, and the sign-up trigger skips agent logins.
2. Invite the new address; Brett sets a password and enrolls two-factor.
3. An admin runs `relink_agent_login`. It's a SQL Editor step under the flag route, because Brett is the only admin.
4. Check that `bjohnston@levrauto.com` can no longer reach `/internal/*`, and that the new login can.

### 7.8 Later: passkeys and hardware security keys
Supabase offers passkey **sign-in** as a beta, and WebAuthn as a **second factor** is experimental (section 7.2). When the second-factor version is generally available, add "security key or passkey" as another factor agents may enroll alongside the authenticator app. Nothing in this plan blocks that: the checks only require `aal2`, not a particular factor type.

### 7.9 Open questions about sign-in

**C9. Answered (2026-10-12): a minimal "Add agent" form now (Chunk 1g).**
- Fields: name, work email, role.
- Leads can add agents; only admins can add leads or admins (the same rules `add_agent` enforces).
- Behind agent sign-in and two-factor.
- Plain styling, restyled with the Phase 3 shell.
- It sends the invite.
- Wording is in section 3.8.

*Original question, kept for the record:* **C9. Adding agents before the Phase 3 team screens.**
- (a) **Recommended:** a CRON_SECRET-gated internal route (`POST /api/internal/invite-agent` with the actor's LEVRID, the email and the role), run by Brett with curl. It enforces the same rules as `add_agent`.
- (b) Build a minimal invite form now, which goes against the "hold the team screens" decision.

**C10. Answered: option A.**
- A new agent-only login, `brett@levrauto.com` (a Zoho alias Brett will set up and confirm receives mail; I'll ask for it before Chunk 1f's rehearsal).
- `bjohnston@levrauto.com` stays a customer login with its data untouched.
- LEVRID 1 moves to the new login on deploy day (1f).

**C11. Answered: the @levrauto.com work email.** The Add-agent form only accepts `@levrauto.com` addresses in production; disposable test agents use `@levrauto-test.invalid`, and only outside production.

*Original question:* **C11. Agent usernames.**
- (a) **Recommended:** the agent's **@levrauto.com work email**. Supabase signs in by email, invites and resets go to it, and when someone leaves, their work email is turned off too.
- (b) A separate username. It would need our own username-to-email lookup in front of Supabase's email sign-in, and a separate place for invites and resets to go. More to build and more to get wrong, for no security gain.

**C12. Answered:** leads reset two-factor for agents, admins for anyone, never their own.

*Original question:* **C12. Two-factor reset rule.**
- (a) **Recommended:** as you expected, leads for agents and admins for anyone, never your own. The last admin uses the break-glass step; the reset confirms identity by phone or video first; and agents are encouraged to enroll a backup device.
- (b) Admins only.

**C13. Answered:** agents are signed out after **8 hours idle**. The app tracks the last agent request, and on the next request past 8 hours it signs out and sends them to `/agent`.

*Original question:* **C13. Session length for agents.** Supabase's session timeouts apply to the whole project, customers included.
- (a) **Recommended:** keep the project setting, and add an agent-only idle sign-out in the app (for example 8 hours without activity).
- (b) No extra limit.
