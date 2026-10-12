-- Agent dashboard Phase 1, Step 9b: activity-log writes in the remaining database functions,
-- and the deactivated-agent fix for switches.
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (sections 4.2, 5.3, and section 10 Step 9).
--
-- Each function is replaced in place with its IDENTICAL signature, built from its live text:
--   cancel_search            <- 20260821120000_purchase_reversal.sql
--   grant_extension_bypass   <- 20260816140000_agent_bypass_log.sql
--   revert_purchased_search  <- 20260823140000_revert_purchased_search_clears_offer.sql
--   switch_customer_search   <- 20261011170000_switch_inherits_agent.sql (Step 5)
-- Additions only:
--   * cancel_search (agent path only), grant_extension_bypass, revert_purchased_search: one
--     log_agent_activity call each, before the return. log_agent_activity never raises, so the
--     existing behaviour, errors and return values are unchanged.
--   * switch_customer_search: inherits the old agent only if still active. If the old agent has
--     been deactivated, the new (paid) row goes through assign_search's normal rules. A
--     never-assigned old row (every search today) still gives an unassigned new row, as before.
-- Callers are unchanged: agent-cancellation-actions.ts / cancellation-actions.ts (cancel_search),
-- agent-bypass-actions.ts (grant_extension_bypass), outreach-actions.ts:386 (revert),
-- the webhook, switch-actions.ts and switch-self-service-actions.ts (switch).

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

  -- Phase 1 (Step 9b): agent-mediated cancellations also go in the activity log.
  if p_initiated_by = 'agent' then
    perform public.log_agent_activity(p_agent_id, 'search_cancelled_by_agent', p_search_id, v_search.customer_id,
      p_details => jsonb_build_object('reason_category', p_reason_category));
  end if;

  return v_search;
end;
$$;

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

  -- Phase 1 (Step 9b): also in the activity log (never fails the grant).
  perform public.log_agent_activity(p_agent_id, 'extension_bypass_granted', p_search_id, v_search.customer_id,
    p_details => jsonb_build_object('reason_category', p_reason_category, 'new_deadline', v_new_deadline));

  return v_search;
end;
$$;

create or replace function public.revert_purchased_search(
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
      purchased_at = null,
      purchased_qualifying_offer_id = null
  where id = p_search_id
  returning * into v_search;

  insert into public.purchase_status_log (search_id, agent_id, action, reason)
  values (p_search_id, p_agent_id, 'reverted', p_reason);

  -- Phase 1 (Step 9b): also in the activity log (never fails the revert).
  perform public.log_agent_activity(p_agent_id, 'purchase_reverted', p_search_id, v_search.customer_id,
    p_details => jsonb_build_object('reason', p_reason));

  return v_search;
end;
$$;

create or replace function public.switch_customer_search(
  p_old_search_id uuid,
  p_new_make text,
  p_new_model text,
  p_new_model_year smallint default null,
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
  v_inherit uuid;
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

  -- trim/colors/required_options deliberately reset to defaults, not copied
  -- from the old row -- they're model-specific. zip and the pickup travel
  -- answer carry over: customer-level, not vehicle-specific. model_year is
  -- the switched-TO year, never the old row's.
  -- Phase 1 (Step 5): the assigned agent carries over too (method inherited_switch),
  -- so a switch never re-rolls the agent. An unassigned old row gives an unassigned
  -- new row. The assignment guard flag is on only for this insert.
  -- Step 9b: inherit the old agent only if they're still active (not deactivated). Away or
  -- out-of-rotation agents are still inherited, like any search they already hold (Q5).
  select a.id into v_inherit from public.agents a where a.id = v_old.assigned_agent_id and a.active;

  perform set_config('levr.assignment', 'on', true);
  insert into public.customer_searches (
    customer_id, make, model, model_year, zip, paid_at,
    pickup_travel_choice, pickup_travel_miles, pickup_travel_set_at,
    assigned_agent_id, assigned_at
  )
  values (
    v_old.customer_id, p_new_make, p_new_model, p_new_model_year, v_old.zip, p_paid_at,
    v_old.pickup_travel_choice, v_old.pickup_travel_miles, v_old.pickup_travel_set_at,
    v_inherit, case when v_inherit is not null then now() end
  )
  returning * into v_new;
  perform set_config('levr.assignment', 'off', true);

  update public.customer_searches
  set superseded_by_id = v_new.id,
      search_status = 'switched'
  where id = p_old_search_id;

  if v_inherit is not null then
    insert into public.search_assignments (search_id, agent_id, method, reason)
    values (v_new.id, v_inherit, 'inherited_switch', 'switched from search ' || p_old_search_id);
  elsif v_old.assigned_agent_id is not null and v_new.paid_at is not null then
    -- The old agent has been deactivated: use the normal rules instead (test accounts skipped,
    -- continuity, round-robin, lead fallback, admin alert). A never-assigned old row stays
    -- unassigned here, exactly as before; the payment step / hourly sweep handles those.
    perform public.assign_search(v_new.id);
    select * into v_new from public.customer_searches where id = v_new.id;
  end if;

  if p_agent_id is not null then
    insert into public.agent_bypass_log (search_id, agent_id, fee_type, reason_category, notes)
    values (p_old_search_id, p_agent_id, 'switch', p_reason_category, p_notes);

    perform public.log_agent_activity(p_agent_id, 'search_switched', p_old_search_id, v_old.customer_id,
      p_details => jsonb_build_object('new_search_id', v_new.id, 'new_make', p_new_make,
                                      'new_model', p_new_model, 'reason_category', p_reason_category));
  end if;

  return v_new;
end;
$$;
