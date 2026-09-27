-- Pickup travel range + per-offer pickup/delivery (2026-09-26) -- plan
-- approved (docs/plans/pickup-delivery-plan.md); Brett runs this in the
-- Supabase SQL Editor. Runs AFTER 20260926120000_offer_messages.sql.
--
-- ⚠ RUN THIS FILE AS A SINGLE TRANSACTION (it redefines
-- switch_customer_search in place).
--
-- Deploy-order safety: additive only. deal_progress.delivery_method is left
-- in place (production code still reads/writes it until this build deploys);
-- its values are copied onto the offer here, and a follow-up migration after
-- the deploy re-copies anything written in between and drops it.

-- 1. How far the customer would drive to pick up a car themselves. Search-
--    level, like zip. Nullable: existing searches and the one-click undecided
--    path have no answer; the app requires it for new vehicle-picked intake.
alter table public.customer_searches
  add column pickup_travel_choice text
    check (pickup_travel_choice in ('distance', 'prefer_delivery', 'case_by_case')),
  add column pickup_travel_miles smallint
    check (pickup_travel_miles in (25, 50, 100, 250, 500)),
  add column pickup_travel_set_at timestamptz,
  add constraint customer_searches_pickup_travel_shape check (
    (pickup_travel_choice = 'distance' and pickup_travel_miles is not null)
    or (pickup_travel_choice in ('prefer_delivery', 'case_by_case') and pickup_travel_miles is null)
    or (pickup_travel_choice is null and pickup_travel_miles is null)
  );

comment on column public.customer_searches.pickup_travel_choice is
  'Intake answer: ''distance'' (see pickup_travel_miles), ''prefer_delivery'' or ''case_by_case''. Null = never answered (predates 2026-09-26, or undecided intake not yet finalized).';
comment on column public.customer_searches.pickup_travel_miles is
  'Max miles the customer would drive to pick up, when pickup_travel_choice = ''distance''. Drives the out-of-range flag.';

-- 2. Per-offer pickup vs. delivery. The single source of truth from here on
--    (deal_progress.delivery_method is retired): chosen on any open offer,
--    confirmed at accept, shown in the post-accept panel.
alter table public.qualifying_offers
  add column handoff_method text check (handoff_method in ('pickup', 'delivery')),
  add column handoff_method_set_at timestamptz;

comment on column public.qualifying_offers.handoff_method is
  '''pickup'' = customer would pick it up; ''delivery'' = customer wants a delivery estimate. Null = not chosen yet. Required when accepting.';

-- Carry over existing answers from the retired per-deal field. Idempotent.
update public.qualifying_offers o
set handoff_method = dp.delivery_method,
    handoff_method_set_at = coalesce(dp.updated_at, now())
from public.deal_progress dp
where dp.qualifying_offer_id = o.id
  and dp.delivery_method is not null
  and o.handoff_method is null;

-- 3. switch_customer_search: identical signature and body to
--    20260914180000_committed_model_year.sql, except the travel answer now
--    carries over to the new row like zip does (customer-level, not
--    vehicle-specific). Same signature => create or replace swaps it in place,
--    no second overload.
create or replace function public.switch_customer_search(
  p_old_search_id uuid,
  p_new_make text,
  p_new_model text,
  p_new_model_year smallint default null,
  p_paid_at timestamptz default null,
  p_agent_id uuid default null,
  p_reason_category text default null,
  p_notes text default null
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

  if p_agent_id is not null and p_reason_category is null then
    raise exception 'p_reason_category is required when p_agent_id is provided';
  end if;

  -- trim/colors/required_options deliberately reset to defaults, not copied
  -- from the old row -- they're model-specific. zip and the pickup travel
  -- answer carry over: customer-level, not vehicle-specific. model_year is
  -- the switched-TO year, never the old row's.
  insert into public.customer_searches (
    customer_id, make, model, model_year, zip, paid_at,
    pickup_travel_choice, pickup_travel_miles, pickup_travel_set_at
  )
  values (
    v_old.customer_id, p_new_make, p_new_model, p_new_model_year, v_old.zip, p_paid_at,
    v_old.pickup_travel_choice, v_old.pickup_travel_miles, v_old.pickup_travel_set_at
  )
  returning * into v_new;

  update public.customer_searches
  set superseded_by_id = v_new.id,
      search_status = 'switched'
  where id = p_old_search_id;

  if p_agent_id is not null then
    insert into public.agent_bypass_log (search_id, agent_id, fee_type, reason_category, notes)
    values (p_old_search_id, p_agent_id, 'switch', p_reason_category, p_notes);
  end if;

  return v_new;
end;
$$;
