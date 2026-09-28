-- General message thread + highlights/daily-update notifications
-- (2026-09-27, plan approved: docs/plans/guarantee-progress-notifications-plan.md).
-- Brett runs this in the Supabase SQL Editor for project couiovhducwytlckfgvo.
-- Run the whole file at once: it is one transaction (begin/commit).
--
-- Email only. Texting is scoped separately (see the plan) and gets its own
-- migration (consent + opt-out columns) if and when it's approved.
--
-- Deploy order: run this BEFORE deploying the build that uses it (that build
-- reads offer_messages.customer_id and general_threads). It is additive, so
-- the code live today keeps working after it runs: that code inserts
-- offer_messages WITHOUT customer_id, so customer_id is filled by a trigger
-- rather than left to the application, which lets it be NOT NULL from day
-- one. message_email_sent_at (the per-reply email throttle this plan
-- replaces) and customers.communication_frequency (no longer read or written)
-- are left in place for now and dropped in a later post-deploy cleanup.

begin;

-- 1. General thread: offer_messages rows with no offer. Every message now
--    carries its customer, so a customer-level thread needs no second table.
alter table public.offer_messages
  alter column qualifying_offer_id drop not null,
  add column customer_id uuid references public.customers(id) on delete cascade;

update public.offer_messages m
set customer_id = s.customer_id
from public.qualifying_offers o
join public.customer_searches s on s.id = o.customer_search_id
where o.id = m.qualifying_offer_id
  and m.customer_id is null;

create or replace function public.offer_messages_fill_customer_id()
returns trigger
language plpgsql
as $$
begin
  if new.customer_id is null and new.qualifying_offer_id is not null then
    select s.customer_id into new.customer_id
    from public.qualifying_offers o
    join public.customer_searches s on s.id = o.customer_search_id
    where o.id = new.qualifying_offer_id;
  end if;
  return new;
end;
$$;

create trigger offer_messages_fill_customer_id
  before insert on public.offer_messages
  for each row execute function public.offer_messages_fill_customer_id();

alter table public.offer_messages alter column customer_id set not null;

create index offer_messages_general_thread_idx
  on public.offer_messages (customer_id, created_at)
  where qualifying_offer_id is null;

comment on column public.offer_messages.qualifying_offer_id is
  'The offer this message is about. NULL = the customer''s general thread with their agent (2026-09-27).';
comment on column public.offer_messages.customer_id is
  'Owning customer. Filled by trigger from the offer when the app doesn''t pass it.';

-- Thread state for the general thread (the per-offer equivalent lives on
-- qualifying_offers). One row per customer, created on first message.
create table public.general_threads (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  last_message_at timestamptz,
  last_agent_message_at timestamptz,
  customer_messages_read_at timestamptz,
  -- Agent-side unread, same mechanism as qualifying_offers.
  customer_activity_at timestamptz,
  agent_reviewed_at timestamptz,
  -- Daily update: the agent reply (its last_agent_message_at) this thread
  -- was last listed for. Listed again only after a newer agent reply.
  daily_update_included_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.general_threads enable row level security;

comment on table public.general_threads is
  'Per-customer state for the general (not-offer) message thread: unread tracking for both sides and daily-update inclusion.';

-- 2. Daily update: per offer thread, when its unread agent message was last
--    listed. A thread is listed once per new agent reply, not every day.
alter table public.qualifying_offers
  add column daily_update_included_at timestamptz;

comment on column public.qualifying_offers.daily_update_included_at is
  'The agent reply (its last_agent_message_at) this thread was last listed for in a daily update. Listed again only after a newer agent reply.';

-- 3. New highlight events. Replaces the inline check on
--    notification_events.event_type (created in 20260824120000). Dropped by
--    looking it up rather than by an assumed name, so a differently named
--    constraint can't survive and keep rejecting the new types.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.notification_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%event_type%'
  loop
    execute format('alter table public.notification_events drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in (
    'offer_logged',
    'offer_response_recorded',
    'deal_progress_update',
    'search_purchased',
    'offer_withdrawn',      -- agent released an accepted offer (no customer notice today)
    'guarantee_resolved'    -- Day-30 assessment set met or refunded
  ));

commit;
