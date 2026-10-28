-- OE-2b ROLLED-BACK TEST. Run after the migration. One transaction ending in ROLLBACK: nothing is
-- kept (scratch login, customer, search, offers, submissions, activity rows). The scratch login is
-- a test address; the agent is the persistent test admin (never Brett). Each case is its own
-- sub-block, so one refusal can't abort the others. Expected: every row pass = true.
begin;
create temp table oe2b_test (n int, test text, expected text, result text) on commit drop;

do $$
declare
  v_uid uuid := gen_random_uuid();
  v_agent uuid;
  v_off_agent uuid;
  v_search uuid;
  v_sub uuid;
  v_offer uuid;
  v text;
  base jsonb := jsonb_build_object(
    'dealer_name', 'CLAUDE VERIFY OE2B DEALER', 'dealer_contact', 'test@levrauto-test.invalid',
    'vin', '1hgcm82633a004352', 'vehicle_trim', 'LE', 'vehicle_exterior_color', 'Ice Cap',
    'vehicle_interior_color', 'Black Fabric', 'vehicle_model_year', 2026,
    'offer_price_cents', 2810000, 'msrp_cents', 3089500, 'good_until', (current_date + 7)::text,
    'note_to_customer', 'Test note', 'trim_match_confirmed', true,
    'addons', jsonb_build_array(jsonb_build_object('description', 'Nitrogen', 'amount_cents', 19900, 'dealer_says_removable', true)),
    'addons_none_confirmed', false,
    'fees', jsonb_build_array(jsonb_build_object('kind', 'doc_fee', 'amount_cents', 39900),
                              jsonb_build_object('kind', 'title_registration', 'amount_cents', 24400)),
    'other_fees_none_confirmed', true,
    'options', jsonb_build_array(jsonb_build_object('name', 'Cold Weather Package', 'customer_asked_for', true, 'on_the_car', true),
                                 jsonb_build_object('name', 'Mudguards', 'customer_asked_for', false, 'on_the_car', true,
                                                    'sticker_price_cents', 14900, 'install_kind', 'port')),
    'warnings_confirmed', '[]'::jsonb);
