# Sequence: payment → webhook → assignment → alert email

**Pilot, 2026-10-15.** The Phase 1 path from a customer paying the $699 to a search having an agent (or a lead or admin being told why it doesn't). From `src/app/api/stripe/webhook/route.ts`, `src/lib/search-assignment.ts`, `src/lib/agent-alerts.ts`, the `assign_search` database function (Steps 4, 13, 15) and `src/app/api/cron/agent-sweeps/route.ts`. Not live until the Phase 1 deploy.

**How to read it:** time runs downwards. Solid arrows are calls; dashed arrows are answers. `alt` boxes are the branches; only one runs.

```mermaid
sequenceDiagram
  autonumber
  actor C as Customer
  participant S as Stripe
  participant W as Webhook route
  participant DB as Supabase database
  participant A as assign_search (database)
  participant AL as Alert sender
  participant Z as ZeptoMail
  actor L as Leads / admins

  C->>S: pays $699 on Stripe Checkout
  S->>W: checkout.session.completed (signed)
  W->>DB: set paid_at where paid_at is null (once only)
  W->>DB: record the payment row
  W-->>S: 200 OK (the payment is done, nothing after this can undo it)
  Note over W: after the response (after()), never throws
  W->>A: assign_search(search)
  alt test account (any .invalid address)
    A-->>W: skipped_test_account (never assigned)
  else the customer's other search has an agent who is active and in rotation
    A->>DB: assign that agent (continuity), history row
    A-->>W: agent
  else someone is in rotation
    A->>DB: least recently assigned agent in rotation (round_robin), history row
    A-->>W: agent
  else nobody in rotation, an active lead exists
    A->>DB: least recently assigned lead (lead_fallback) and a lead alert
    A-->>W: agent + alert id
    W->>AL: send that alert now
    AL->>Z: "Search assigned to {lead}: nobody is in rotation"
    Z->>L: email to leads
  else no lead either
    A->>DB: stays unassigned and an admin alert
    A-->>W: unassigned + alert id
    W->>AL: send that alert now
    AL->>Z: "A paid search has no agent"
    Z->>L: email to admins
  end
  opt the call itself fails (error or timeout)
    W->>DB: one assignment_failed alert for a real customer (one open per search)
    W->>AL: send it now
    AL->>Z: "Automatic assignment failed for a paid search"
    Z->>L: email to leads
  end

  Note over DB,L: Backstop: hourly at :15
  participant Cr as Vercel Cron
  Cr->>DB: agent-sweeps: claim the job lock (10 minutes)
  DB-->>Cr: claimed (or "another run is in progress", then stop)
  Cr->>DB: real paid searches with no agent, test customers left out, 500 at a time (up to 2,000, 4-minute budget)
  loop each search
    Cr->>A: assign_search(search), same rules as above
  end
  Cr->>AL: send every alert not emailed yet (50 at a time, a failed send is retried next hour)
  AL->>Z: alert emails
  Cr->>DB: release the lock (always, even after an error)
  Note over DB: once a search has an agent, its open assignment_failed alert closes itself
```

## Rules this diagram depends on

- **Payment is never held up or undone by assignment.** The webhook answers Stripe first; assignment runs after the response and never throws. (Tested: c3-B forced failure, webhook still 200, payment recorded.)
- **Exactly once.** A Stripe replay finds `paid_at` already set and does nothing, so assignment isn't called again. (c3-A replay.)
- **Admins are never picked by the system.** The fallback takes leads only (`role = 'lead'`). An admin who opts into rotation is picked by round-robin like anyone else.
- **Away never changes assignment;** deactivated agents are never assigned.
- **Switches:** the new search keeps the agent inside the database (`inherited_switch`); the extra call then answers `already_assigned`. (c3-switch.)
- **Scope:** outside production the sweep only runs on named searches (`?only=`); in production a manual `?only=` run is logged `[job-scoped]` and answers `scoped: true`.
