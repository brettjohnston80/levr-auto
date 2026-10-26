-- Agent dashboard Phase 1, Step 12c: relink_agent_login can read the new login's email.
-- Plan: docs/plans/agent-dashboard-phase1-code-plan.md (section 7.7; Chunk 1a).
--
-- Why: Step 12's relink_agent_login reads auth.users directly, and the service role (which the
-- app uses) can't read that table, so every call failed with "permission denied for table
-- users". Found 2026-10-12 by Chunk 1a's test (link_agent_login was fine: it only reads
-- auth.users through is_agent_login, which is security definer).
--
-- Fix: a small security-definer helper, agent_login_email(uuid), returns one login's email
-- (lowercased), and relink_agent_login uses it. Same signature (so it replaces in place, no
-- overload); the only change to its body is that one line. Both functions are revoked from
-- public, anon and authenticated; service_role keeps execute.

begin;

create function public.agent_login_email(p_auth_user_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u where u.id = p_auth_user_id;
$$;

create or replace function public.relink_agent_login(
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
  v_email := public.agent_login_email(p_new_auth_user_id);
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


revoke execute on function public.agent_login_email(uuid), public.relink_agent_login(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.agent_login_email(uuid), public.relink_agent_login(uuid, uuid, uuid)
  to service_role;

commit;
