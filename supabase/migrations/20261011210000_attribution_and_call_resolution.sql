-- Agent dashboard Phase 1, Step 8: attribution, call resolution and message-time columns.
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (sections 5.2, 8.2, 11, and section 10 Step 8).
--
-- What this does (all new columns start empty; nothing in src/ writes them until the Phase 1
-- code deploys after the tester round):
--   * qualifying_offers.logged_by_agent_id: who logged the offer (workload, duplicate warnings).
--   * qualifying_offers.dealer_alias_id: the dealer identity, so a logged offer closes that
--     dealer's open follow-up and later publish warnings can spot duplicates (with the VIN index).
--   * qualifying_offers.last_customer_message_at, general_threads.last_customer_message_at:
--     tell "answered" (agent reply after it) apart from merely "reviewed".
--   * deal_progress.availability_confirmed_by_agent_id / deposit_confirmed_by_agent_id.
--   * notification_events.flag_resolved_by_agent_id.
--   * customer_searches switch_/cancellation_call_resolved_at, _resolved_by_agent_id, _outcome:
--     so a call request can be resolved without the search being switched or cancelled (today
--     those requests can never leave their queue). A check keeps each trio all-set or all-empty.
--
-- Every new foreign key is a plain link (no delete action) to agents or dealer_aliases, so no
-- table here can be reached by two delete routes (see Step 6b). Customers can already read
-- their own searches, offers and deal progress (existing RLS select policies), so these
-- columns are visible to them on their own rows: ids only, no names. There is no customer
-- update policy on any of these tables.

alter table public.qualifying_offers
  add column logged_by_agent_id uuid references public.agents (id),
  add column dealer_alias_id uuid references public.dealer_aliases (id),
  add column last_customer_message_at timestamptz;
create index qualifying_offers_search_vin_idx on public.qualifying_offers (customer_search_id, vin) where vin is not null;
create index qualifying_offers_search_dealer_idx on public.qualifying_offers (customer_search_id, dealer_alias_id)
  where dealer_alias_id is not null;

alter table public.general_threads add column last_customer_message_at timestamptz;

alter table public.deal_progress
  add column availability_confirmed_by_agent_id uuid references public.agents (id),
  add column deposit_confirmed_by_agent_id uuid references public.agents (id);

alter table public.notification_events
  add column flag_resolved_by_agent_id uuid references public.agents (id);

alter table public.customer_searches
  add column switch_call_resolved_at timestamptz,
  add column switch_call_resolved_by_agent_id uuid references public.agents (id),
  add column switch_call_outcome text check (switch_call_outcome in ('switched', 'kept_vehicle', 'unreachable', 'other')),
  add column cancellation_call_resolved_at timestamptz,
  add column cancellation_call_resolved_by_agent_id uuid references public.agents (id),
  add column cancellation_call_outcome text check (cancellation_call_outcome in ('cancelled', 'retained', 'unreachable', 'other'));

alter table public.customer_searches
  add constraint customer_searches_switch_call_resolution_shape check (
    (switch_call_resolved_at is null and switch_call_resolved_by_agent_id is null and switch_call_outcome is null)
    or (switch_call_resolved_at is not null and switch_call_resolved_by_agent_id is not null and switch_call_outcome is not null)),
  add constraint customer_searches_cancellation_call_resolution_shape check (
    (cancellation_call_resolved_at is null and cancellation_call_resolved_by_agent_id is null and cancellation_call_outcome is null)
    or (cancellation_call_resolved_at is not null and cancellation_call_resolved_by_agent_id is not null and cancellation_call_outcome is not null));
