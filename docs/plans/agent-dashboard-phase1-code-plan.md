# Agent dashboard Phase 1: code plan

**Status:** plan only (2026-10-12). No code has been written.

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
| Assigning real searches, sending emails, or calling Stripe from a preview | One helper, `src/lib/runtime-env.ts`, provides `isPreviewDeploy()`. Every new side-effecting path refuses to run on a preview: the payment-time assignment, the sweeps, alert emails, refund issuing and recording, and the assigned-agent call email. Stripe's webhook only points at `www`, so a preview never receives payments in the first place. |
| Local testing reaching a real inbox or real money | Local `next dev` uses the production database, Stripe **test mode** keys, and the real ZeptoMail key. So:<br>(1) all test data is on disposable scratch accounts, created, used, deleted and confirmed by count;<br>(2) scratch agents are inserted with `in_rotation = false`, so no real payment can be assigned to one;<br>(3) outside production, agent and alert emails are only ever sent to `@levrauto-test.invalid` recipients, which `sendEmail` already suppresses. Any other recipient is logged, not sent. So local testing never emails Brett;<br>(4) refunds only touch payments on scratch accounts, in Stripe test mode. |

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
| 1 | Role-aware sign-in | no |
| 2 | Activity logging on every agent action | no |
| 3 | Assignment at payment, the hourly sweep, and lead reassignment (server action only) | no |
| 4 | Alert-email sweep | no |
| 5 | Guarantee refunds on `/internal/refunds-due`, and the per-refund reason on the cancellation form | **yes** |
| 6 | Call-request resolution and assigned-agent call emails | **yes** |
| 7 | Queue fixes | **yes** (admin table) |
| 8 | Deploy rehearsal | no |

### Chunk 0: branch and safety rails
- **Changes:**
  - create the branch;
  - `vercel.json`: preview builds off for the branch;
  - new `src/lib/runtime-env.ts` (`isProductionDeploy()`, `isPreviewDeploy()`, `isLocalDev()`);
  - `src/lib/email.ts`: suppress every `.invalid` recipient (needs C1), and outside production never send agent or alert emails to anything but test-suffix recipients. The guard goes at the top, before the env checks, the same placement rule as the existing test-account guard.
- **Files:** `vercel.json`, `src/lib/runtime-env.ts`, `src/lib/email.ts`.
- **Verified by:**
  - `next build` and `tsc --noEmit` pass;
  - a unit-style script calls `sendEmail` with five recipients (`x@levrauto-test.invalid`, `x@verify.invalid`, `x@levrauto.invalid`, a real address in local mode, a real address with `VERCEL_ENV=production` set) and checks the console output. Expected: suppressed / suppressed / suppressed / suppressed-not-production / send attempted. The production case runs with a fake ZeptoMail key so nothing goes out;
  - after pushing the branch, the Vercel deployments list shows **no** new deployment for it.

### Chunk 1: role-aware sign-in
- **Changes:** `getAuthorizedAgent()` returns `{ id, name, email, role, inRotation }`.
  - It matches `agents.auth_user_id = user.id` first.
  - If there's no match, it looks for an active agent with `lower(email) = lower(user.email)` and **no** `auth_user_id` yet, and links it (first sign-in of a newly added agent; open question C2). Deactivated agents return null.
  - New `hasRole(agent, min)`, `requireAgent({ minRole })` and `getAuthorizedAgent({ minRole })`. All 19 current callers keep their current behaviour (minimum role agent).
  - Lead-only and admin-only checks are added only where a later chunk needs them.
- **Files:** `src/lib/agent-auth.ts`, and the 19 callers (type changes only, behaviour unchanged).
- **Verified by:**
  - headless Chrome with its own profile, signing in as three scratch logins against local dev:
    1. scratch agent A, `auth_user_id` not yet set: `/internal/outreach` loads, and A's `auth_user_id` becomes A's login id (checked by query);
    2. A again: loads through the id match (log line);
    3. scratch customer C (not an agent): redirected to `/`;
  - then A deactivated through `set_agent_active`, run by hand under the flag route, and A redirected to `/`;
  - all scratch rows deleted, confirmed 0 by count. Brett's own row is not touched; it was already linked in Step 10.

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
- **Optional addition, open question C5:** one line at the top, `This search is assigned to you.`

### 3.6 Customer-facing wording
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

### 5.2 Deploy-day checklist (after the tester round, on Brett's go-ahead)
1. **Brett confirms:** the tester round is over; any tester cleanup is done or deferred; every chunk is approved; all wording in section 3 is signed off.
2. **Counts before the deploy** (read-only query, saved):
   - real paid searches with no agent, expected = real paid searches since Step 10;
   - open `agent_alerts`;
   - `agent_activity_log` rows.
3. **Merge and push:** rebase the branch on `main`, remove the branch's `vercel.json` setting, merge into `main`, push. Vercel builds production.
4. **Wait for the deployment to be Ready.** Check the `x-vercel-id` region is `pdx1`, and that the cron list shows `agent-sweeps` at `15 * * * *`.
5. **Run the first sweep by hand:**
   ```
   curl -s -H "Authorization: Bearer $CRON_SECRET" https://www.levrauto.com/api/cron/agent-sweeps
   ```
   Expected response:
   - `assigned` = the count from step 2;
   - `skipped_test` = the number of paid test-account searches;
   - `alerts_sent` = 0, or the number of alerts if nobody was in rotation.
6. **Check after the sweep** (read-only):
   - real paid searches with no agent = **0**;
   - `search_assignments` rows added = `assigned`, with method `round_robin` or `continuity`;
   - test-account searches with an agent = **0**;
   - no `[agent-activity-failed]` or error lines in production logs for the last 15 minutes.
7. **Smoke test as Brett:**
   - `/internal/outreach` and `/internal/admin` load, and the admin table shows assigned agents;
   - `/internal/refunds-due` loads; no money buttons are clicked unless a real refund is due.
8. **Watch:**
   - the next scheduled `:15` sweep runs (cron log) with `assigned 0`;
   - the next real payment, if any, gets an agent within seconds (webhook) rather than waiting for the sweep.
9. **Roll back** if anything in 5–8 is wrong: Vercel "Instant Rollback" to the previous production deployment. The database needs no rollback; the Phase 1 data stays valid and unused by the old code.

---

## 6. Open questions for Brett (recommendation first)

**C1. How do I test assignment locally, given that test accounts are never auto-assigned?**
- (a) **Recommended:** scratch customers on `@verify.invalid` (undeliverable by definition), with `sendEmail` suppressing every `.invalid` address. They count as real for assignment, can't receive mail, are created directly in the database (never paid through Checkout), and are deleted the same session.
- (b) Only test assignment through rolled-back SQL, as in Steps 4 and 9. This doesn't exercise the webhook or sweep code.
- (c) Add a local-only override to `is_test_customer`, which needs a migration. Not recommended.

**C2. Linking a new agent's login.** You said case-insensitive email matching is no longer needed. But an agent added through `add_agent` has no `auth_user_id` until they first sign in.
- (a) **Recommended:** link by email once, only when the agent's `auth_user_id` is still empty, then match by id forever after.
- (b) Make `add_agent` require the login's user id up front, so you look it up in Supabase Auth before adding someone.

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
