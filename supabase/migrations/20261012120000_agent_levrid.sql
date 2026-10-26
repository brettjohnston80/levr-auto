-- Agent dashboard Phase 1, Step 11: LEVRID, a permanent internal number for every agent.
-- Plan: docs/plans/agent-dashboard-phase1-code-plan.md (section 7, Step 11).
--
-- Rules (Brett, 2026-10-12):
--   * a plain sequential number starting at 1 (no prefix, no padding), assigned automatically when
--     an agent is added; permanent; never reused; kept when an agent is deactivated; internal only.
--   * Brett is LEVRID 1. It identifies the agent in activity history, team screens and
--     assignments. It is NOT used to sign in.
--
-- How numbers are generated so they're never reused, and with no gaps from rolled-back work:
--   * agent_levrid_counter is a one-row table holding the last LEVRID issued. A trigger on agents
--     takes the next number by updating that row inside the inserting transaction. The row lock
--     serializes concurrent adds, and a rolled-back add rolls the counter back too, so a failed or
--     rolled-back add never burns a number (a Postgres sequence would).
--   * The counter only ever goes up, and LEVRIDs are unique, so a number is never issued twice,
--     even if an agent row were ever deleted.
--   * Disposable test agents (@levrauto-test.invalid) get NO LEVRID, so automated verification can
--     never use up real numbers. Every other agent must have one (check constraint).
--   * A guard trigger blocks setting or changing a LEVRID by hand. The one-off backfill below uses
--     the transaction-local flag levr.levrid_admin, switched off before commit.
--   * add_agent (same signature) also records the new LEVRID in its activity row; its return row
--     already includes every agents column, LEVRID included.
--
-- The counter table gets both locks (RLS on, no policies; every table right revoked from anon and
-- authenticated). No customer-facing change; nothing in src/ reads LEVRID yet.

begin;

create table public.agent_levrid_counter (
  id boolean primary key default true check (id),
  last_value integer not null check (last_value >= 0)
);
alter table public.agent_levrid_counter enable row level security;
revoke select, insert, update, delete, truncate on public.agent_levrid_counter from anon, authenticated;
insert into public.agent_levrid_counter (id, last_value) values (true, 0);

alter table public.agents add column levrid integer unique check (levrid is null or levrid > 0);
comment on column public.agents.levrid is
  'LEVRID: permanent internal agent number, sequential from 1, never reused, kept on deactivation. Assigned by trigger from agent_levrid_counter; test agents (@levrauto-test.invalid) have none. Not a sign-in identifier.';

-- Backfill: existing non-test agents get 1, 2, ... in the order they were created (Brett = 1).
select set_config('levr.levrid_admin', 'on', true);
update public.agents a set levrid = n.rn
from (select id, row_number() over (order by created_at, id) as rn
      from public.agents where lower(email) not like '%@levrauto-test.invalid') n
where a.id = n.id;
update public.agent_levrid_counter
set last_value = coalesce((select max(levrid) from public.agents), 0);
select set_config('levr.levrid_admin', 'off', true);

alter table public.agents add constraint agents_levrid_required
  check (levrid is not null or lower(email) like '%@levrauto-test.invalid');

create function public.agents_levrid() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('levr.levrid_admin', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.levrid is not null then
      raise exception 'LEVRID is assigned automatically and cannot be set by hand';
    end if;
    if lower(new.email) not like '%@levrauto-test.invalid' then
      update public.agent_levrid_counter set last_value = last_value + 1
      returning last_value into new.levrid;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.levrid is distinct from old.levrid then
      raise exception 'LEVRID is permanent and cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

create trigger agents_levrid before insert or update on public.agents
for each row execute function public.agents_levrid();

create or replace function public.add_agent(
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
    p_details => jsonb_build_object('agent_id', v_agent.id, 'levrid', v_agent.levrid, 'email', v_agent.email,
                                    'role', v_agent.role, 'in_rotation', v_agent.in_rotation));
  return v_agent;
end;
$$;

revoke execute on function public.add_agent(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.add_agent(uuid, text, text, text, boolean) to service_role;

commit;
