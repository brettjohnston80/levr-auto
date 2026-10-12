-- Agent dashboard Phase 1, Step 12b: an agent login never keeps a customer record.
-- Plan: docs/plans/agent-dashboard-phase1-code-plan.md (section 7.3; Chunk 1a).
--
-- Why: Step 12's check in handle_new_user() never sees the agent flag. Verified 2026-10-12 with a
-- throwaway login created by auth.admin.createUser({ app_metadata: { account_type: 'agent' } }):
-- the login came back with that app_metadata, yet a customers row was created. Supabase Auth
-- inserts the auth.users row with only its own provider metadata, then writes the caller's
-- app_metadata in a separate UPDATE, so the insert trigger can't see it.
--
-- Fix: a second trigger, AFTER UPDATE on auth.users. When a login's app_metadata turns into
-- account_type 'agent', delete its customers row. Only the service role can set app_metadata,
-- so a customer can't trigger this. Safety: if that customers row has a search or a payment,
-- refuse (raise) instead of deleting, so an existing customer can never be silently erased by
-- being marked an agent. A brand-new agent login has neither.
--
-- handle_new_user() from Step 12 is unchanged (its check stays as a harmless backstop). No
-- existing row changes when this runs: it only fires on a future app_metadata change.

begin;

create function public.handle_user_marked_agent()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'account_type', '') = 'agent'
     and coalesce(old.raw_app_meta_data ->> 'account_type', '') <> 'agent'
     and exists (select 1 from public.customers where id = new.id) then
    if exists (select 1 from public.customer_searches where customer_id = new.id)
       or exists (select 1 from public.payments where customer_id = new.id) then
      raise exception 'login % has customer searches or payments; it cannot become an agent login', new.id;
    end if;
    delete from public.customers where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_marked_agent
  after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_user_marked_agent();

revoke execute on function public.handle_user_marked_agent() from public, anon, authenticated;

commit;
