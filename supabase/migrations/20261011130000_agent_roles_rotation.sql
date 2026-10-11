-- Agent dashboard Phase 1, Step 1: agent roles, workload setting, deactivation fields,
-- role helper functions, and the guard trigger on agents.
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (sections 1-3 and section 10, Step 1).
--
-- What this does:
--   * agents.role: permissions only, stacked (admin implies lead implies agent).
--     Compare with agent_role_rank(), never by equality.
--   * agents.in_rotation: workload, separate from role. Defaults by role on insert
--     (agent = true, lead/admin = false). Away status never changes it.
--     A deactivated agent (active = false) can never be in rotation (check constraint).
--   * auth_user_id, last_assigned_at, deactivated_at, deactivated_by_agent_id, updated_at.
--   * agent_role_rank() / agent_has_role(): the "at least lead" checks used by later steps.
--   * agents_guard trigger: role, in_rotation and active can only change when a
--     transaction has set levr.agent_admin = 'on' (only the Phase 1 functions will),
--     so a stray direct UPDATE from app code is rejected. Plain inserts of role
--     'agent' rows are still allowed.
--
-- What this does NOT do: no assignment, no backfill. Brett becomes admin in Step 10.
-- No deployed code writes to agents (all six references in src/ are reads), so the
-- guard changes nothing on the live site.

alter table public.agents
  add column role text not null default 'agent' check (role in ('agent', 'lead', 'admin')),
  add column in_rotation boolean,
  add column auth_user_id uuid unique references auth.users (id) on delete set null,
  add column last_assigned_at timestamptz,
  add column deactivated_at timestamptz,
  add column deactivated_by_agent_id uuid references public.agents (id),
  add column updated_at timestamptz not null default now();

-- Existing rows get the 'agent' role default, so in rotation if active.
-- (Brett's row becomes admin + in rotation in Step 10.)
update public.agents set in_rotation = active where in_rotation is null;
alter table public.agents alter column in_rotation set not null;
alter table public.agents add constraint agents_deactivated_not_in_rotation check (active or not in_rotation);

comment on column public.agents.role is
  'Permissions only, stacked: admin implies lead implies agent. Compare with agent_role_rank().';
comment on column public.agents.in_rotation is
  'Workload, separate from role: whether round-robin assigns new searches. Defaults by role on insert (agent true, lead/admin false). Away status never changes it. The system never picks an admin except through in_rotation.';
comment on column public.agents.auth_user_id is
  'Stable identity for the sign-in check (matched first, then lower(email)).';

create unique index agents_email_lower_idx on public.agents (lower(email));

create function public.agent_role_rank(p_role text) returns integer
language sql immutable as $$
  select case p_role when 'agent' then 1 when 'lead' then 2 when 'admin' then 3 else 0 end;
$$;

create function public.agent_has_role(p_agent_id uuid, p_min_role text) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.agents
    where id = p_agent_id and active
      and public.agent_role_rank(role) >= public.agent_role_rank(p_min_role)
  );
$$;

-- Insert default for in_rotation, plus the guard against direct role/rotation/active changes.
create function public.agents_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.in_rotation is null then
      new.in_rotation := (new.role = 'agent');
    end if;
    if new.role <> 'agent' and coalesce(current_setting('levr.agent_admin', true), '') <> 'on' then
      raise exception 'leads and admins can only be added through add_agent()';
    end if;
  elsif tg_op = 'UPDATE' then
    if (new.role, new.in_rotation, new.active) is distinct from (old.role, old.in_rotation, old.active)
       and coalesce(current_setting('levr.agent_admin', true), '') <> 'on' then
      raise exception 'role, in_rotation and active change only through the agent-management functions';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger agents_guard before insert or update on public.agents
for each row execute function public.agents_guard();

revoke execute on function public.agent_role_rank(text), public.agent_has_role(uuid, text)
  from public, anon, authenticated;
grant execute on function public.agent_role_rank(text), public.agent_has_role(uuid, text) to service_role;
