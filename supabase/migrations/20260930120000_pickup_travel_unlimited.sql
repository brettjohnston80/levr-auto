-- Pickup range: "any distance" (fuel-gauge redesign, approved 2026-09-30).
-- Brett runs this in the Supabase SQL Editor for project couiovhducwytlckfgvo,
-- as one transaction (begin/commit), BEFORE the gauge build deploys.
--
-- Adds a fourth pickup_travel_choice, 'unlimited' ("I'd drive any distance"),
-- which like 'prefer_delivery' and 'case_by_case' carries no miles. The miles
-- check (25/50/100/250/500) is unchanged.
--
-- Deploy-order safety: additive. The code live today never writes
-- 'unlimited', and it already reads an unknown choice as "not answered".

begin;

-- The choice check was created inline in 20260926130000, so it's looked up
-- and dropped rather than assumed by name, same as 20260928120000 did.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.customer_searches'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%pickup_travel_choice%'
  loop
    execute format('alter table public.customer_searches drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.customer_searches
  add constraint customer_searches_pickup_travel_choice_check
    check (pickup_travel_choice in ('distance', 'prefer_delivery', 'case_by_case', 'unlimited')),
  add constraint customer_searches_pickup_travel_shape check (
    (pickup_travel_choice = 'distance' and pickup_travel_miles is not null)
    or (pickup_travel_choice in ('prefer_delivery', 'case_by_case', 'unlimited') and pickup_travel_miles is null)
    or (pickup_travel_choice is null and pickup_travel_miles is null)
  );

comment on column public.customer_searches.pickup_travel_choice is
  'Intake answer: ''distance'' (see pickup_travel_miles), ''prefer_delivery'', ''case_by_case'' or ''unlimited'' (any distance, 2026-09-30). Null = never answered (predates 2026-09-26, or undecided intake not yet finalized).';

commit;
