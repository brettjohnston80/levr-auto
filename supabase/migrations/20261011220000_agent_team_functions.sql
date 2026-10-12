-- Agent dashboard Phase 1, Step 9a: agent-management, away and alert functions; alert email
-- tracking; neutral call-outcome values.
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (sections 2, 3, 9, and section 10 Step 9).
--
-- Every function here:
--   * takes the acting agent (p_actor_agent_id) and re-checks the permission rules itself
--     (section 2), so a bug in the app can't widen them;
--   * turns the agents guard flag on only around its own write (Step 1 trigger);
--   * records the action through log_agent_activity (never fails the action);
--   * is security invoker, with execute revoked from anon/authenticated (service role only).
-- Nothing calls these until the Phase 1 code deploys after the tester round.
--
-- Also:
--   * agent_alerts.notified_at: alerts can be raised inside other functions, so the app emails
--     them from a sweep over alerts not yet notified, then stamps this column.
--   * switch/cancellation call outcomes become neutral words, because customers can read their
--     own searches through the API. Both columns are empty today, so nothing is rewritten.

-- 1. Alert email tracking ---------------------------------------------------------------------
alter table public.agent_alerts add column notified_at timestamptz;
create index agent_alerts_unnotified_idx on public.agent_alerts (created_at, id) where notified_at is null;

-- 2. Neutral call-outcome values (customers can see these on their own searches) ----------------
alter table public.customer_searches
  drop constraint customer_searches_switch_call_outcome_check,
  drop constraint customer_searches_cancellation_call_outcome_check;
alter table public.customer_searches
  add constraint customer_searches_switch_call_outcome_check
    check (switch_call_outcome in ('switched', 'no_switch', 'call_not_completed', 'other')),
  add constraint customer_searches_cancellation_call_outcome_check
    check (cancellation_call_outcome in ('cancelled', 'not_cancelled', 'call_not_completed', 'other'));

-- 3. Agent management ---------------------------------------------------------------------------

-- Leads add agents; only admins add leads or admins (Q17). in_rotation null = the role's default.
create function public.add_agent(
  p_actor_agent_id uuid,
  p_email text,
  p_name text,
  p_role text default 'agent',
  p_in_rotation boolean default null
) returns public.agents
language plpgsql as $$
declare
  v_agent public.agents;
begin
  if not public.agent_has_role(p_actor_agent_id, 'lead') then
    raise exception 'only leads and admins can add agents';
  end if;
  if p_role not in ('agent', 'lead', 'admin') then
    raise exception 'unknown role %', p_role;
  end if;
  if p_role <> 'agent' and not public.agent_has_role(p_actor_agent_id, 'admin') then
    raise exception 'only admins can add a lead or an admin';
  end if;
  if p_email is null or btrim(p_email) = '' or p_name is null or btrim(p_name) = '' then
    raise exception 'an email and a name are required';
  end if;
  if exists (select 1 from public.agents where lower(email) = lower(btrim(p_email))) then
    raise exception 'an agent with email % already exists', btrim(p_email);
  end if;

  perform set_config('levr.agent_admin', 'on', true);
  insert into public.agents (email, name, role, in_rotation)
  values (lower(btrim(p_email)), btrim(p_name), p_role, coalesce(p_in_rotation, p_role = 'agent'))
  returning * into v_agent;
  perform set_config('levr.agent_admin', 'off', true);

  perform public.log_agent_activity(p_actor_agent_id, 'agent_added',
    p_details => jsonb_build_object('agent_id', v_agent.id, 'email', v_agent.email,
                                    'role', v_agent.role, 'in_rotation', v_agent.in_rotation));
  return v_agent;
end;
$$;

-- Admins only. A role change resets in_rotation to the new role's default unless the admin
-- passes an override (N2); the app shows the reset value before saving. Last-admin guard (N5).
create function public.set_agent_role(
  p_actor_agent_id uuid,
  p_subject_agent_id uuid,
  p_role text,
  p_in_rotation boolean default null
) returns public.agents
language plpgsql as $$
declare
  v_old public.agents;
  v_new public.agents;
  v_rotation boolean;
