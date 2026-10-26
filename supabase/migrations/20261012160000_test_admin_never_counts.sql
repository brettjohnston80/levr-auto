-- Agent dashboard Phase 1, Step 13: the persistent test admin, and test agents never count as real.
-- Plan: docs/plans/agent-dashboard-phase1-code-plan.md (section 1, "A test acting as a real agent").
--
-- Brett's choice (a), 2026-10-12: automated tests that need a lead or admin actor act as one
-- persistent test admin, claude-verify-admin@levrauto-test.invalid. It has no LEVRID (test domain),
-- is out of rotation, is never linked to a login and is never deleted. Each run deletes only the
-- rows it wrote. Nobody can sign in as it: linking a login needs a real admin (link_agent_login),
-- and agent pages need an agent-only login with two-factor (Chunk 1d).
--
-- So that a test row can never count as a real admin or lead, test-domain agents
-- (@levrauto-test.invalid, the same rule as LEVRIDs) are now ignored by:
--   * set_agent_role / set_agent_active: the "last active admin" checks. Without this, Brett could
--     demote or deactivate himself and leave only the test admin. (There is no "last active lead"
--     check anywhere; checked by grep.)
--   * assign_search: continuity, round-robin and the lead fallback. So the "no active lead -> alert
--     admins" step fires when only test leads exist, and a real paid search is never auto-assigned
--     to a test agent.
--   * reassign_search: a real customer's search can't be reassigned to a test agent (a test
--     customer's search still can, for verification).
--   * agent_alert_recipients(audience) (new): who an alert is emailed to, for the Chunk 4 sweep.
--     'leads' = active real leads, or active real admins when there's none; 'admins' = active real
--     admins. Test agents never appear.
-- App-side agent lists (the admin table, call-request and article-reminder emails) skip test agents
-- in the Phase 1 code; until then any email to the test admin is suppressed by sendEmail
-- (.invalid recipient), and it can't sign in.
--
-- Each replaced function keeps its IDENTICAL signature (replaced in place, no overload) and is its
-- live text plus only the lines above: assign_search and reassign_search from
-- 20261011160000_search_assignment.sql; set_agent_role and set_agent_active from
-- 20261011220000_agent_team_functions.sql (none redefined since; checked by grep).

begin;

-- 1. The test-agent rule --------------------------------------------------------------------------
create function public.is_test_agent_email(p_email text) returns boolean
language sql immutable set search_path = '' as $$
  select lower(coalesce(p_email, '')) like '%@levrauto-test.invalid';
$$;

-- 2. Replaced functions ---------------------------------------------------------------------------
create or replace function public.assign_search(p_search_id uuid) returns jsonb
language plpgsql as $$
declare
  v_search public.customer_searches;
  v_agent uuid;
  v_method text;
  v_alert uuid;
begin
  perform pg_advisory_xact_lock(hashtext('levr_assign_search'));

  select * into v_search from public.customer_searches where id = p_search_id for update;
  if not found then
    raise exception 'customer_searches row % not found', p_search_id;
  end if;
  if v_search.assigned_agent_id is not null then
    return jsonb_build_object('search_id', p_search_id, 'agent_id', v_search.assigned_agent_id, 'method', 'already_assigned');
  end if;
  if v_search.paid_at is null then
    raise exception 'search % is not paid; only paid searches are assigned', p_search_id;
  end if;

  -- 0. Test accounts are never auto-assigned (N7); a lead can still use reassign_search.
  if public.is_test_customer(v_search.customer_id) then
    return jsonb_build_object('search_id', p_search_id, 'agent_id', null, 'method', 'skipped_test_account');
  end if;

  -- 1. Continuity (Q2): the customer's most recent other search, if that agent is active and in rotation.
  select s.assigned_agent_id into v_agent
  from public.customer_searches s
  join public.agents a on a.id = s.assigned_agent_id
  where s.customer_id = v_search.customer_id and s.id <> v_search.id
    and a.active and a.in_rotation and not public.is_test_agent_email(a.email)
  order by s.assigned_at desc nulls last
  limit 1;
  v_method := 'continuity';

  -- 2. (Future) routing preferences by state/make narrow the pool here.

  -- 3. Round-robin (Q3): everyone in rotation who isn't deactivated. Away status is ignored by design.
  if v_agent is null then
    select id into v_agent from public.agents
    where active and in_rotation and not public.is_test_agent_email(email)
    order by last_assigned_at nulls first, created_at, id
    limit 1;
    v_method := 'round_robin';
  end if;

  -- 4. Nobody in rotation (Q4/N1): least-recently-assigned ACTIVE LEAD. role = 'lead' exactly:
  --    the system never picks an admin.
  if v_agent is null then
    select id into v_agent from public.agents
    where active and role = 'lead' and not public.is_test_agent_email(email)
    order by last_assigned_at nulls first, created_at, id
    limit 1;
    v_method := 'lead_fallback';
  end if;

  -- 5. No active lead either: stay unassigned, alert ADMINS (record + email by the app). One open alert
  --    per search; the hourly sweep retries the assignment without re-alerting.
  if v_agent is null then
    insert into public.agent_alerts (kind, audience, search_id, details)
    values ('assignment_no_lead', 'admins', p_search_id, jsonb_build_object('reason', 'nobody in rotation and no active lead'))
    on conflict (search_id, kind)
      where resolved_at is null and search_id is not null
        and kind in ('assignment_lead_fallback', 'assignment_no_lead')
      do nothing
    returning id into v_alert;
    return jsonb_build_object('search_id', p_search_id, 'agent_id', null, 'method', 'unassigned', 'alert_id', v_alert);
  end if;

  -- The guard flag is on only for this one update, so it can't carry over to later statements.
  perform set_config('levr.assignment', 'on', true);
  update public.customer_searches set assigned_agent_id = v_agent, assigned_at = now() where id = p_search_id;
  perform set_config('levr.assignment', 'off', true);

  -- last_assigned_at isn't a guarded column, so no agents flag is needed here.
  update public.agents set last_assigned_at = now() where id = v_agent;

  insert into public.search_assignments (search_id, agent_id, method) values (p_search_id, v_agent, v_method);

  if v_method = 'lead_fallback' then
    insert into public.agent_alerts (kind, audience, search_id, agent_id, details)
    values ('assignment_lead_fallback', 'leads', p_search_id, v_agent, jsonb_build_object('reason', 'nobody in rotation'))
    on conflict (search_id, kind)
      where resolved_at is null and search_id is not null
        and kind in ('assignment_lead_fallback', 'assignment_no_lead')
      do nothing
    returning id into v_alert;
  end if;

  return jsonb_build_object('search_id', p_search_id, 'agent_id', v_agent, 'method', v_method, 'alert_id', v_alert);
end;
$$;

create or replace function public.reassign_search(
  p_search_id uuid, p_new_agent_id uuid, p_actor_agent_id uuid, p_reason text
) returns public.customer_searches
language plpgsql as $$
declare
  v_search public.customer_searches;
  v_previous uuid;
begin
  if not public.agent_has_role(p_actor_agent_id, 'lead') then
    raise exception 'only leads and admins can reassign searches';
  end if;
  if not exists (select 1 from public.agents where id = p_new_agent_id and active) then
    raise exception 'agent % is deactivated or does not exist', p_new_agent_id;
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required to reassign a search';
  end if;

  select * into v_search from public.customer_searches where id = p_search_id for update;
  if not found then
    raise exception 'customer_searches row % not found', p_search_id;
  end if;
  -- Step 13: a real customer's search never goes to a test agent.
  if public.is_test_agent_email((select email from public.agents where id = p_new_agent_id))
     and not public.is_test_customer(v_search.customer_id) then
    raise exception 'a real customer''s search can''t be assigned to a test agent';
  end if;
  v_previous := v_search.assigned_agent_id;
  if v_previous is not distinct from p_new_agent_id then
    return v_search;
  end if;

  perform set_config('levr.assignment', 'on', true);
  update public.customer_searches set assigned_agent_id = p_new_agent_id, assigned_at = now()
  where id = p_search_id returning * into v_search;
  perform set_config('levr.assignment', 'off', true);

  insert into public.search_assignments (search_id, agent_id, previous_agent_id, assigned_by_agent_id, method, reason)
  values (p_search_id, p_new_agent_id, v_previous, p_actor_agent_id, 'manual', p_reason);

  perform public.log_agent_activity(p_actor_agent_id, 'search_reassigned', p_search_id, v_search.customer_id,
    p_details => jsonb_build_object('from_agent_id', v_previous, 'to_agent_id', p_new_agent_id, 'reason', p_reason));

  return v_search;
end;
$$;

create or replace function public.set_agent_role(
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
      and not public.is_test_agent_email(email)
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

create or replace function public.set_agent_active(
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
      and not public.is_test_agent_email(email)
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

-- 3. Alert recipients (for the Chunk 4 email sweep) -------------------------------------------------
create function public.agent_alert_recipients(p_audience text)
returns table (agent_id uuid, email text, name text, role text)
language plpgsql stable as $$
begin
  if p_audience not in ('leads', 'admins') then
    raise exception 'unknown alert audience %', p_audience;
  end if;
  if p_audience = 'leads' then
    return query
      select a.id, a.email, a.name, a.role from public.agents a
      where a.active and a.role = 'lead' and not public.is_test_agent_email(a.email)
      order by a.levrid nulls last, a.created_at;
    if found then
      return;
    end if;
  end if;
  return query
    select a.id, a.email, a.name, a.role from public.agents a
    where a.active and a.role = 'admin' and not public.is_test_agent_email(a.email)
    order by a.levrid nulls last, a.created_at;
end;
$$;

-- 4. The persistent test admin (under the agents flag; once only) -----------------------------------
select set_config('levr.agent_admin', 'on', true);
insert into public.agents (email, name, role, in_rotation)
select 'claude-verify-admin@levrauto-test.invalid', 'CLAUDE VERIFY TEST ADMIN (persistent, automated tests only)', 'admin', false
where not exists (select 1 from public.agents where lower(email) = 'claude-verify-admin@levrauto-test.invalid');
select set_config('levr.agent_admin', 'off', true);

-- 5. Lock down ------------------------------------------------------------------------------------
revoke execute on function
  public.is_test_agent_email(text),
  public.agent_alert_recipients(text),
  public.assign_search(uuid),
  public.reassign_search(uuid, uuid, uuid, text),
  public.set_agent_role(uuid, uuid, text, boolean),
  public.set_agent_active(uuid, uuid, boolean)
from public, anon, authenticated;
grant execute on function
  public.is_test_agent_email(text),
  public.agent_alert_recipients(text),
  public.assign_search(uuid),
  public.reassign_search(uuid, uuid, uuid, text),
  public.set_agent_role(uuid, uuid, text, boolean),
  public.set_agent_active(uuid, uuid, boolean)
to service_role;

commit;
