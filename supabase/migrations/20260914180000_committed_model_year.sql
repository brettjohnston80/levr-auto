-- Model year becomes a real, committed part of the search (2026-09-14).
--
-- ⚠ THIS DELIBERATELY REVERSES A DECISION MADE ON 2026-09-12, and the
-- original reasoning is recorded here rather than discarded so a future
-- session does not "restore" the old behaviour thinking it found a
-- regression. When the Matchmaker handoff was built, matchmaker_model_year
-- was made DISPLAY-ONLY and explicitly never a filter -- specifically so a
-- customer browsing a 2026 Matchmaker card could still finalize a 2027
-- once they saw what real inventory actually held. That flexibility is
-- genuinely being given up here, as a conscious trade, because a search
-- that does not name a model year cannot be matched against inventory
-- precisely and leaves the agent guessing which car to negotiate for.
--
-- WHY A NEW COLUMN RATHER THAN PROMOTING matchmaker_model_year. Every
-- current reader was checked before deciding, and one of them settles it:
-- updateSearchVehicle (finalize-actions.ts) sets matchmaker_model_year to
-- NULL on every free make/model correction. Promoting that column would
-- mean the edit control wipes the required value each time it runs. The
-- column's own comment also states that pricing and guarantee logic never
-- read it -- promotion would silently change that contract everywhere.
-- Keeping them separate leaves matchmaker_model_year as pure provenance
-- ("what Matchmaker showed them"), which stays useful for measuring
-- whether the handoff matches what customers actually commit to.
--
-- NULLABLE ON PURPOSE, FOR NOW. Requiring it is enforced in the
-- application, not here. 6 customer_searches rows exist (5 still live) and
-- ZERO carry a matchmaker_model_year, so there is nothing to back-fill
-- from -- a NOT NULL constraint would need those rows resolved by hand
-- first. That is a small, deliberate follow-up, not something to bundle
-- into this migration and guess at.

alter table public.customer_searches
  add column if not exists model_year smallint;

comment on column public.customer_searches.model_year is
  'The model year the customer committed to, chosen alongside make/model '
  'and enforced from that point on: the finalize trim list is filtered to '
  'it, and a search with no inventory in this year is blocked rather than '
  'allowed to proceed. DISTINCT FROM matchmaker_model_year, which is '
  'display-only provenance of what Matchmaker happened to show them and is '
  'never used as a filter. Nullable only because rows predating '
  '2026-09-14 have no value to back-fill; the application treats it as '
  'required for every new search.';

-- ---------------------------------------------------------------------------
-- switch_customer_search gains the year
-- ---------------------------------------------------------------------------
-- A paid switch creates a NEW customer_searches row. Without the year it
-- would land with model_year null -- i.e. a switched search would be the
-- one way to end up with an uncommitted year, which is exactly the state
-- this whole change exists to remove.
--
-- ⚠ DROPPED EXPLICITLY BEFORE BEING RECREATED, AND THE ORDER MATTERS.
-- Postgres identifies a function by (name, argument types), so a
-- "create or replace" with an extra parameter creates a SECOND overload
-- rather than replacing anything -- both then coexist and any ambiguous
-- call errors instead of resolving. That is not hypothetical here:
-- 20260814150000 exists solely to clean up the same mistake after
-- p_paid_at was added this way. Dropping first means the two signatures
-- can never both be live, even if this migration is only partially
-- applied.
--
-- ⚠ RUN THIS FILE AS A SINGLE TRANSACTION. Between the drop and the
-- create there is no switch function at all; a partial apply would leave
-- switching broken rather than merely un-migrated.
--
-- The signature being dropped is the current live one, confirmed by
-- reading the most recent definition (20260816140000_agent_bypass_log.sql)
-- rather than assuming the original 3-argument shape.
drop function if exists public.switch_customer_search(uuid, text, text, timestamptz, uuid, text, text);

create function public.switch_customer_search(
  p_old_search_id uuid,
  p_new_make text,
  p_new_model text,
  -- Defaulted so this migration alone cannot break the three existing call
  -- sites (switch-actions.ts, switch-self-service-actions.ts, and the
  -- Stripe webhook's switch_fee branch), all of which pass NAMED arguments
  -- and so are unaffected by where this sits in the list. ⚠ ALL THREE MUST
  -- BE UPDATED TO PASS IT -- until they are, a paid or comped switch still
  -- produces a row with a null model_year.
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
  -- from the old row -- they're model-specific and may not even apply to
  -- the new make/model. zip carries over: customer-level, not
  -- vehicle-specific. model_year is the switched-TO year, never the old
  -- row's: the whole point of a switch is a different vehicle.
  insert into public.customer_searches (customer_id, make, model, model_year, zip, paid_at)
  values (v_old.customer_id, p_new_make, p_new_model, p_new_model_year, v_old.zip, p_paid_at)
  returning * into v_new;

  update public.customer_searches
  set superseded_by_id = v_new.id,
      search_status = 'switched'
  where id = p_old_search_id;

  -- Same function call, same transaction as the switch itself -- if this
  -- fails, the whole switch rolls back rather than succeeding unlogged.
  if p_agent_id is not null then
    insert into public.agent_bypass_log (search_id, agent_id, fee_type, reason_category, notes)
    values (p_old_search_id, p_agent_id, 'switch', p_reason_category, p_notes);
  end if;

  return v_new;
end;
$$;