begin
  if not public.agent_has_role(p_actor_agent_id, 'admin') then
    raise exception 'only admins can change roles';
  end if;
  if p_role not in ('agent', 'lead', 'admin') then
    raise exception 'unknown role %', p_role;
  end if;

  select * into v_old from public.agents where id = p_subject_agent_id for update;
  if not found then
    raise exception 'agent % not found', p_subject_agent_id;
  end if;
  if v_old.role = 'admin' and p_role <> 'admin' and v_old.active and not exists (
    select 1 from public.agents where role = 'admin' and active and id <> p_subject_agent_id
  ) then
    raise exception 'cannot remove the last active admin';
  end if;

  v_rotation := coalesce(p_in_rotation, p_role = 'agent') and v_old.active;

  perform set_config('levr.agent_admin', 'on', true);
  update public.agents set role = p_role, in_rotation = v_rotation
  where id = p_subject_agent_id returning * into v_new;
  perform set_config('levr.agent_admin', 'off', true);

  perform public.log_agent_activity(p_actor_agent_id, 'agent_role_changed',
    p_details => jsonb_build_object('agent_id', p_subject_agent_id,
                                    'from_role', v_old.role, 'to_role', v_new.role,
                                    'from_in_rotation', v_old.in_rotation, 'to_in_rotation', v_new.in_rotation));
  return v_new;
end;
$$;

-- Leads for agents and leads (themselves included); admins for anyone (N3).
-- A deactivated agent can't be put in rotation.
create function public.set_agent_rotation(
  p_actor_agent_id uuid,
  p_subject_agent_id uuid,
  p_in_rotation boolean
) returns public.agents
language plpgsql as $$
declare
  v_old public.agents;
  v_new public.agents;
begin
  if not public.agent_has_role(p_actor_agent_id, 'lead') then
    raise exception 'only leads and admins can change rotation';
  end if;
  select * into v_old from public.agents where id = p_subject_agent_id for update;
  if not found then
    raise exception 'agent % not found', p_subject_agent_id;
  end if;
  if v_old.role = 'admin' and not public.agent_has_role(p_actor_agent_id, 'admin') then
    raise exception 'only admins can change an admin''s rotation';
  end if;
  if p_in_rotation and not v_old.active then
    raise exception 'a deactivated agent cannot be put in rotation';
  end if;

  perform set_config('levr.agent_admin', 'on', true);
  update public.agents set in_rotation = p_in_rotation
  where id = p_subject_agent_id returning * into v_new;
  perform set_config('levr.agent_admin', 'off', true);

  perform public.log_agent_activity(p_actor_agent_id, 'agent_rotation_changed',
    p_details => jsonb_build_object('agent_id', p_subject_agent_id,
                                    'from_in_rotation', v_old.in_rotation, 'to_in_rotation', v_new.in_rotation));
  return v_new;
end;
$$;

-- Leads for agents; admins for anyone (N4). Deactivating also takes the agent out of rotation;
-- reactivating leaves them out of rotation until someone puts them back. Last-admin guard (N5).
-- A deactivated agent keeps their searches (Q5); leads reassign them.
create function public.set_agent_active(
  p_actor_agent_id uuid,
  p_subject_agent_id uuid,
  p_active boolean
) returns public.agents
language plpgsql as $$
declare
  v_old public.agents;
  v_new public.agents;
begin
  if not public.agent_has_role(p_actor_agent_id, 'lead') then
    raise exception 'only leads and admins can deactivate or reactivate agents';
  end if;
  select * into v_old from public.agents where id = p_subject_agent_id for update;
  if not found then
    raise exception 'agent % not found', p_subject_agent_id;
  end if;
  if public.agent_role_rank(v_old.role) >= public.agent_role_rank('lead')
     and not public.agent_has_role(p_actor_agent_id, 'admin') then
    raise exception 'only admins can deactivate or reactivate a lead or an admin';
  end if;
  if not p_active and v_old.role = 'admin' and v_old.active and not exists (
    select 1 from public.agents where role = 'admin' and active and id <> p_subject_agent_id
  ) then
    raise exception 'cannot deactivate the last active admin';
  end if;
  if v_old.active = p_active then
    return v_old;
  end if;

  perform set_config('levr.agent_admin', 'on', true);
  if p_active then
    update public.agents
    set active = true, deactivated_at = null, deactivated_by_agent_id = null
    where id = p_subject_agent_id returning * into v_new;
  else
    -- in_rotation goes off in the same statement, so agents_deactivated_not_in_rotation holds.
    update public.agents
    set active = false, in_rotation = false, deactivated_at = now(), deactivated_by_agent_id = p_actor_agent_id
    where id = p_subject_agent_id returning * into v_new;
  end if;
  perform set_config('levr.agent_admin', 'off', true);

  perform public.log_agent_activity(p_actor_agent_id,
    case when p_active then 'agent_reactivated' else 'agent_deactivated' end,
    p_details => jsonb_build_object('agent_id', p_subject_agent_id, 'was_in_rotation', v_old.in_rotation));
  return v_new;
