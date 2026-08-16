-- Day-60 paused-state policy, Pass 3 (see CLAUDE.md "Pricing Pivot
-- Tracking" Step 4). Audit trail for the hidden agent bypass, plus the two
-- RPCs that write to it -- both inserts happen inside the same function
-- call as the state change they're auditing, so a failed audit write rolls
-- back the whole action instead of silently letting a fee waiver through
-- unlogged (a single plpgsql function body is one implicit transaction, no
-- explicit BEGIN/COMMIT needed).

-- ---------------------------------------------------------------------------
-- agent_bypass_log
-- ---------------------------------------------------------------------------
create table public.agent_bypass_log (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.customer_searches (id),
  agent_id uuid not null references public.agents (id),
  fee_type text not null check (fee_type in ('switch', 'extension')),
  reason_category text not null check (reason_category in (
    'Customer complaint / dissatisfaction',
    'Goodwill gesture',
    'Our error',
    'Special circumstances',
    'Other'
  )),
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.agent_bypass_log is
  'Audit trail only, no client-facing access of any kind. One row per '
  'no-Stripe fee waiver an agent grants -- a switch (waives the $100 switch '
  'fee, written by switch_customer_search) or an extension (waives the $100 '
  'extension fee, grants exactly +30 days per row, written by '
  'grant_extension_bypass -- if more time is needed, the agent uses it '
  'again, giving per-use audit granularity rather than one large grant). '
  'Deliberately never surfaced in customer-facing text or the FAQ.';

create index agent_bypass_log_search_id_idx on public.agent_bypass_log (search_id);
create index agent_bypass_log_agent_id_idx on public.agent_bypass_log (agent_id);

alter table public.agent_bypass_log enable row level security;
-- No policies -- locked to service_role only, same convention as
-- agents/listings (initial_schema.sql: RLS enabled, zero client-facing
-- policies at all, not even read).

-- ---------------------------------------------------------------------------
-- switch_customer_search: retrofit for the audit trail
-- ---------------------------------------------------------------------------
-- Adding parameters via a bare "create or replace function" creates a NEW
-- overload rather than replacing the existing one -- this is exactly the
-- bug 20260814150000_drop_switch_customer_search_3arg_overload.sql had to
-- clean up after, from the switch_fee_flow migration doing this same thing.
-- Explicitly dropping the current 4-arg signature first avoids repeating
-- that mistake.
drop function public.switch_customer_search(uuid, text, text, timestamptz);

-- p_agent_id/p_reason_category/p_notes default to null so the two
-- non-agent callers (the free self-service switch in
-- switch-self-service-actions.ts, and the Stripe webhook's switch_fee
-- branch) are unaffected -- neither involves an agent, so neither should
-- produce an agent_bypass_log row. Only the agent-initiated path
-- (switch-actions.ts) passes all three, and every agent-initiated switch
-- through this path now requires a reason -- see CLAUDE.md's Pass 3
-- decision (1): this retrofits the existing agent-comped-switch behavior
-- in place rather than leaving it as a separate, still-unaudited path
-- alongside a new audited one. p_reason_category is required whenever
-- p_agent_id is provided, enforced here (not just in application code) as
-- the same defense-in-depth standard used throughout this project.
create or replace function public.switch_customer_search(
  p_old_search_id uuid,
  p_new_make text,
  p_new_model text,
  p_paid_at timestamptz default null,
  p_agent_id uuid default null,
  p_reason_category text default null,
  p_notes text default null
)
returns public.customer_searches
language plpgsql
as $$
declare
  v_old public.customer_searches;
  v_new public.customer_searches;
begin
  select * into v_old
  from public.customer_searches
  where id = p_old_search_id
  for update;

  if not found then
    raise exception 'customer_searches row % not found', p_old_search_id;
  end if;

  if v_old.superseded_by_id is not null or v_old.search_status = 'switched' then
    raise exception 'search % has already been switched', p_old_search_id;
  end if;

  if p_agent_id is not null and p_reason_category is null then
    raise exception 'p_reason_category is required when p_agent_id is provided';
  end if;

  insert into public.customer_searches (customer_id, make, model, zip, paid_at)
  values (v_old.customer_id, p_new_make, p_new_model, v_old.zip, p_paid_at)
  returning * into v_new;

  update public.customer_searches
  set superseded_by_id = v_new.id,
      search_status = 'switched'
  where id = p_old_search_id;

  -- Same function call, same transaction as the switch itself -- if this
  -- fails, the whole switch rolls back rather than succeeding unlogged.
  if p_agent_id is not null then
    insert into public.agent_bypass_log (search_id, agent_id, fee_type, reason_category, notes)
    values (p_old_search_id, p_agent_id, 'switch', p_reason_category, p_notes);
  end if;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- grant_extension_bypass: new RPC, extension side of the hidden bypass
-- ---------------------------------------------------------------------------
-- No eligibility gate on staleness -- usable on a search regardless of how
-- long ago its deadline passed, including ones a self-service extension
-- can't reach at all (a 'paused' row already past the 30-day resume
-- window). Always grants exactly +30 days and reactivates the search
-- (paused_at cleared), regardless of how stale it was.
--
-- There IS a gate on search_status, added after the first draft of this
-- function shipped with none: real data-integrity gap otherwise, since the
-- lookup UI (agent-bypass-lookup.tsx) deliberately shows every search
-- regardless of status with no filtering. Without this check, an agent
-- could pick a search still sitting in 'awaiting_finalization' or
-- 'pending_refinement' and this function would force it straight to
-- 'searching', skipping finalization (trim/color/options selection, the
-- 24h self-edit window, solidification) entirely. Restricted to
-- 'searching'/'paused' -- the only two statuses a real guarantee-clock
-- deadline can exist for in the first place.
--
-- Deadline base, in order of preference: search_deadline_at if already
-- set, else solidified_at + 60 days (the same default effectiveDeadline()
-- computes in application code) -- both statuses this function now accepts
-- always have solidified_at set (only 'awaiting_finalization'/
-- 'pending_refinement' can have it null, and those are excluded by the
-- status gate above), so the earlier now()-fallback for a missing
-- solidified_at is no longer reachable but left in place as a harmless
-- defensive default.
create or replace function public.grant_extension_bypass(
  p_search_id uuid,
  p_agent_id uuid,
  p_reason_category text,
  p_notes text default null
)
returns public.customer_searches
language plpgsql
as $$
declare
  v_search public.customer_searches;
  v_current_deadline timestamptz;
  v_new_deadline timestamptz;
begin
  select * into v_search
  from public.customer_searches
  where id = p_search_id
  for update;

  if not found then
    raise exception 'customer_searches row % not found', p_search_id;
  end if;

  if v_search.search_status not in ('searching', 'paused') then
    raise exception 'search % has not been finalized yet; it needs to go through finalization before an extension can be granted', p_search_id;
  end if;

  if p_agent_id is null or p_reason_category is null then
    raise exception 'p_agent_id and p_reason_category are required';
  end if;

  v_current_deadline := coalesce(
    v_search.search_deadline_at,
    v_search.solidified_at + interval '60 days',
    now()
  );

  -- greatest(..., now()) matters specifically for the case this bypass
  -- exists to handle: a search whose deadline passed long ago (well past
  -- the 30-day self-service resume window). Extending +30 days from a
  -- stale historical deadline (e.g. 90 days ago) would land the new
  -- deadline 60 days in the *past* -- still immediately overdue, silently
  -- failing to actually revive the search. Flooring at now() guarantees a
  -- genuinely stale search gets 30 real days from the moment of the grant,
  -- while a search extended before its deadline passed (early use) still
  -- extends from its real current deadline, not reset to a shorter window.
  v_new_deadline := greatest(v_current_deadline, now()) + interval '30 days';

  update public.customer_searches
  set search_deadline_at = v_new_deadline,
      search_status = 'searching',
      paused_at = null
  where id = p_search_id
  returning * into v_search;

  -- Same function call, same transaction as the deadline update -- if this
  -- fails, the whole grant rolls back rather than succeeding unlogged.
  insert into public.agent_bypass_log (search_id, agent_id, fee_type, reason_category, notes)
  values (p_search_id, p_agent_id, 'extension', p_reason_category, p_notes);

  return v_search;
end;
$$;
