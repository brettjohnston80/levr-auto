-- OE-4 ROLLED-BACK TEST. Run after the migration. One transaction ending in ROLLBACK: nothing is
-- kept. Scratch login on a test address; the agent is the persistent test admin (never Brett).
-- Expected: every row pass = true.
begin;
create temp table oe4_test (n int, test text, expected text, result text) on commit drop;

do $$
declare
  v_uid uuid := gen_random_uuid();
  v_agent uuid;
  v_search uuid;
  v_sub uuid;
  v_offer uuid;
  v_old_offer uuid;
  v text;
  fees jsonb := jsonb_build_array(jsonb_build_object('kind', 'doc_fee', 'amount_cents', 39900),
                                  jsonb_build_object('kind', 'sales_tax', 'amount_cents', 185000),
                                  jsonb_build_object('kind', 'title_registration', 'amount_cents', 24400));
begin
  select id into v_agent from public.agents where email = 'claude-verify-admin@levrauto-test.invalid';
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'claude-verify-oe4-rollback@levrauto-test.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.customer_searches (customer_id, make, model, model_year) values (v_uid, 'Toyota', 'Camry', 2026)
  returning id into v_search;
  update public.customer_searches set search_status = 'searching' where id = v_search;

  -- A sent offer with no out-the-door figure ($28,100 + $149 add-on), through send_offer_submission.
  insert into public.offer_submissions (customer_search_id, submission_source, created_by_agent_id)
  values (v_search, 'agent', v_agent) returning id into v_sub;
  select public.send_offer_submission(v_sub, v_agent, jsonb_build_object(
    'dealer_name', 'CLAUDE VERIFY OE4 DEALER', 'offer_price_cents', 2810000, 'msrp_cents', 3089500,
    'trim_match_confirmed', true, 'addons', jsonb_build_array(jsonb_build_object('description', 'Nitrogen', 'amount_cents', 14900)),
    'addons_none_confirmed', false, 'fees', '[]'::jsonb, 'other_fees_none_confirmed', true,
    'options', '[]'::jsonb, 'warnings_confirmed', '[]'::jsonb)) into v_offer;
  -- An offer logged the old way (never sent through the new flow).
  insert into public.qualifying_offers (customer_search_id, dealer_name, offer_price_cents, msrp_cents)
  values (v_search, 'CLAUDE VERIFY OE4 OLD', 2900000, 3089500) returning id into v_old_offer;

  -- 1-2. Customers' roles can't run it.
  begin execute 'set local role anon'; perform public.record_offer_otd(v_offer, v_agent, fees, 3074200, true); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe4_test values (1, 'anon runs record_offer_otd', 'refused', v);
  begin execute 'set local role authenticated'; perform public.record_offer_otd(v_offer, v_agent, fees, 3074200, true); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe4_test values (2, 'authenticated runs record_offer_otd', 'refused', v);

  -- 3-5. Refusals.
  begin perform public.record_offer_otd(v_offer, v_agent, fees, 3074200 + 200, true); v := 'recorded';
  exception when others then v := sqlerrm; end;
  insert into oe4_test values (3, 'a total $2 off the lines', 'otd_mismatch', v);

  begin perform public.record_offer_otd(v_offer, v_agent, fees, 3074200, false); v := 'recorded';
  exception when others then v := sqlerrm; end;
  insert into oe4_test values (4, 'no other fees and no "No other fees"', 'other_fees_contradiction', v);

  begin perform public.record_offer_otd(v_old_offer, v_agent, fees, 3149300, true); v := 'recorded';
  exception when others then v := sqlerrm; end;
  insert into oe4_test values (5, 'an offer logged the old way', 'offer_not_sent', v);

  select (select count(*) from public.offer_fees where qualifying_offer_id = v_offer)::text || '/' ||
         coalesce((select otd_source from public.qualifying_offers where id = v_offer), 'none') into v;
  insert into oe4_test values (6, 'after the refusals: no fees, no out-the-door', '0/none', v);

  -- 7-9. A good record: $28,100 + $149 + $399 + $1,850 + $244 = $30,742 (within $1: $30,742.50).
  begin perform public.record_offer_otd(v_offer, v_agent, fees, 3074250, true); v := 'recorded';
  exception when others then v := 'error: ' || sqlerrm; end;
  insert into oe4_test values (7, 'a good record, 50 cents off the lines', 'recorded', v);

  select q.otd_source || '/' || q.otd_total_cents || '/' || (q.otd_recorded_by_agent_id = v_agent)::text || '/' ||
         (select count(*) from public.offer_fees where qualifying_offer_id = v_offer)::text || '/' ||
         q.offer_price_cents || '/' || q.msrp_cents
    into v from public.qualifying_offers q where q.id = v_offer;
  insert into oe4_test values (8, 'dealer quote recorded, 3 fee lines, price and sticker unchanged',
                               'dealer_quote/3074250/true/3/2810000/3089500', v);

  set constraints all immediate;
  select count(*)::text into v from public.agent_activity_log where qualifying_offer_id = v_offer and action = 'offer_otd_recorded';
  insert into oe4_test values (9, 'one offer_otd_recorded activity row', '1', v);

  begin perform public.record_offer_otd(v_offer, v_agent, fees, 3074200, true); v := 'recorded again';
  exception when others then v := sqlerrm; end;
  insert into oe4_test values (10, 'recording a second time', 'otd_already_recorded', v);

  -- 11. The new event type is allowed; an unknown one still isn't.
  begin insert into public.notification_events (customer_id, customer_search_id, event_type, event_data)
        values (v_uid, v_search, 'otd_recorded', '{}'::jsonb); v := 'allowed';
  exception when others then v := 'refused: ' || sqlerrm; end;
  insert into oe4_test values (11, 'an otd_recorded notification event', 'allowed', v);
  begin insert into public.notification_events (customer_id, customer_search_id, event_type, event_data)
        values (v_uid, v_search, 'not_a_type', '{}'::jsonb); v := 'allowed';
  exception when check_violation then v := 'refused'; end;
  insert into oe4_test values (12, 'an unknown notification event type', 'refused', v);
end $$;

set constraints all immediate;
select n, test, expected, result, (result = expected) as pass from oe4_test order by n;
rollback;
