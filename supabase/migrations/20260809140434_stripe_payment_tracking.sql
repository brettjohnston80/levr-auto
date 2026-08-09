-- Adds Stripe traceability to customer_searches. paid_at already exists (it's
-- the Day-30/Day-60 guarantee clock anchor per CLAUDE.md); this column just
-- lets us trace which Checkout Session paid for a given row, for debugging
-- and to guard against double-processing a webhook delivery.
--
-- No new RLS policy: only the webhook (via the service_role/admin client)
-- ever writes paid_at or this column. Customers can create their own pending
-- rows (existing insert policy) but cannot mark themselves as paid.
alter table public.customer_searches
  add column stripe_checkout_session_id text;

create index customer_searches_stripe_checkout_session_id_idx
  on public.customer_searches (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