end;
$$;

-- 4. Away periods (status signal only; never changes assignment) --------------------------------

-- An agent asks for their own time away. Admins can set their own (approved straight away, Q16).
create function public.request_away(
  p_actor_agent_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text default null
) returns public.agent_away_periods
language plpgsql as $$
declare
  v_period public.agent_away_periods;
  v_is_admin boolean;
begin
  if not public.agent_has_role(p_actor_agent_id, 'agent') then
    raise exception 'agent % is not an active agent', p_actor_agent_id;
  end if;
  v_is_admin := public.agent_has_role(p_actor_agent_id, 'admin');

  insert into public.agent_away_periods
    (agent_id, starts_at, ends_at, reason, status, requested_by_agent_id, decided_by_agent_id, decided_at)
  values (p_actor_agent_id, p_starts_at, p_ends_at, p_reason,
          case when v_is_admin then 'approved' else 'requested' end,
          p_actor_agent_id,
          case when v_is_admin then p_actor_agent_id end,
          case when v_is_admin then now() end)
  returning * into v_period;

  perform public.log_agent_activity(p_actor_agent_id,
    case when v_is_admin then 'away_set' else 'away_requested' end,
    p_details => jsonb_build_object('away_period_id', v_period.id, 'agent_id', p_actor_agent_id,
                                    'starts_at', p_starts_at, 'ends_at', p_ends_at, 'status', v_period.status));
  return v_period;
end;
$$;

-- A lead or admin approves or rejects someone else's request. That covers "a lead's or admin's
-- own request is approved by another lead or admin" (Q16).
create function public.decide_away(
  p_actor_agent_id uuid,
  p_away_period_id uuid,
  p_approve boolean,
  p_note text default null
) returns public.agent_away_periods
language plpgsql as $$
declare
  v_period public.agent_away_periods;
begin
  if not public.agent_has_role(p_actor_agent_id, 'lead') then
    raise exception 'only leads and admins can approve or reject time away';
  end if;
  select * into v_period from public.agent_away_periods where id = p_away_period_id for update;
  if not found then
    raise exception 'away period % not found', p_away_period_id;
  end if;
  if v_period.agent_id = p_actor_agent_id then
    raise exception 'another lead or admin must decide your own time-away request';
  end if;
  if v_period.status <> 'requested' then
    raise exception 'this request is already %', v_period.status;
  end if;

  update public.agent_away_periods
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by_agent_id = p_actor_agent_id, decided_at = now(), decision_note = p_note
  where id = p_away_period_id returning * into v_period;

  perform public.log_agent_activity(p_actor_agent_id, 'away_decided',
    p_details => jsonb_build_object('away_period_id', v_period.id, 'agent_id', v_period.agent_id,
                                    'status', v_period.status));
  return v_period;
end;
$$;

-- A lead sets time away for someone else (approved straight away). An admin may also set their own.
create function public.set_away(
  p_actor_agent_id uuid,
  p_subject_agent_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text default null
) returns public.agent_away_periods
language plpgsql as $$
declare
  v_period public.agent_away_periods;
