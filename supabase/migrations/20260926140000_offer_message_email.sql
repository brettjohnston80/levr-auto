-- Agent-message email throttle (2026-09-26) -- plan approved
-- (docs/plans/message-email-plan.md); Brett runs this in the Supabase SQL
-- Editor. Additive only.
--
-- When an agent posts to an offer thread, the customer gets at most one
-- "You have a new message from your LEVR agent" email per thread until they
-- open it: send only when this is null or older than
-- customer_messages_read_at. Stamped after a successful send only.
alter table public.qualifying_offers
  add column message_email_sent_at timestamptz;

comment on column public.qualifying_offers.message_email_sent_at is
  'Last "new message from your agent" email for this offer''s thread. One email per thread until the customer opens it (customer_messages_read_at later than this).';
