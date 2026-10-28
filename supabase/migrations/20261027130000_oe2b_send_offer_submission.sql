-- OE-2b: send_offer_submission (offer-entry plan 3.3, Chunk 3).
-- APPLIED by Brett in the SQL Editor, 2026-10-27. Don't run it again.
-- Results: before check 6/6 as expected; after check as expected (execute: anon false,
-- authenticated false, service_role true, PUBLIC false; security definer, search_path=public);
-- rolled-back test 20/21 on the first run. Case 10 was a test problem (its throwaway inactive
-- agent was left in rotation, which agents_deactivated_not_in_rotation refuses); the test was
-- corrected and re-run separately.
--
-- ADDITIONS ONLY: one new function. Nothing in today's live code on main calls it.
--
-- One transaction that turns a draft (or a dealer's awaiting-review submission) into an offer
-- the customer can see: the offer, its add-ons, fees and options, the submission marked sent,
-- and the activity rows. The new-offer email and any document rows are written by the app
-- after this commits, so a failed email never undoes an offer and a half-written offer never
-- emails. log_agent_activity is called as it is today (never fails the caller).
--
-- The search always comes from the submission, never from the payload. Refusals (raised as
-- the exception message, which the app turns into the signed-off wording):
--   agent_not_active, submission_not_found, submission_not_sendable, search_inactive,
--   trim_not_confirmed, above_sticker_unconfirmed, addons_contradiction, other_fees_contradiction.
-- Duplicate-VIN and duplicate-dealer warnings need queries the app already makes; the app
-- refuses those unless ticked, and the ticks are stored here with the rest.
begin;

create function public.send_offer_submission(p_submission_id uuid, p_agent_id uuid, p_offer jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sub public.offer_submissions;
  v_search public.customer_searches;
  v_offer uuid;
  v_warnings text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_offer->'warnings_confirmed', '[]'::jsonb))), '{}');
  v_addons jsonb := coalesce(p_offer->'addons', '[]'::jsonb);
  v_fees jsonb := coalesce(p_offer->'fees', '[]'::jsonb);
  v_options jsonb := coalesce(p_offer->'options', '[]'::jsonb);
  v_price integer := (p_offer->>'offer_price_cents')::integer;
  v_sticker integer := (p_offer->>'msrp_cents')::integer;
  v_otd_source text := nullif(p_offer->>'otd_source', '');
  v_code text;
