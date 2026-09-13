-- Adds 'both' to communication_frequency (tester feedback, 2026-09-13).
--
-- The column has been a two-value check since it was introduced:
--   check (communication_frequency in ('real_time', 'daily_digest'))
-- so a customer could have immediate notifications OR a daily rollup, never
-- both. Testers asked for both, which is a reasonable thing to want: the
-- real-time mail is per-event and easy to miss, the digest is a summary.
--
-- ⚠ THIS MIGRATION ALONE DOES NOTHING USEFUL, AND SHIPPING IT WITHOUT THE
-- MATCHING CODE IS WORSE THAN NOT SHIPPING IT. Two independent readers
-- decide what a customer actually receives, and both currently test for
-- exact equality:
--
--   notifications.ts        sends immediately when
--                           communication_frequency === 'real_time'
--   notification-digest.ts  batches for   .eq('communication_frequency',
--                                              'daily_digest')
--
-- A customer set to 'both' would therefore match NEITHER and silently
-- receive NOTHING -- strictly worse than the two-option version they were
-- complaining about. The accompanying code change widens both tests to
-- include 'both'; this migration and that change must land together.
--
-- No default change and no backfill: every existing customer keeps the
-- value they already have. 'both' is opt-in from account settings only.

alter table public.customers
  drop constraint if exists customers_communication_frequency_check;

alter table public.customers
  add constraint customers_communication_frequency_check
    check (communication_frequency in ('real_time', 'daily_digest', 'both'));

comment on column public.customers.communication_frequency is
  'How often a customer hears from us about notification events. '
  '''real_time'' sends each event as it happens, ''daily_digest'' batches '
  'them into one rollup per day, and ''both'' does each -- the per-event '
  'mail AND the next digest. Read by notifications.ts (immediate send) and '
  'notification-digest.ts (the daily rollup); BOTH must recognise any value '
  'added here, or that value silently means "no notifications at all". '
  'Agent callbacks are deliberately unaffected by this setting and always '
  'fire immediately.';
