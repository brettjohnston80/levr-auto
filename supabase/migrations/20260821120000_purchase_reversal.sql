-- Gate marking a search purchased on real deal data, make it reversible,
-- and let a purchased-then-fell-through search go through the same
-- existing cancellation flow. Scope decided 2026-08-21.

-- ---------------------------------------------------------------------------
-- purchase_status_log
-- ---------------------------------------------------------------------------
create table public.purchase_status_log (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.customer_searches (id),
  agent_id uuid not null references public.agents (id),
  action text not null check (action in ('marked_purchased', 'reverted')),
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.purchase_status_log is
  'Audit trail for the purchased status flip and its reversal. reason is '
  'null for marked_purchased (a confirm popup, no typed note) and required '
  'for reverted (a real judgment call worth a note). One table per action '
  'family, same convention as cancellation_log, agent_bypass_log, and '
  'admin_action_log, not a shared catch all.';

create index purchase_status_log_search_id_idx on public.purchase_status_log (search_id);

alter table public.purchase_status_log enable row level security;
-- No policies. Service role only, same convention as the other audit
-- tables in this codebase.

-- ---------------------------------------------------------------------------
-- revert_purchased_search
-- ---------------------------------------------------------------------------
-- Only legal when the current status is purchased. Deliberately leaves
-- deal_progress completely untouched -- if the same deal comes back
-- together, an already-confirmed deposit or availability recheck doesn't
-- need to be re-collected.
create function public.revert_purchased_search(
  p_search_id uuid,
  p_agent_id uuid,
  p_reason text
)
returns public.customer_searches
language plpgsql
as $$
declare
  v_search public.customer_searches;
begin
  select * into v_search
  from public.customer_searches
  where id = p_search_id
  for update;

  if not found then
    raise exception 'customer_searches row % not found', p_search_id;
  end if;

  if v_search.search_status <> 'purchased' then
    raise exception 'search % cannot be reverted from status %', p_search_id, v_search.search_status;
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'p_reason is required';
  end if;

  update public.customer_searches
  set search_status = 'searching',
      purchased_at = null
  where id = p_search_id
  returning * into v_search;

  insert into public.purchase_status_log (search_id, agent_id, action, reason)
  values (p_search_id, p_agent_id, 'reverted', p_reason);

  return v_search;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_search: extend the status guard to allow cancelling from
-- purchased -- a customer whose deal fell through after being marked
-- purchased needs the same final, already built cancellation flow, not a
-- new one. Same signature as the existing function, so this replaces it in
-- place rather than creating a new overload.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_search(
  p_search_id uuid,
  p_initiated_by text,
  p_agent_id uuid default null,
  p_reason_category text default null,
  p_notes text default null
)
returns public.customer_searches
language plpgsql
as $$
declare
  v_search public.customer_searches;
begin
  select * into v_search
  from public.customer_searches
  where id = p_search_id
  for update;

  if not found then
    raise exception 'customer_searches row % not found', p_search_id;
  end if;

  if v_search.search_status not in ('awaiting_finalization', 'pending_refinement', 'searching', 'paused', 'purchased') then
    raise exception 'search % cannot be cancelled from status %', p_search_id, v_search.search_status;
  end if;

  if p_initiated_by not in ('customer', 'agent') then
    raise exception 'p_initiated_by must be customer or agent';
  end if;

  if p_initiated_by = 'agent' and (p_agent_id is null or p_reason_category is null) then
    raise exception 'p_agent_id and p_reason_category are required when p_initiated_by is agent';
  end if;

  update public.customer_searches
  set search_status = 'cancelled',
      cancelled_at = now()
  where id = p_search_id
  returning * into v_search;

  insert into public.cancellation_log (search_id, initiated_by, agent_id, reason_category, notes)
  values (p_search_id, p_initiated_by, p_agent_id, p_reason_category, p_notes);

  return v_search;
end;
$$;
