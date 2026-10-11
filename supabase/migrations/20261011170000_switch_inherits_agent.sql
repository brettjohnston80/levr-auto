-- Agent dashboard Phase 1, Step 5: switches inherit the assigned agent.
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (section 4.2, and section 10 Step 5).
--
-- switch_customer_search is replaced in place: IDENTICAL signature (so no second
-- overload) and its current body copied verbatim from
-- 20260926130000_pickup_travel_and_handoff.sql, with only these additions:
--   * the new row gets the old row's assigned_agent_id / assigned_at (set now()),
--     inside the assignment guard flag, which is switched off right after the insert;
--   * a search_assignments history row (method inherited_switch) when there was an agent;
--   * for agent-initiated switches, an agent_activity_log row (search_switched) next to
--     the existing agent_bypass_log row, via log_agent_activity (never fails the switch).
--
-- All three callers keep working unchanged (same parameters, same return row):
--   src/app/api/stripe/webhook/route.ts:192 (paid switch), src/lib/switch-actions.ts:92
--   (agent switch), src/lib/switch-self-service-actions.ts:185 (free switch).
-- Today every search is unassigned (backfill is Step 10), so a switch right now behaves
-- exactly as before: unassigned old row -> unassigned new row, no history row.

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
  perform set_config('levr.assignment', 'on', true);
  insert into public.customer_searches (
    customer_id, make, model, model_year, zip, paid_at,
    pickup_travel_choice, pickup_travel_miles, pickup_travel_set_at,
    assigned_agent_id, assigned_at
  )
  values (
    v_old.customer_id, p_new_make, p_new_model, p_new_model_year, v_old.zip, p_paid_at,
    v_old.pickup_travel_choice, v_old.pickup_travel_miles, v_old.pickup_travel_set_at,
    v_old.assigned_agent_id, case when v_old.assigned_agent_id is not null then now() end
  )
  returning * into v_new;
  perform set_config('levr.assignment', 'off', true);

  update public.customer_searches
  set superseded_by_id = v_new.id,
      search_status = 'switched'
  where id = p_old_search_id;

  if v_old.assigned_agent_id is not null then
    insert into public.search_assignments (search_id, agent_id, method, reason)
    values (v_new.id, v_old.assigned_agent_id, 'inherited_switch', 'switched from search ' || p_old_search_id);
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

