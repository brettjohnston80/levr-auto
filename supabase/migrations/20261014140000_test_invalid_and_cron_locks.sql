-- Agent dashboard Phase 1, Step 15: every .invalid customer is a test account, and a lock so the
-- hourly sweep can't overlap itself.
-- Plan: docs/plans/agent-dashboard-phase1-code-plan.md (Chunk 3; section 4).
--
-- 1. is_test_customer() covered only @levrauto-test.invalid and @levrauto.invalid, so a scratch
--    customer on any other .invalid domain (for example @verify.invalid) would have been
--    auto-assigned to a real agent. It now covers every address ending in ".invalid" (an RFC 2606
--    reserved domain that can never be a real customer). Same signature, so it replaces in place;
--    assign_search and reassign_search call it and need no change.
--
-- 2. cron_job_locks: one row per scheduled job. claim_cron_job(job, seconds) takes the lock and
--    returns a run id, or NULL when another run still holds it; release_cron_job(job, run_id) frees
--    it. The lock also expires on its own after `seconds`, so a run that crashes can't block the
--    next one forever. Both locks: RLS with no policies, and every privilege revoked from anon and
--    authenticated; the functions are service-role only.
--
-- No customer-facing change. Nothing in src/ on main calls the new functions.

begin;

-- 1. Test customers --------------------------------------------------------------------------
create or replace function public.is_test_customer(p_customer_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_customer_id
      and lower(u.email) like '%.invalid'
  );
$$;

revoke execute on function public.is_test_customer(uuid) from public, anon, authenticated;
grant execute on function public.is_test_customer(uuid) to service_role;

-- 2. Job locks --------------------------------------------------------------------------------
create table public.cron_job_locks (
  job text primary key,
  run_id uuid not null,
  locked_at timestamptz not null,
  locked_until timestamptz not null
);
comment on table public.cron_job_locks is
  'One row per scheduled job: who holds its lock and until when. Claimed with claim_cron_job(), freed with release_cron_job(); expires on its own at locked_until.';

alter table public.cron_job_locks enable row level security;
revoke select, insert, update, delete, truncate on public.cron_job_locks from anon, authenticated;

-- Takes the job's lock for p_seconds. Returns the new run id, or NULL if another run holds it.
-- Two runs starting at the same moment: the second waits for the first's row, then finds the lock
-- held (locked_until in the future) and gets NULL.
create function public.claim_cron_job(p_job text, p_seconds integer) returns uuid
language plpgsql as $$
declare
  v_run uuid;
begin
  if p_job is null or btrim(p_job) = '' then
    raise exception 'a job name is required';
  end if;
  if p_seconds is null or p_seconds < 1 or p_seconds > 3600 then
    raise exception 'lock length must be between 1 and 3600 seconds';
  end if;

  insert into public.cron_job_locks as l (job, run_id, locked_at, locked_until)
  values (p_job, gen_random_uuid(), now(), now() + make_interval(secs => p_seconds))
  on conflict (job) do update
    set run_id = excluded.run_id, locked_at = excluded.locked_at, locked_until = excluded.locked_until
    where l.locked_until <= now()
  returning l.run_id into v_run;

  return v_run;
end;
$$;

-- Frees the lock, only if this run still holds it. Returns true when it did.
create function public.release_cron_job(p_job text, p_run_id uuid) returns boolean
language plpgsql as $$
declare
  v_done boolean;
begin
  update public.cron_job_locks set locked_until = now()
  where job = p_job and run_id = p_run_id
  returning true into v_done;
  return coalesce(v_done, false);
end;
$$;

revoke execute on function public.claim_cron_job(text, integer), public.release_cron_job(text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_cron_job(text, integer), public.release_cron_job(text, uuid)
  to service_role;

commit;
