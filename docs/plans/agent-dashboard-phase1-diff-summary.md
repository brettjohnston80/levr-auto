# Agent dashboard Phase 1: what the deploy changes (written for Brett, 2026-10-14)

The branch `agent-dashboard-phase1-code` against `main`: **89 files** under `src/`, `scripts/` and `vercel.json` (45 new, 44 changed; about 4,900 lines added, 500 removed). The database side (Steps 1–16) is already applied in production; nothing in the deploy changes the database. A merge rehearsal (2026-10-14) rebased the branch onto `main` with no conflicts, and the merged result type-checks and builds; lint shows the same 9 older errors as `main`, none new.

## What customers notice
Almost nothing, by design. No customer-facing wording changes (plan section 3.7).
- **Intake "listings near you" count** is now complete for popular models (it stopped at 1,000 listings).
- **Asking for a call again:** after an agent resolves a switch or cancellation call request, the customer can request another one.
- **Agent accounts can't use customer pages**, and customer accounts can't reach agent pages.

## What agents notice
- **A separate agent sign-in** at `/agent`: work email, password and a two-factor code, invite-only, with self-serve password reset and an 8-hour idle sign-out. Every agent page and action re-checks two-factor on the server. Agent pages get their own header (name and LEVRID, Sign out). *(Chunk 1)*
- **Add an agent** (`/internal/agents`): invite, resend, the agents list with sign-in status, and two-factor reset. *(Chunk 1g)*
- **Role gates:** leads (and admins) for `/internal/admin`, articles, social posts, merging dealerships and undoing a purchase; everything needed to work a deal stays open to every agent. *(C16)*
- **Searches are assigned automatically** when a customer pays (or switches), with an hourly backstop at :15. *(Chunk 3)*
- **Alert emails** to leads or admins when nobody is in rotation, a search can't be assigned, or an action isn't recorded. *(Chunk 4)*
- **Refunds due:** Issue refund (the $699 plus any $100 paid-switch fees) and Record a refund already issued in Stripe; the cancellation form has a refund Reason per line. *(Chunk 5)*
- **Call requests:** Mark call resolved with neutral outcomes; the call-request email goes only to the assigned agent. *(Chunk 6)*
- **Queues that were cut off at 1,000 rows** now show everything: callback requests, the admin table (now with the assigned agent), dealership counts and aliases, the outreach dealer list and listing dropdown, the agent finalize form's trims. The outreach page also no longer fails with many active searches. *(Chunks 7 and 7b)*
- **Every agent action is recorded** in the activity log, with who did it. *(Chunk 2)*

## Behind the scenes
- **Safety rails:** the app tells local, preview and production apart; preview builds never run side effects; agent email outside production is logged, never sent; `.invalid` addresses never receive email. *(Chunk 0)*
- **Scheduled jobs:** the new `agent-sweeps` cron at `15 * * * *`. The Day-60 reminder, pause and resume-reminder jobs, the notification digest and the article reminder run unchanged in production, but outside production they now run only on the ids named in `?only=` (so testing can never touch real or tester data). *(Chunk 8)*
- **Paging helpers** (`src/lib/supabase/paged.ts`) for reads past 1,000 rows and long id lists.
- **`vercel.json`:** adds the `agent-sweeps` cron; the branch's "no preview builds" line is removed in the merge commit.

## Files, by area
- **Agent sign-in, invites and accounts:** `src/app/agent/*` (5 pages), `src/app/internal/layout.tsx`, `src/app/internal/agents/page.tsx`, `src/components/agent-*` (signin form, setup forms, enroll setup, key box, header, card), `add-agent-form.tsx`, `team-list.tsx`, `site-chrome.tsx`, `src/app/layout.tsx`, `src/lib/agent-{accounts,auth,session,signin,signin-actions,setup-actions,setup-copy,invite,invite-lifetime,team,team-actions,team-copy,two-factor-reset}.ts`, `src/lib/supabase/middleware.ts`, `src/lib/auth-actions.ts`, `scripts/agent-cutover-prepare.mjs`.
- **Activity, assignment, alerts, jobs:** `src/lib/{agent-activity,search-assignment,assignment-actions,agent-alerts,job-scope,runtime-env}.ts`, `src/app/api/cron/agent-sweeps/route.ts`, the five changed cron routes, `src/app/api/stripe/webhook/route.ts`, `src/lib/email.ts`.
- **Refunds and cancellations:** `src/lib/{guarantee-refund-actions,refunds-due,refund-format,refund-reasons,agent-cancellation-actions}.ts`, `src/components/{refund-due-actions,agent-cancellation-resolution-form,agent-cancellation-lookup}.tsx`, `src/app/internal/refunds-due/page.tsx`.
- **Call requests:** `src/lib/{call-resolution,call-resolution-actions,agent-call-notifications,cancellation-actions,switch-actions,switch-self-service-actions,finalize-actions,customer-dashboard}.ts`, `src/components/resolve-call-request-form.tsx`.
- **Queues and paging:** `src/lib/{outreach-queue,admin-actions,dealership-queue,inventory-count,day60-extension,notification-digest,offer-messages}.ts`, `src/lib/supabase/paged.ts`, `src/app/internal/{outreach,admin,dealerships}/page.tsx`.
- **Activity logging added to existing actions:** `src/lib/{outreach-actions,dealership-actions,dealership-search-actions,article-actions,social-actions,offer-message-actions,article-reminders}.ts`, `src/components/{log-offer-form,dealership-search-picker,unconfirmed-alias-queue}.tsx`, `src/app/internal/{articles,social}/page.tsx`.

## What happens on deploy day
See the checklist in `docs/plans/agent-dashboard-phase1-code-plan.md` section 5.2 and the cutover runbook in section 5.3.
