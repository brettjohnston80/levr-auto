# Customer-session reads to the service role (follow-up to the grants lock-down)

Status: planned 2026-10-25 (Brett). A small, separate step **before launch**. App code waits for Brett's go.

## Why

After the grants lock-down (`docs/sql/grants-lockdown/`), signed-in customers still have SELECT on
`customers` and `customer_searches`, through the policies "Customers can view their own record" and
"Customers can view their own searches". These cover their own row only, but they cover **every
column** of it, including internal ones. The app needs this access in 15 places. Moving those reads
to the service role lets both grants and both policies go.

## Internal columns a customer can read today (own row only)

Live column lists, read 2026-10-25.

**`customers`**
- `stripe_customer_id`, `stripe_default_payment_method_id`: Stripe ids. Not card data, but internal.
- `assigned_agent_id`: legacy column, never written (slated for the cleanup migration).
- `communication_frequency`: legacy column, no longer read (slated for the cleanup migration).
- `free_switch_used_at`: shows whether the free switch is used. The 5-day free switch is an
  unadvertised, internal-only policy (Core Processes 1b).
- The rest (`email`, `phone`, names, notification choices, `unpaid_reminders_unsubscribed_at`,
  `created_at`) is the customer's own data.

**`customer_searches`**
- `notes`: **holds no agent text.** No code path writes it. Agent notes go to `qualifying_offers.notes`,
  `cancellation_log.notes`, `agent_bypass_log.notes`, `admin_action_log.notes` and the activity log.
  0 searches have it set today. It is still an open free-text column a future change could fill.
- `assigned_agent_id`, `assigned_at`: which agent (an id, not a name) and when.
- `switch_call_resolved_at`, `switch_call_resolved_by_agent_id`, `switch_call_outcome`,
  `cancellation_call_resolved_at`, `cancellation_call_resolved_by_agent_id`, `cancellation_call_outcome`:
  agent outcomes (codes such as `not_cancelled`, `call_not_completed`) and the agent's id.
  The optional resolution note is in the activity log, not on this table.
- `stripe_checkout_session_id`, `last_extension_session_id`: Stripe ids.
- `deadline_reminder_sent_for`, `resume_reminder_sent_for`, `unpaid_reminder_1_sent_at`,
  `unpaid_reminder_2_sent_at`: job bookkeeping.
- `pending_switch_make`/`pending_switch_model`, `purchased_qualifying_offer_id`, `superseded_by_id`:
  internal pointers, harmless but not meant for the customer.
- The rest (vehicle, status, dates, pickup range, Matchmaker carry-over) is shown to the customer anyway.

No agent-written free text is readable today. What can be read: agent ids, call outcomes, Stripe ids and job stamps.

## The 15 reads

`customer_searches` (12): `account/vehicle/page.tsx`, `finalize/[searchId]/page.tsx`,
`payment/success/page.tsx`, `switch/success/page.tsx`, `cancellation-actions.ts`,
`extension-actions.ts` (2), `finalize-actions.ts` (3), `payment-actions.ts`,
`switch-self-service-actions.ts`.
`customers` (3): `account/page.tsx`, `header-account-link.tsx` (browser client), `extension-actions.ts`.

## Plan

1. Each server read keeps `supabase.auth.getUser()` on the session and reads through `createAdminClient()`,
   with an explicit `.eq("customer_id", user.id)` (or `.eq("id", user.id)` for `customers`). Ownership
   is then checked in code, the same way every other customer page already works.
2. **Two reads rely on RLS alone for ownership today:** `payment/success` and `switch/success` read the
   search by id with no customer filter. Their Stripe check already confirms the session's
   `customer_id`, but they get the explicit customer filter when moved, so nothing relies on RLS.
3. `header-account-link.tsx` reads the name from the browser. It moves to a small server action
   (returns first and last name for the signed-in user), or the name is passed down from the server.
4. Test: every customer page and action above with a disposable customer, plus a second disposable
   customer who must be refused another's search ids; then the grants check.
5. Migration (Brett runs): drop both read policies, `revoke all on public.customers, public.customer_searches from authenticated`,
   explicit service_role grants kept; grant check and rolled-back test as usual. Deploy the code first,
   then run the migration (the code no longer needs the access, so the order is safe).
