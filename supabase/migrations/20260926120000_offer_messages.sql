-- Offer message threads (planned 2026-09-25) -- DRAFT, NOT RUN.
-- Awaiting Brett's approval of docs/plans/offer-messages-plan.md; Brett runs
-- it in the Supabase SQL Editor once approved.
--
-- One thread per qualifying_offers row. Both the customer and agents post,
-- unlimited. No email/SMS is ever sent for a message; unread state is what
-- tells each side something is waiting.
--
-- Deploy-order safety: this migration only ADDS things and COPIES existing
-- customer notes into threads. customer_note / customer_note_updated_at are
-- deliberately left in place, because production code on origin/main still
-- reads and writes them until the messaging build deploys. A follow-up
-- migration (after the deploy) re-runs the idempotent copy below once more,
-- then drops those two columns and their length constraint.

create table public.offer_messages (
  id uuid primary key default gen_random_uuid(),
  qualifying_offer_id uuid not null references public.qualifying_offers(id) on delete cascade,
  author_type text not null check (author_type in ('customer', 'agent')),
  -- set null rather than cascade: deleting an account or an agent row must
  -- not silently rewrite the other side's record of the conversation.
  author_customer_id uuid references public.customers(id) on delete set null,
  author_agent_id uuid references public.agents(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint offer_messages_body_length check (char_length(btrim(body)) between 1 and 1000),
  constraint offer_messages_author_shape check (
    (author_type = 'customer' and author_agent_id is null)
    or (author_type = 'agent' and author_customer_id is null)
  )
);

create index offer_messages_offer_created_idx
  on public.offer_messages (qualifying_offer_id, created_at);

-- Same convention as every table in this project: RLS on, no policies,
-- service-role only. All reads/writes go through server actions that
-- re-check ownership (customer) or getAuthorizedAgent() (agent).
alter table public.offer_messages enable row level security;

comment on table public.offer_messages is
  'Customer <-> agent message thread per qualifying offer. Immutable (no edit/delete). No email/SMS is sent for messages.';

-- Thread state kept on the offer so unread checks and newest-first sorting
-- never need to scan offer_messages. Written by the post-message actions.
alter table public.qualifying_offers
  add column last_message_at timestamptz,
  add column last_agent_message_at timestamptz,
  add column customer_messages_read_at timestamptz;

comment on column public.qualifying_offers.last_message_at is
  'Newest message in this offer''s thread, either author. Sorts the customer''s Messages section.';
comment on column public.qualifying_offers.last_agent_message_at is
  'Newest agent message. Customer has unread messages when this is later than customer_messages_read_at (or that is null).';
comment on column public.qualifying_offers.customer_messages_read_at is
  'When the customer last viewed this thread. Agent-side unread reuses customer_activity_at / agent_reviewed_at.';

-- Carry existing notes over as the first customer message, dated when the
-- note was last saved. Idempotent: safe to re-run in the follow-up
-- migration to catch any note written on the old code before deploy.
insert into public.offer_messages (qualifying_offer_id, author_type, author_customer_id, body, created_at)
select o.id, 'customer', s.customer_id, o.customer_note,
       coalesce(o.customer_note_updated_at, o.customer_activity_at, now())
from public.qualifying_offers o
join public.customer_searches s on s.id = o.customer_search_id
where o.customer_note is not null
  and btrim(o.customer_note) <> ''
  and not exists (
    select 1 from public.offer_messages m
    where m.qualifying_offer_id = o.id
      and m.author_type = 'customer'
      and m.body = o.customer_note
  );

update public.qualifying_offers o
set last_message_at = m.latest
from (
  select qualifying_offer_id, max(created_at) as latest
  from public.offer_messages
  group by qualifying_offer_id
) m
where m.qualifying_offer_id = o.id;
