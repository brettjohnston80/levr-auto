-- Agent dashboard Phase 1, Step 4: search assignment.
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (section 4, and section 10 Step 4).
--
-- What this does:
--   * customer_searches.assigned_agent_id / assigned_at: the single source of truth (Q13).
--   * search_assignments: assignment history (who, from whom, by whom, method, reason).
--   * customer_searches_assignment_guard: assigned_agent_id / assigned_at change only when a
--     transaction set levr.assignment = 'on' (only these functions and switch_customer_search
--     from Step 5 do). This also stops a customer insert from setting them.
--   * is_test_customer(): the CLAUDE.md test-account rules, by auth email (N7).
--   * assign_search(): test accounts skipped -> continuity -> round-robin over everyone in
--     rotation (away ignored) -> least-recently-assigned active LEAD (never an admin) with a
--     lead alert -> otherwise unassigned with an admin alert. Idempotent. Nothing calls it
--     until the Phase 1 code deploys after the tester round.
--   * reassign_search(): leads/admins only, reason required, writes history + activity.
--   * Second lock, reads too: SELECT revoked from anon/authenticated on the agent tables
--     from Steps 1-3; the full revoke on search_assignments.
--
-- No existing row is changed: every search stays unassigned until Step 10 / the deploy.
-- No deployed code reads or writes the new columns, table or functions.

alter table public.customer_searches
  add column assigned_agent_id uuid references public.agents (id),
  add column assigned_at timestamptz;

create index customer_searches_assigned_agent_idx
  on public.customer_searches (assigned_agent_id, created_at desc, id) where assigned_agent_id is not null;
create index customer_searches_unassigned_paid_idx
  on public.customer_searches (paid_at, id) where assigned_agent_id is null and paid_at is not null;

create table public.search_assignments (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.customer_searches (id) on delete cascade,
  agent_id uuid not null references public.agents (id),
  previous_agent_id uuid references public.agents (id),
  assigned_by_agent_id uuid references public.agents (id), -- null = automatic
  method text not null check (method in (
    'continuity', 'round_robin', 'lead_fallback', 'inherited_switch', 'manual', 'backfill')),
  reason text,
  created_at timestamptz not null default now()
);
create index search_assignments_search_idx on public.search_assignments (search_id, created_at desc, id);
create index search_assignments_agent_idx on public.search_assignments (agent_id, created_at desc, id);
alter table public.search_assignments enable row level security;
revoke select, insert, update, delete, truncate on public.search_assignments from anon, authenticated;

-- Second lock, reads too (2026-10-11): internal staff data must not depend on RLS alone for reads.
-- Every read of these tables goes through the service role (checked 2026-10-11), so nothing breaks.
revoke select on public.agents, public.agent_activity_types, public.agent_activity_log,
  public.agent_alerts, public.agent_away_periods from anon, authenticated;

create function public.customer_searches_assignment_guard() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT' and (new.assigned_agent_id is not null or new.assigned_at is not null))
     or (tg_op = 'UPDATE' and (new.assigned_agent_id, new.assigned_at)
                              is distinct from (old.assigned_agent_id, old.assigned_at)) then
    if coalesce(current_setting('levr.assignment', true), '') <> 'on' then
      raise exception 'assigned_agent_id / assigned_at change only through assign_search(), reassign_search() or switch_customer_search()';
    end if;
  end if;
  return new;
end;
$$;

create trigger customer_searches_assignment_guard
before insert or update of assigned_agent_id, assigned_at on public.customer_searches
for each row execute function public.customer_searches_assignment_guard();

-- Test accounts (N7): the CLAUDE.md rules, by the auth email (never customers.email, which is not unique).
-- security definer so it can read auth.users whatever role calls it; safe because execute is
-- revoked from anon/authenticated below, and search_path is pinned.
create function public.is_test_customer(p_customer_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_customer_id
      and (lower(u.email) like '%@levrauto-test.invalid' or lower(u.email) like '%@levrauto.invalid')
  );
$$;

-- Automatic assignment. Idempotent. Returns what happened so the app can email the alert's audience.
create function public.assign_search(p_search_id uuid) returns jsonb
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
    and a.active and a.in_rotation
  order by s.assigned_at desc nulls last
  limit 1;
  v_method := 'continuity';

  -- 2. (Future) routing preferences by state/make narrow the pool here.

  -- 3. Round-robin (Q3): everyone in rotation who isn't deactivated. Away status is ignored by design.
  if v_agent is null then
    select id into v_agent from public.agents
    where active and in_rotation
    order by last_assigned_at nulls first, created_at, id
    limit 1;
    v_method := 'round_robin';
  end if;

  -- 4. Nobody in rotation (Q4/N1): least-recently-assigned ACTIVE LEAD. role = 'lead' exactly:
  --    the system never picks an admin.
  if v_agent is null then
    select id into v_agent from public.agents
    where active and role = 'lead'
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

-- Lead/admin reassignment to anyone active, including themselves (Q5).
create function public.reassign_search(
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

revoke execute on function public.assign_search(uuid), public.reassign_search(uuid, uuid, uuid, text),
  public.is_test_customer(uuid) from public, anon, authenticated;
grant execute on function public.is_test_customer(uuid) to service_role;
grant execute on function public.assign_search(uuid), public.reassign_search(uuid, uuid, uuid, text) to service_role;
