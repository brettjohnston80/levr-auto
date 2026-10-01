-- Unpaid-search reminders (sign-up-to-payment fix, approved 2026-09-30;
-- docs/plans/signup-to-payment-plan.md). Two "finish your search" emails,
-- 24h and 72h after an unpaid search was saved, at most two, stopping on
-- payment, with a one-click unsubscribe. Only searches created after the
-- feature deploys are eligible (the cutoff lives in the job, not here).
--
-- No unique index for one unpaid search per customer: two customers already
-- hold more than one unpaid row (checked 2026-09-30). The app enforces it by
-- reusing the latest unpaid row (src/lib/unpaid-search.ts).

begin;

alter table public.customer_searches
  add column unpaid_reminder_1_sent_at timestamptz,
  add column unpaid_reminder_2_sent_at timestamptz;

comment on column public.customer_searches.unpaid_reminder_1_sent_at is
  'When the first "finish your search" reminder (24h after the unpaid search was saved) was sent. Null = not sent.';
comment on column public.customer_searches.unpaid_reminder_2_sent_at is
  'When the second reminder (72h) was sent. Null = not sent. No more than two are ever sent.';

alter table public.customers
  add column unpaid_reminders_unsubscribed_at timestamptz;

comment on column public.customers.unpaid_reminders_unsubscribed_at is
  'Set when the customer unsubscribes from unpaid-search reminders. Never cleared automatically.';

create index customer_searches_unpaid_created_idx
  on public.customer_searches (created_at)
  where paid_at is null;

commit;