begin
  if not exists (select 1 from public.agents where id = p_agent_id and active) then
    raise exception 'agent_not_active';
  end if;

  select * into v_sub from public.offer_submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if v_sub.submission_status not in ('draft', 'awaiting_review') then
    raise exception 'submission_not_sendable';
  end if;

  select * into v_search from public.customer_searches where id = v_sub.customer_search_id for update;
  if v_search.search_status <> 'searching' and not ('inactive_search' = any (v_warnings)) then
    raise exception 'search_inactive';
  end if;
  if coalesce((p_offer->>'trim_match_confirmed')::boolean, false) is not true then
    raise exception 'trim_not_confirmed';
  end if;
  if v_price >= v_sticker and not ('above_sticker' = any (v_warnings)) then
    raise exception 'above_sticker_unconfirmed';
  end if;
  if (jsonb_array_length(v_addons) > 0) = coalesce((p_offer->>'addons_none_confirmed')::boolean, false) then
    raise exception 'addons_contradiction';   -- exactly one of: add-on rows, or "No add-ons"
  end if;
  if exists (select 1 from jsonb_array_elements(v_fees) f where f->>'kind' = 'other')
     = coalesce((p_offer->>'other_fees_none_confirmed')::boolean, false) then
    raise exception 'other_fees_contradiction';  -- exactly one of: other-fee rows, or "No other fees"
  end if;

  insert into public.qualifying_offers (
    customer_search_id, offer_source, offer_submission_id, logged_by_agent_id, sent_by_agent_id, sent_to_customer_at,
    dealer_alias_id, listing_id, dealer_name, dealer_contact,
    dealer_street, dealer_city, dealer_state, dealer_zip,
    vin, stock_number, vehicle_trim, vehicle_exterior_color, vehicle_interior_color, vehicle_model_year,
    offer_price_cents, msrp_cents, notes, good_until, note_to_customer,
    delivery_estimate_status, delivery_estimate_cents, delivery_estimate_note,
    delivery_estimate_requested_at, delivery_estimate_requested_by, delivery_estimate_provided_at,
    otd_source, otd_total_cents, otd_recorded_at, otd_recorded_by_agent_id, otd_requested_at,
    addons_none_confirmed, other_fees_none_confirmed, warnings_confirmed, warnings_confirmed_by_agent_id,
    trim_match_confirmed, tax_paid_at_registration)
  values (
    v_sub.customer_search_id,
    v_sub.submission_source,                     -- agent / dealer_link / dealer_account
    v_sub.id, p_agent_id, p_agent_id, now(),
    nullif(p_offer->>'dealer_alias_id', '')::uuid, nullif(p_offer->>'listing_id', '')::uuid,
    p_offer->>'dealer_name', nullif(p_offer->>'dealer_contact', ''),
    nullif(p_offer->>'dealer_street', ''), nullif(p_offer->>'dealer_city', ''),
    nullif(p_offer->>'dealer_state', ''), nullif(p_offer->>'dealer_zip', ''),
    nullif(upper(p_offer->>'vin'), ''), nullif(p_offer->>'stock_number', ''),
    nullif(p_offer->>'vehicle_trim', ''), nullif(p_offer->>'vehicle_exterior_color', ''),
    nullif(p_offer->>'vehicle_interior_color', ''), nullif(p_offer->>'vehicle_model_year', '')::smallint,
    v_price, v_sticker, nullif(p_offer->>'notes', ''),
    nullif(p_offer->>'good_until', '')::date, nullif(p_offer->>'note_to_customer', ''),
    nullif(p_offer->>'delivery_estimate_status', ''), nullif(p_offer->>'delivery_estimate_cents', '')::integer,
    nullif(p_offer->>'delivery_estimate_note', ''),
    case when nullif(p_offer->>'delivery_estimate_status', '') = 'requested' then now() end,
    case when nullif(p_offer->>'delivery_estimate_status', '') = 'requested' then 'agent' end,
    case when nullif(p_offer->>'delivery_estimate_status', '') in ('provided', 'unavailable') then now() end,
    v_otd_source,
    case when v_otd_source is not null then (p_offer->>'otd_total_cents')::integer end,
    case when v_otd_source is not null then now() end,
    case when v_otd_source is not null then p_agent_id end,
    case when v_otd_source is null then now() end,
    coalesce((p_offer->>'addons_none_confirmed')::boolean, false),
    coalesce((p_offer->>'other_fees_none_confirmed')::boolean, false),
    v_warnings,
    case when cardinality(v_warnings) > 0 then p_agent_id end,
    true,
    coalesce((p_offer->>'tax_paid_at_registration')::boolean, false))
  returning id into v_offer;

  insert into public.offer_addons (qualifying_offer_id, description, amount_cents, addon_customer_wanted, addon_dealer_says_removable)
  select v_offer, a->>'description', (a->>'amount_cents')::integer,
         coalesce((a->>'customer_wanted')::boolean, false), (a->>'dealer_says_removable')::boolean
  from jsonb_array_elements(v_addons) a;

  insert into public.offer_fees (qualifying_offer_id, fee_kind, fee_label, fee_amount_cents, fee_note)
  select v_offer, f->>'kind', nullif(f->>'label', ''), (f->>'amount_cents')::integer, nullif(f->>'note', '')
  from jsonb_array_elements(v_fees) f;

  insert into public.offer_vehicle_options (qualifying_offer_id, vehicle_option_name, search_option_selection_id,
                                            customer_asked_for, on_the_car, sticker_price_cents, install_kind)
  select v_offer, o->>'name', nullif(o->>'search_option_selection_id', '')::uuid,
         (o->>'customer_asked_for')::boolean, (o->>'on_the_car')::boolean,
         nullif(o->>'sticker_price_cents', '')::integer, nullif(o->>'install_kind', '')
  from jsonb_array_elements(v_options) o;

  update public.offer_submissions
     set submission_status = 'sent', sent_qualifying_offer_id = v_offer, sent_at = now(),
         reviewed_by_agent_id = p_agent_id, working_payload = p_offer
   where id = v_sub.id;

  perform public.log_agent_activity(
    p_agent_id, 'offer_sent', v_sub.customer_search_id, v_search.customer_id, v_offer,
    nullif(p_offer->>'dealer_alias_id', '')::uuid, null, null,
    jsonb_build_object('submission_id', v_sub.id, 'submission_source', v_sub.submission_source,
                       'dealer_name', p_offer->>'dealer_name', 'offer_price_cents', v_price, 'msrp_cents', v_sticker,
                       'otd_source', v_otd_source, 'addons', jsonb_array_length(v_addons),
                       'fees', jsonb_array_length(v_fees), 'options', jsonb_array_length(v_options),
                       'warnings_confirmed', to_jsonb(v_warnings)));
  foreach v_code in array v_warnings loop
    perform public.log_agent_activity(
      p_agent_id, 'offer_warning_confirmed', v_sub.customer_search_id, v_search.customer_id, v_offer,
      null, null, null, jsonb_build_object('warning', v_code));
  end loop;

  return v_offer;
end $$;

revoke execute on function public.send_offer_submission(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.send_offer_submission(uuid, uuid, jsonb) to service_role;

commit;
