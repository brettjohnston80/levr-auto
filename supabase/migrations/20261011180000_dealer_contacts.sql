-- Agent dashboard Phase 1, Step 6: dealer outreach log.
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (section 6, and section 10 Step 6).
--
-- What this does:
--   * dealer_contacts: one row per dealer contact attempt or reply for a search, tied to the
--     search, the agent and the dealer (dealer_alias_id, always resolvable: off-lot dealers get
--     an alias via getOrCreateDealerAlias). next_follow_up_at is a due date, not a clock (Q11);
--     the app defaults it to +48h and the agent can change it (Q10).
--   * Deleting a search deletes its contacts (cascade), so test cleanups don't hit the
--     non-cascading FK trap. Salesperson/listing links are set null if those rows go.
--   * Links agent_activity_log.dealer_contact_id to this table (set null on delete).
--   * Full revoke (SELECT, INSERT, UPDATE, DELETE, TRUNCATE) from anon/authenticated; RLS on, no
--     policies. Only the service role reads or writes it.
--
-- Nothing in src/ uses this table until the Phase 1 code deploys after the tester round.

create table public.dealer_contacts (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.customer_searches (id) on delete cascade,
  agent_id uuid not null references public.agents (id),
  dealer_alias_id uuid not null references public.dealer_aliases (id),
  salesperson_id uuid references public.dealership_salespeople (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  channel text not null check (channel in ('phone', 'email', 'text', 'in_person', 'web_form', 'other')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  outcome text not null check (outcome in (
    'no_answer', 'left_message', 'spoke', 'request_sent', 'quote_received',
    'declined', 'unit_unavailable', 'unresponsive', 'other')),
  notes text check (notes is null or char_length(notes) <= 2000),
  contacted_at timestamptz not null default now(),
  next_follow_up_at timestamptz, -- a due date, not a clock (Q11); default +48h is set by the app (Q10)
  follow_up_closed_at timestamptz,
  follow_up_closed_reason text check (follow_up_closed_reason in (
    'new_contact', 'offer_logged', 'terminal_outcome', 'search_closed', 'manual')),
  created_at timestamptz not null default now(),
  constraint dealer_contacts_closed_shape check ((follow_up_closed_at is null) = (follow_up_closed_reason is null))
);
create index dealer_contacts_search_dealer_idx on public.dealer_contacts (search_id, dealer_alias_id, contacted_at desc, id);
create index dealer_contacts_agent_idx on public.dealer_contacts (agent_id, contacted_at desc, id);
create index dealer_contacts_due_idx on public.dealer_contacts (next_follow_up_at, id)
  where follow_up_closed_at is null and next_follow_up_at is not null;
alter table public.dealer_contacts enable row level security;
revoke select, insert, update, delete, truncate on public.dealer_contacts from anon, authenticated;

alter table public.agent_activity_log
  add constraint agent_activity_log_dealer_contact_fk
  foreign key (dealer_contact_id) references public.dealer_contacts (id) on delete set null;
