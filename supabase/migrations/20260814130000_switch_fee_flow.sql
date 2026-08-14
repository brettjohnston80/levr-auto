-- Backend plumbing for the $100 switch fee / 5-day free-grace-period policy
-- (Core-Processes-v1.md §1b) -- see CLAUDE.md "Pricing Pivot Tracking",
-- Step 3b. Self-service UI and the call-request queue are a separate,
-- later pass -- this migration only adds the columns and RPC change that
-- pass depends on, plus fixes the agent-initiated path's existing gap.
--
-- Three switch entry points share this plumbing: self-service (a customer
-- picks a new make/model from /account -- not built yet), call-request (a
-- customer asks an agent to do it -- not built yet), and the existing
-- agent-initiated path (/internal/outreach, already live).

-- ---------------------------------------------------------------------------
-- customer_searches: pending-switch-payment tracking
-- ---------------------------------------------------------------------------
-- All four columns are nullable and orthogonal to search_status -- no new
-- search_status value is introduced. This mirrors call_requested_at
-- (finalization_flow.sql): a nullable timestamp is the "has this happened"
-- flag, not a state-machine value, so none of the several places that
-- already filter on search_status (the sync scheduler's 'searching' filter,
-- the Day-30 job's deliberate lack of a status filter, the solidify job's
-- 'pending_refinement' filter, the outreach queue's 'searching' filter) need
-- to be audited for a new status they'd need to exclude. The row being
-- switched stays fully live -- still searchable, still collecting offers,
-- guarantee clock still running -- for the entire time a $100 switch payment
-- is outstanding; only the Stripe webhook (on payment success) actually
-- performs the swap.
alter table public.customer_searches
  add column pending_switch_make text,
  add column pending_switch_model text,
  add column switch_requested_at timestamptz,
  add column switch_call_requested_at timestamptz;

comment on column public.customer_searches.pending_switch_make is
  'Display-only: the make a customer selected on a pending (unpaid) $100 '
  'switch request. NOT the source of truth for what the Stripe webhook '
  'actually switches to -- the webhook reads new_make/new_model from the '
  'Checkout Session''s own metadata instead, since a customer could '
  'overwrite this column with a second switch request before an earlier '
  'session''s webhook event lands (Stripe retries/late delivery).';

comment on column public.customer_searches.pending_switch_model is
  'See pending_switch_make -- same display-only caveat.';

comment on column public.customer_searches.switch_requested_at is
  'Set when a $100 switch-fee Checkout Session is created for this search. '
  'Doubles as the "switch pending payment" flag (IS NOT NULL) -- deliberately '
  'not a new search_status value, see migration header comment. Re-requesting '
  '(e.g. after an abandoned Checkout) overwrites this and the pending_switch_* '
  'columns and issues a new Checkout Session.';

comment on column public.customer_searches.switch_call_requested_at is
  'Set when a customer picks "request a call" instead of self-service '
  'switching. Mirrors call_requested_at (finalization_flow.sql) exactly -- '
  'surfaces in /internal/outreach for an agent to follow up manually.';

-- ---------------------------------------------------------------------------
-- customers: free-switch tracking
-- ---------------------------------------------------------------------------
-- One free switch per customer, ever, within 5 days of customers.created_at
-- (already exists, set once at signup -- no separate "signup date" column
-- needed, confirmed during Step 3b discovery). Set by whichever path
-- actually grants the free switch -- self-service-in-grace-window (not
-- built yet) or an agent comping it (switch-actions.ts, this pass) --
-- always as a guarded "set only if null" write, so a customer's SECOND
-- switch (free or paid) never overwrites the timestamp of their first.
alter table public.customers
  add column free_switch_used_at timestamptz;

comment on column public.customers.free_switch_used_at is
  'When this customer''s one free grace-period switch (Core-Processes-v1.md '
  '§1b: within 5 days of created_at, one-time, unadvertised) was consumed. '
  'Null means the free switch is still available (subject to the 5-day '
  'window from created_at). Always written with a guard that only sets it '
  'if currently null -- the earliest-used timestamp is the one that matters, '
  'never overwritten by a later switch.';

-- ---------------------------------------------------------------------------
-- switch_customer_search: add p_paid_at
-- ---------------------------------------------------------------------------
-- Same function as 20260812130000_remove_package_size.sql, plus one new
-- parameter. Fixes a real gap found during Step 3b discovery: the new row's
-- paid_at previously always landed at its column default (null), regardless
-- of when/why the switch ran -- so a customer who just paid a $100 switch
-- fee (or had it comped free) would still hit /finalize's `if (!paid_at)
-- redirect("/")` guard and be told to pay $699 again, which contradicts the
-- entire point of the switch fee (Core-Processes-v1.md §1b: $100 "starts a
-- new engagement," not a second full payment).
--
-- p_paid_at defaults to null so any caller that doesn't pass it keeps
-- today's exact behavior. All current/planned callers pass now():
-- switch-actions.ts's agent-initiated path (this migration's paired code
-- change) and the Stripe webhook's switch_fee branch (same pass) both pass
-- p_paid_at := now(); the not-yet-built free self-service path will too.
create or replace function public.switch_customer_search(
  p_old_search_id uuid,
  p_new_make text,
  p_new_model text,
  p_paid_at timestamptz default null
)
returns public.customer_searches
language plpgsql
as $$
declare
  v_old public.customer_searches;
  v_new public.customer_searches;
begin
  select * into v_old
  from public.customer_searches
  where id = p_old_search_id
  for update;

  if not found then
    raise exception 'customer_searches row % not found', p_old_search_id;
  end if;

  if v_old.superseded_by_id is not null or v_old.search_status = 'switched' then
    raise exception 'search % has already been switched', p_old_search_id;
  end if;

  -- trim/colors/required_options deliberately reset to defaults, not copied
  -- from the old row — they're model-specific and may not even apply to the
  -- new make/model. zip carries over: customer-level, not vehicle-specific.
  -- solidified_at/guarantee_status stay at column defaults (null/'pending')
  -- — this is a fresh engagement. paid_at is the one exception: it's set
  -- explicitly via p_paid_at rather than left at its column default, so a
  -- comped or already-paid-for switch reaches /finalize correctly.
  insert into public.customer_searches (customer_id, make, model, zip, paid_at)
  values (v_old.customer_id, p_new_make, p_new_model, v_old.zip, p_paid_at)
  returning * into v_new;

  update public.customer_searches
  set superseded_by_id = v_new.id,
      search_status = 'switched'
  where id = p_old_search_id;

  return v_new;
end;
$$;
