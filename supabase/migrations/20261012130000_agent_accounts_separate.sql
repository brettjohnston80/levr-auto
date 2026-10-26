-- Agent dashboard Phase 1, Step 12: keep agent and customer accounts separate.
-- Plan: docs/plans/agent-dashboard-phase1-code-plan.md (section 7.3; Chunk 1a).
--
-- What this does:
--   1. handle_new_user() (the sign-up trigger) no longer creates a customers row for an AGENT
--      login. An agent login is created only server-side, with
--      auth.admin.createUser({ app_metadata: { account_type: 'agent' } }). app_metadata
--      (raw_app_meta_data) can't be set or changed by a user, so a customer can't opt out of
--      being a customer, or mark themselves an agent; user_metadata is ignored for this.
--      Otherwise the function is the live text from 20260819150000_split_customer_name.sql.
--   2. agents.auth_user_id can only be set through link_agent_login (invite) or
--      relink_agent_login (Brett's cutover), and only to an agent login: one whose app_metadata
--      says account_type 'agent' and that has NO customers row. Guard trigger + flag
--      levr.agent_login. Brett's current link (to bjohnston@levrauto.com, a customer login) is
--      left alone here; it moves on deploy day (Chunk 1f).
--   3. agent_signin_attempts: per-account and per-IP sign-in counting for rate limiting
--      (hashed email and IP, never the raw values). Both locks.
--   4. Four activity types: agent_invited, agent_two_factor_enrolled, agent_two_factor_reset,
--      agent_login_relinked.
--
-- No customer-facing change. No existing row is changed. Nothing in src/ calls the new functions
-- yet. Customer sign-up is unchanged for every customer (no customer login has
-- account_type 'agent' in app_metadata).

begin;

-- 1. Sign-up trigger --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Agent logins are never customers (Phase 1, Step 12). Only server-set app_metadata counts.
  if coalesce(new.raw_app_meta_data ->> 'account_type', '') = 'agent' then
    return new;
  end if;

  insert into public.customers (id, email, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

-- 2. Agent login links ------------------------------------------------------------------------

-- Is this login an agent-only login? (agent flag in app_metadata, and no customers row)
create function public.is_agent_login(p_auth_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_auth_user_id
      and coalesce(u.raw_app_meta_data ->> 'account_type', '') = 'agent'
  ) and not exists (
    select 1 from public.customers c where c.id = p_auth_user_id
  );
$$;

create function public.agents_login_guard() returns trigger
language plpgsql as $$
begin
  -- Clearing the link is allowed (agents.auth_user_id is "on delete set null", so deleting a
  -- login must still work). Only SETTING it to a login needs the functions.
  if new.auth_user_id is not null
     and (tg_op = 'INSERT' or new.auth_user_id is distinct from old.auth_user_id) then
    if coalesce(current_setting('levr.agent_login', true), '') <> 'on' then
      raise exception 'an agent''s login is linked only through link_agent_login() or relink_agent_login()';
    end if;
    if not public.is_agent_login(new.auth_user_id) then
      raise exception 'login % is not an agent-only login (it must be created as an agent and have no customer record)', new.auth_user_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger agents_login_guard before insert or update of auth_user_id on public.agents
for each row execute function public.agents_login_guard();

-- Invite flow: link a newly created agent login to its agents row (only if not linked yet).
-- Same permission rule as add_agent: leads for agents, admins for leads/admins.
create function public.link_agent_login(
  p_actor_agent_id uuid,
  p_agent_id uuid,
  p_auth_user_id uuid
) returns public.agents
language plpgsql as $$
declare
  v_agent public.agents;
begin
  if not public.agent_has_role(p_actor_agent_id, 'lead') then
    raise exception 'only leads and admins can invite agents';
  end if;
  select * into v_agent from public.agents where id = p_agent_id for update;
  if not found then
    raise exception 'agent % not found', p_agent_id;
  end if;
  if v_agent.role <> 'agent' and not public.agent_has_role(p_actor_agent_id, 'admin') then
    raise exception 'only admins can invite a lead or an admin';
  end if;
  if v_agent.auth_user_id is not null then
    raise exception 'this agent already has a login';
  end if;

  perform set_config('levr.agent_login', 'on', true);
  update public.agents set auth_user_id = p_auth_user_id where id = p_agent_id returning * into v_agent;
  perform set_config('levr.agent_login', 'off', true);

  perform public.log_agent_activity(p_actor_agent_id, 'agent_invited',
    p_details => jsonb_build_object('agent_id', p_agent_id, 'levrid', v_agent.levrid, 'email', v_agent.email));
  return v_agent;
end;
$$;

-- Cutover: move an agent (and its LEVRID and history) to a different agent-only login. Admins only.
create function public.relink_agent_login(
  p_actor_agent_id uuid,
  p_agent_id uuid,
  p_new_auth_user_id uuid
) returns public.agents
language plpgsql as $$
declare
  v_old public.agents;
  v_new public.agents;
  v_email text;
begin
  if not public.agent_has_role(p_actor_agent_id, 'admin') then
    raise exception 'only admins can move an agent to a different login';
  end if;
  select * into v_old from public.agents where id = p_agent_id for update;
  if not found then
    raise exception 'agent % not found', p_agent_id;
  end if;
  select lower(email) into v_email from auth.users where id = p_new_auth_user_id;
  if v_email is null then
    raise exception 'login % not found', p_new_auth_user_id;
  end if;

  perform set_config('levr.agent_login', 'on', true);
  update public.agents set auth_user_id = p_new_auth_user_id, email = v_email
  where id = p_agent_id returning * into v_new;
  perform set_config('levr.agent_login', 'off', true);

  perform public.log_agent_activity(p_actor_agent_id, 'agent_login_relinked',
    p_details => jsonb_build_object('agent_id', p_agent_id, 'levrid', v_new.levrid,
                                    'from_email', v_old.email, 'to_email', v_new.email,
                                    'from_login', v_old.auth_user_id, 'to_login', v_new.auth_user_id));
  return v_new;
end;
$$;

-- 3. Sign-in attempts (rate limiting) ---------------------------------------------------------
create table public.agent_signin_attempts (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,   -- sha256 of the lowercased email the person typed (never the raw email)
  ip_hash text not null,      -- sha256 of the client IP (never the raw IP)
  succeeded boolean not null,
  stage text not null check (stage in ('password', 'two_factor')),
  created_at timestamptz not null default now()
);
create index agent_signin_attempts_email_idx on public.agent_signin_attempts (email_hash, created_at desc);
create index agent_signin_attempts_ip_idx on public.agent_signin_attempts (ip_hash, created_at desc);
alter table public.agent_signin_attempts enable row level security;
revoke select, insert, update, delete, truncate on public.agent_signin_attempts from anon, authenticated;

-- 4. Activity types ---------------------------------------------------------------------------
insert into public.agent_activity_types (code, label, category) values
  ('agent_invited', 'Invited an agent', 'team'),
  ('agent_two_factor_enrolled', 'Turned on two-factor sign-in', 'team'),
  ('agent_two_factor_reset', 'Reset an agent''s two-factor sign-in', 'team'),
  ('agent_login_relinked', 'Moved an agent to a new login', 'team');

-- 5. Lock down --------------------------------------------------------------------------------
revoke execute on function
  public.is_agent_login(uuid),
  public.link_agent_login(uuid, uuid, uuid),
  public.relink_agent_login(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function
  public.is_agent_login(uuid),
  public.link_agent_login(uuid, uuid, uuid),
  public.relink_agent_login(uuid, uuid, uuid)
to service_role;

commit;