begin
  if not public.agent_has_role(p_actor_agent_id, 'lead') then
    raise exception 'only leads and admins can set time away for someone';
  end if;
  if p_subject_agent_id = p_actor_agent_id and not public.agent_has_role(p_actor_agent_id, 'admin') then
    raise exception 'request your own time away instead; another lead or admin approves it';
  end if;
  if not exists (select 1 from public.agents where id = p_subject_agent_id and active) then
    raise exception 'agent % is deactivated or does not exist', p_subject_agent_id;
  end if;

  insert into public.agent_away_periods
    (agent_id, starts_at, ends_at, reason, status, requested_by_agent_id, decided_by_agent_id, decided_at)
  values (p_subject_agent_id, p_starts_at, p_ends_at, p_reason, 'approved',
          p_actor_agent_id, p_actor_agent_id, now())
  returning * into v_period;

  perform public.log_agent_activity(p_actor_agent_id, 'away_set',
    p_details => jsonb_build_object('away_period_id', v_period.id, 'agent_id', p_subject_agent_id,
                                    'starts_at', p_starts_at, 'ends_at', p_ends_at));
  return v_period;
end;
$$;

-- The agent cancels their own request or period; a lead or admin can cancel anyone's.
create function public.cancel_away(
  p_actor_agent_id uuid,
  p_away_period_id uuid
) returns public.agent_away_periods
language plpgsql as $$
declare
  v_period public.agent_away_periods;
begin
  if not public.agent_has_role(p_actor_agent_id, 'agent') then
    raise exception 'agent % is not an active agent', p_actor_agent_id;
  end if;
  select * into v_period from public.agent_away_periods where id = p_away_period_id for update;
  if not found then
    raise exception 'away period % not found', p_away_period_id;
  end if;
  if v_period.agent_id <> p_actor_agent_id and not public.agent_has_role(p_actor_agent_id, 'lead') then
    raise exception 'only the agent, a lead or an admin can cancel this time away';
  end if;
  if v_period.status not in ('requested', 'approved') then
    raise exception 'this time away is already %', v_period.status;
  end if;

  update public.agent_away_periods
  set status = 'cancelled', cancelled_by_agent_id = p_actor_agent_id, cancelled_at = now()
  where id = p_away_period_id returning * into v_period;

  perform public.log_agent_activity(p_actor_agent_id, 'away_cancelled',
    p_details => jsonb_build_object('away_period_id', v_period.id, 'agent_id', v_period.agent_id));
  return v_period;
end;
$$;

-- 5. Alerts ---------------------------------------------------------------------------------------

create function public.resolve_agent_alert(
  p_actor_agent_id uuid,
  p_alert_id uuid
) returns public.agent_alerts
language plpgsql as $$
declare
  v_alert public.agent_alerts;
begin
  if not public.agent_has_role(p_actor_agent_id, 'lead') then
    raise exception 'only leads and admins can resolve alerts';
  end if;
  update public.agent_alerts
  set resolved_at = now(), resolved_by_agent_id = p_actor_agent_id
  where id = p_alert_id and resolved_at is null
  returning * into v_alert;
  if not found then
    raise exception 'alert % not found or already resolved', p_alert_id;
  end if;

  perform public.log_agent_activity(p_actor_agent_id, 'alert_resolved', v_alert.search_id,
    p_details => jsonb_build_object('alert_id', v_alert.id, 'kind', v_alert.kind));
  return v_alert;
end;
$$;

-- 6. Lock down --------------------------------------------------------------------------------
revoke execute on function
  public.add_agent(uuid, text, text, text, boolean),
  public.set_agent_role(uuid, uuid, text, boolean),
  public.set_agent_rotation(uuid, uuid, boolean),
  public.set_agent_active(uuid, uuid, boolean),
  public.request_away(uuid, timestamptz, timestamptz, text),
  public.decide_away(uuid, uuid, boolean, text),
  public.set_away(uuid, uuid, timestamptz, timestamptz, text),
  public.cancel_away(uuid, uuid),
  public.resolve_agent_alert(uuid, uuid)
from public, anon, authenticated;
grant execute on function
  public.add_agent(uuid, text, text, text, boolean),
  public.set_agent_role(uuid, uuid, text, boolean),
  public.set_agent_rotation(uuid, uuid, boolean),
  public.set_agent_active(uuid, uuid, boolean),
  public.request_away(uuid, timestamptz, timestamptz, text),
  public.decide_away(uuid, uuid, boolean, text),
  public.set_away(uuid, uuid, timestamptz, timestamptz, text),
  public.cancel_away(uuid, uuid),
  public.resolve_agent_alert(uuid, uuid)
to service_role;
