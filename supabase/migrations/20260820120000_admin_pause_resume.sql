-- Build order item 12, minimal admin views, scope decided 2026-08-19.
-- Manual Pause/Resume from the new /internal/admin table. New audit table,
-- narrowly scoped to this action family, same convention as
-- cancellation_log and agent_bypass_log, not a shared lifecycle log table
-- (no such table exists in this codebase; a prior planning note
-- referencing one was a mistake, confirmed against the live schema before
-- this migration was written).

-- ---------------------------------------------------------------------------
-- admin_action_log
-- ---------------------------------------------------------------------------
create table public.admin_action_log (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.customer_searches (id),
  agent_id uuid not null references public.agents (id),
  action text not null check (action in ('paused', 'resumed')),
  notes text not null,
  created_at timestamptz not null default now()
);

comment on table public.admin_action_log is
  'Audit trail for manual Pause/Resume actions taken from /internal/admin. '
  'Notes are required on every row, no empty reason submissions. Separate '
  'from agent_bypass_log (fee waivers) and cancellation_log (cancellations), '
  'same one table per action family convention, not a shared catch all.';

create index admin_action_log_search_id_idx on public.admin_action_log (search_id);

alter table public.admin_action_log enable row level security;
-- No policies. Service role only, same convention as cancellation_log,
-- agent_bypass_log, and refunds.

-- ---------------------------------------------------------------------------
-- admin_pause_search
-- ---------------------------------------------------------------------------
-- Only legal when the current status is searching. Matches the client side
-- rule that buttons only render when the action is legal, enforced again
-- here as the real guard. Does not touch search_deadline_at; granting
-- extra time stays a separate action, grant_extension_bypass.
create function public.admin_pause_search(
  p_search_id uuid,
  p_agent_id uuid,
  p_notes text
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

  if v_search.search_status <> 'searching' then
    raise exception 'search % cannot be paused from status %', p_search_id, v_search.search_status;
  end if;

  if p_notes is null or btrim(p_notes) = '' then
    raise exception 'p_notes is required';
  end if;

  update public.customer_searches
  set search_status = 'paused',
      paused_at = now()
  where id = p_search_id
  returning * into v_search;

  -- Same function call, same transaction as the status flip. If this
  -- fails, the whole pause rolls back rather than succeeding unlogged.
  insert into public.admin_action_log (search_id, agent_id, action, notes)
  values (p_search_id, p_agent_id, 'paused', p_notes);

  return v_search;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_resume_search
-- ---------------------------------------------------------------------------
-- Only legal when the current status is paused. Deadline untouched on
-- purpose, see the note above.
create function public.admin_resume_search(
  p_search_id uuid,
  p_agent_id uuid,
  p_notes text
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

  if v_search.search_status <> 'paused' then
    raise exception 'search % cannot be resumed from status %', p_search_id, v_search.search_status;
  end if;

  if p_notes is null or btrim(p_notes) = '' then
    raise exception 'p_notes is required';
  end if;

  update public.customer_searches
  set search_status = 'searching',
      paused_at = null
  where id = p_search_id
  returning * into v_search;

  insert into public.admin_action_log (search_id, agent_id, action, notes)
  values (p_search_id, p_agent_id, 'resumed', p_notes);

  return v_search;
end;
$$;
