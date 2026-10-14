-- Agent dashboard Phase 1, Step 14: sign a login out everywhere (for the two-factor reset, Chunk 1e).
-- Plan: docs/plans/agent-dashboard-phase1-code-plan.md (section 7.5).
--
-- Why: deleting an agent's authenticator (auth.admin.mfa.deleteFactor) did NOT end the agent's
-- open session. Verified 2026-10-14 against a throwaway agent: after the reset, the session that
-- had already passed two-factor still loaded agent pages, its token still saying aal2, and it
-- could have enrolled a NEW authenticator without the old one. The app now also refuses any
-- login with no verified authenticator (Chunk 1e code), but the reset must end every session too.
--
-- revoke_login_sessions(p_auth_user_id) deletes every auth.sessions row for that login (each
-- session's refresh tokens and two-factor records go with it, by Supabase's own cascades), plus
-- any refresh token left without a session. Supabase then refuses the session's access token on
-- the next request ("session_not_found"), so the person is signed out everywhere. Returns how many
-- sessions were removed.
--
-- Only the reset calls it (service role). security definer because the service role can't touch
-- the auth schema through the API. Never callable by anon or authenticated.

begin;

create function public.revoke_login_sessions(p_auth_user_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if p_auth_user_id is null then
    raise exception 'a login id is required';
  end if;
  delete from auth.sessions where user_id = p_auth_user_id;
  get diagnostics v_count = row_count;
  delete from auth.refresh_tokens where user_id = p_auth_user_id::text;
  return v_count;
end;
$$;

revoke execute on function public.revoke_login_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_login_sessions(uuid) to service_role;

commit;
