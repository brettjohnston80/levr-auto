-- Auto-renew: opt-in automatic $100 extension charges so a search never has
-- to be manually re-extended. Mechanism decided 2026-08-16 (CLAUDE.md):
-- Stripe Checkout's setup_future_usage: 'off_session' on a customer's first
-- extension checkout, NOT Stripe Subscriptions (extensions are discrete
-- $100 events triggered by the Day-60 cron reaching a deadline, not a fixed
-- recurring billing schedule).

alter table public.customer_searches
  add column auto_renew_enabled boolean not null default false;

comment on column public.customer_searches.auto_renew_enabled is
  'Opt-in flag: when true, the Day-60 pause cron (pauseOverdueSearches) attempts an off-session $100 charge via the customer''s saved Stripe payment method instead of pausing the search. Search-scoped, matching search_deadline_at/paused_at -- a customer with multiple searches can enable this independently per search.';

alter table public.customers
  add column stripe_customer_id text,
  add column stripe_default_payment_method_id text;

comment on column public.customers.stripe_customer_id is
  'Stripe Customer object id, created lazily on a customer''s first auto-renew opt-in extension checkout. Null until then -- never backfilled or required upfront.';

comment on column public.customers.stripe_default_payment_method_id is
  'Payment method saved off the first setup_future_usage extension checkout, used for later off-session auto-renew charges. Null until an opt-in checkout completes.';
