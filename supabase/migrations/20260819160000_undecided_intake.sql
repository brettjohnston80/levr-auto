alter table public.customer_searches
  alter column make drop not null,
  alter column model drop not null;

comment on column public.customer_searches.make is
  'Nullable as of 2026-08-19 -- a customer can pay and create an account without knowing what vehicle they want yet (the "not sure yet" intake path, saveUndecidedIntakeSearch). Null make/model means an agent needs to run a vehicle consultation call -- see finalizeUndecidedSearch, which sets both together with trim/color/options in one action. Once set, always paired with model in the same write -- never one without the other.';
comment on column public.customer_searches.model is
  'See make.';

-- Real, currently-live bug fix (confirmed via behavioral RLS test,
-- 2026-08-19 -- pg_policies isn't queryable directly in this environment,
-- no psql/Supabase CLI access). This policy was never updated when
-- 20260813180000_finalization_flow.sql changed the search_status column
-- default from 'pending_refinement' to 'awaiting_finalization'. Every real
-- customer intake insert since that migration has been silently rejected
-- by RLS -- verified by attempting the exact insert saveIntakeSearch
-- performs (no explicit search_status) through a real authenticated
-- session: it fails. An explicit 'pending_refinement' insert succeeds; an
-- explicit 'awaiting_finalization' insert fails. This also blocks the new
-- undecided-intake path below, which needs 'awaiting_finalization' (the
-- current default) accepted, not 'pending_refinement'.
drop policy "Customers can create their own pending searches" on public.customer_searches;

create policy "Customers can create their own pending searches"
  on public.customer_searches for insert
  with check (
    auth.uid() = customer_id
    and guarantee_status = 'pending'
    and search_status = 'awaiting_finalization'
    and paid_at is null
  );