begin
  select id into v_agent from public.agents where email = 'claude-verify-admin@levrauto-test.invalid';
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'claude-verify-oe2b-rollback@levrauto-test.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.customer_searches (customer_id, make, model, model_year)
  values (v_uid, 'Toyota', 'Camry', 2026) returning id into v_search;
  -- The search is live for the send cases.
  update public.customer_searches set search_status = 'searching' where id = v_search;

  -- 1-2. Customers' roles can't run it.
  insert into public.offer_submissions (customer_search_id, submission_source, created_by_agent_id)
  values (v_search, 'agent', v_agent) returning id into v_sub;
  begin execute 'set local role anon'; perform public.send_offer_submission(v_sub, v_agent, base); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe2b_test values (1, 'anon runs send_offer_submission', 'refused', v);
  begin execute 'set local role authenticated'; perform public.send_offer_submission(v_sub, v_agent, base); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe2b_test values (2, 'authenticated runs send_offer_submission', 'refused', v);

  -- 3-9. Refusals; each leaves the draft a draft with no offer.
  begin perform public.send_offer_submission(v_sub, v_agent, base || '{"trim_match_confirmed": false}'); v := 'sent';
  exception when others then v := sqlerrm; end;
  insert into oe2b_test values (3, 'trim not confirmed', 'trim_not_confirmed', v);

  begin perform public.send_offer_submission(v_sub, v_agent, base || '{"offer_price_cents": 3089500}'); v := 'sent';
  exception when others then v := sqlerrm; end;
  insert into oe2b_test values (4, 'price at the sticker, warning not ticked', 'above_sticker_unconfirmed', v);

  begin perform public.send_offer_submission(v_sub, v_agent, base || '{"addons_none_confirmed": true}'); v := 'sent';
  exception when others then v := sqlerrm; end;
  insert into oe2b_test values (5, 'add-on rows and "No add-ons" both given', 'addons_contradiction', v);

  begin perform public.send_offer_submission(v_sub, v_agent, base || '{"addons": [], "addons_none_confirmed": false}'); v := 'sent';
  exception when others then v := sqlerrm; end;
  insert into oe2b_test values (6, 'no add-on rows and no "No add-ons"', 'addons_contradiction', v);

  begin perform public.send_offer_submission(v_sub, v_agent, base || '{"other_fees_none_confirmed": false}'); v := 'sent';
  exception when others then v := sqlerrm; end;
  insert into oe2b_test values (7, 'no other fees and no "No other fees"', 'other_fees_contradiction', v);

  begin perform public.send_offer_submission(v_sub, v_agent,
          base || jsonb_build_object('fees', jsonb_build_array(jsonb_build_object('kind', 'other', 'amount_cents', 500)),
                                     'other_fees_none_confirmed', false)); v := 'sent';
  exception when others then v := 'refused'; end;
  insert into oe2b_test values (8, 'a bad line (other fee, no label) refuses the whole send', 'refused', v);

  select (select submission_status from public.offer_submissions where id = v_sub) || '/' ||
         (select count(*) from public.qualifying_offers where customer_search_id = v_search)::text into v;
  insert into oe2b_test values (9, 'after every refusal: still a draft, no offer', 'draft/0', v);

  -- 10. Inactive agent.
  begin
    insert into public.agents (email, name, active) values ('claude-verify-oe2b-off@levrauto-test.invalid', 'CLAUDE VERIFY OFF', false)
    returning id into v_off_agent;
    perform public.send_offer_submission(v_sub, v_off_agent, base); v := 'sent';
  exception when others then v := sqlerrm; end;
  insert into oe2b_test values (10, 'an inactive agent', 'agent_not_active', v);

  -- 11-16. A good send: everything at once.
  begin select public.send_offer_submission(v_sub, v_agent, base) into v_offer; v := 'sent';
  exception when others then v := 'error: ' || sqlerrm; end;
  insert into oe2b_test values (11, 'a good send', 'sent', v);

  select (select submission_status from public.offer_submissions where id = v_sub) || '/' ||
         ((select sent_qualifying_offer_id from public.offer_submissions where id = v_sub) = v_offer)::text || '/' ||
         ((select offer_submission_id from public.qualifying_offers where id = v_offer) = v_sub)::text into v;
  insert into oe2b_test values (12, 'submission sent and the offer points back at it', 'sent/true/true', v);

  select (select count(*) from public.offer_addons where qualifying_offer_id = v_offer) || '/' ||
         (select count(*) from public.offer_fees where qualifying_offer_id = v_offer) || '/' ||
         (select count(*) from public.offer_vehicle_options where qualifying_offer_id = v_offer) into v;
  insert into oe2b_test values (13, 'add-ons/fees/options written', '1/2/2', v);

  select q.offer_source || '/' || q.vin || '/' || (q.otd_requested_at is not null)::text || '/' ||
         (q.otd_source is null)::text || '/' || (q.sent_by_agent_id = v_agent)::text || '/' ||
         (q.delivered_at is null)::text || '/' || q.is_below_msrp::text
    into v from public.qualifying_offers q where q.id = v_offer;
  insert into oe2b_test values (14, 'source, upper-case VIN, out-the-door requested, sent by, not yet delivered, guarantee test',
                                'agent/1HGCM82633A004352/true/true/true/true/true', v);

  set constraints all immediate;
  select count(*)::text into v from public.agent_activity_log
   where qualifying_offer_id = v_offer and action = 'offer_sent' and agent_id = v_agent;
  insert into oe2b_test values (15, 'one offer_sent activity row, by the agent', '1', v);

  begin perform public.send_offer_submission(v_sub, v_agent, base); v := 'sent again';
  exception when others then v := sqlerrm; end;
  insert into oe2b_test values (16, 'sending the same submission twice', 'submission_not_sendable', v);

  -- 17-19. Inactive search, then with the warning ticked; out-the-door recorded.
  update public.customer_searches set search_status = 'paused' where id = v_search;
  insert into public.offer_submissions (customer_search_id, submission_source, created_by_agent_id)
  values (v_search, 'agent', v_agent) returning id into v_sub;
  begin perform public.send_offer_submission(v_sub, v_agent, base); v := 'sent';
  exception when others then v := sqlerrm; end;
  insert into oe2b_test values (17, 'a paused search, warning not ticked', 'search_inactive', v);

  begin select public.send_offer_submission(v_sub, v_agent,
          base || '{"warnings_confirmed": ["inactive_search", "duplicate_vin"], "otd_source": "dealer_quote", "otd_total_cents": 2894200}') into v_offer;
        select q.otd_source || '/' || q.otd_total_cents || '/' || (q.otd_requested_at is null)::text || '/' ||
               array_to_string(q.warnings_confirmed, ',') || '/' || (q.warnings_confirmed_by_agent_id = v_agent)::text
          into v from public.qualifying_offers q where q.id = v_offer;
  exception when others then v := 'error: ' || sqlerrm; end;
  insert into oe2b_test values (18, 'a paused search with the warning ticked, dealer quote recorded',
                                'dealer_quote/2894200/true/inactive_search,duplicate_vin/true', v);

  set constraints all immediate;
  select count(*)::text into v from public.agent_activity_log
   where qualifying_offer_id = v_offer and action = 'offer_warning_confirmed';
  insert into oe2b_test values (19, 'one offer_warning_confirmed row per ticked warning', '2', v);

  -- 20. A discarded submission can't be sent.
  insert into public.offer_submissions (customer_search_id, submission_source, created_by_agent_id, submission_status, discarded_at, discard_reason)
  values (v_search, 'agent', v_agent, 'discarded', now(), 'test') returning id into v_sub;
  begin perform public.send_offer_submission(v_sub, v_agent, base || '{"warnings_confirmed": ["inactive_search"]}'); v := 'sent';
  exception when others then v := sqlerrm; end;
  insert into oe2b_test values (20, 'a discarded submission', 'submission_not_sendable', v);

  -- 21. A dealer's link submission keeps its source on the offer.
  update public.customer_searches set search_status = 'searching' where id = v_search;
  insert into public.offer_submissions (customer_search_id, submission_source, submission_status, submitted_payload, submitted_at)
  values (v_search, 'dealer_link', 'awaiting_review', '{"from":"dealer"}', now()) returning id into v_sub;
  begin select public.send_offer_submission(v_sub, v_agent, base) into v_offer;
        select offer_source || '/' || (select submitted_payload::text from public.offer_submissions where id = v_sub)
          into v from public.qualifying_offers where id = v_offer;
  exception when others then v := 'error: ' || sqlerrm; end;
  insert into oe2b_test values (21, 'a dealer submission: source kept, dealer''s original payload untouched',
                                'dealer_link/{"from": "dealer"}', v);
end $$;

set constraints all immediate;
select n, test, expected, result, (result = expected) as pass from oe2b_test order by n;
rollback;
