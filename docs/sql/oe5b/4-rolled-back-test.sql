-- OE-5b ROLLED-BACK TEST. Run after the migration. One transaction ending in ROLLBACK.
-- Scratch login on a test address; the agent is the persistent test admin (never Brett).
-- Expected: every row pass = true.
begin;
create temp table oe5b_test (n int, test text, expected text, result text) on commit drop;

do $$
declare
  v_uid uuid := gen_random_uuid();
  v_agent uuid;
  v_off uuid;
  v_search uuid;
  v_a uuid; v_b uuid; v_c uuid; v_acc uuid;
  v text;
begin
  select id into v_agent from public.agents where email = 'claude-verify-admin@levrauto-test.invalid';
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'claude-verify-oe5-rollback@levrauto-test.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.customer_searches (customer_id, make, model, model_year) values (v_uid, 'Toyota', 'Camry', 2026)
  returning id into v_search;
  insert into public.qualifying_offers (customer_search_id, dealer_name, offer_price_cents, msrp_cents, delivered_at)
  values (v_search, 'CLAUDE VERIFY OE5 A', 2810000, 3089500, now()) returning id into v_a;
  insert into public.qualifying_offers (customer_search_id, dealer_name, offer_price_cents, msrp_cents, delivered_at)
  values (v_search, 'CLAUDE VERIFY OE5 B', 2820000, 3089500, now()) returning id into v_b;
  insert into public.qualifying_offers (customer_search_id, dealer_name, offer_price_cents, msrp_cents, delivered_at)
  values (v_search, 'CLAUDE VERIFY OE5 C', 2830000, 3089500, now()) returning id into v_c;
  insert into public.qualifying_offers (customer_search_id, dealer_name, offer_price_cents, msrp_cents, delivered_at, status, customer_responded_at)
  values (v_search, 'CLAUDE VERIFY OE5 D', 2850000, 3089500, now(), 'customer_accepted', now()) returning id into v_acc;

  -- 1-2. Customers' roles can't run it.
  begin execute 'set local role anon'; perform public.withdraw_pending_offer(v_a, v_agent, 'correcting', null); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe5b_test values (1, 'anon runs withdraw_pending_offer', 'refused', v);
  begin execute 'set local role authenticated'; perform public.withdraw_pending_offer(v_a, v_agent, 'correcting', null); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe5b_test values (2, 'authenticated runs withdraw_pending_offer', 'refused', v);

  -- 3-7. Refusals.
  begin perform public.withdraw_pending_offer(v_a, v_agent, 'because', null); v := 'withdrawn';
  exception when others then v := sqlerrm; end;
  insert into oe5b_test values (3, 'an unknown reason', 'reason_code_invalid', v);
  begin perform public.withdraw_pending_offer(v_a, v_agent, 'other', '   '); v := 'withdrawn';
  exception when others then v := sqlerrm; end;
  insert into oe5b_test values (4, '"Other" without a note', 'note_required', v);
  begin perform public.withdraw_pending_offer(v_acc, v_agent, 'correcting', null); v := 'withdrawn';
  exception when others then v := sqlerrm; end;
  insert into oe5b_test values (5, 'an accepted offer (that is a release, not this)', 'offer_not_pending', v);
  begin
    insert into public.agents (email, name, active, in_rotation) values ('claude-verify-oe5-off@levrauto-test.invalid', 'CLAUDE VERIFY OFF', false, false)
    returning id into v_off;
    perform public.withdraw_pending_offer(v_a, v_off, 'correcting', null); v := 'withdrawn';
  exception when others then v := sqlerrm; end;
  insert into oe5b_test values (6, 'an inactive agent', 'agent_not_active', v);
  select status into v from public.qualifying_offers where id = v_a;
  insert into oe5b_test values (7, 'after the refusals the offer is still pending', 'pending', v);

  -- 8-12. Good withdrawals.
  begin perform public.withdraw_pending_offer(v_a, v_agent, 'correcting', null); v := 'withdrawn';
  exception when others then v := 'error: ' || sqlerrm; end;
  select v || '/' || q.withdrawal_reason_code || '/' || q.withdrawal_reason || '/' || (q.vehicle_sold_at is null)::text || '/' || (q.delivered_at is not null)::text
    into v from public.qualifying_offers q where q.id = v_a;
  insert into oe5b_test values (8, '"Correcting the offer": label as the reason, not marked sold, delivered kept',
                               'withdrawn/correcting/Correcting the offer/true/true', v);

  begin perform public.withdraw_pending_offer(v_b, v_agent, 'car_sold', '  Sold to a walk-in  '); v := 'withdrawn';
  exception when others then v := 'error: ' || sqlerrm; end;
  select v || '/' || q.withdrawal_reason_code || '/' || q.withdrawal_reason || '/' || (q.vehicle_sold_at is not null)::text
    into v from public.qualifying_offers q where q.id = v_b;
  insert into oe5b_test values (9, '"Car sold": note kept, vehicle_sold_at set', 'withdrawn/car_sold/Sold to a walk-in/true', v);

  begin perform public.withdraw_pending_offer(v_c, v_agent, 'other', 'Wrong VIN on the quote'); v := 'withdrawn';
  exception when others then v := 'error: ' || sqlerrm; end;
  select v || '/' || q.withdrawal_reason_code || '/' || q.withdrawal_reason into v from public.qualifying_offers q where q.id = v_c;
  insert into oe5b_test values (10, '"Other" with a note', 'withdrawn/other/Wrong VIN on the quote', v);

  set constraints all immediate;
  select count(*)::text into v from public.agent_activity_log where qualifying_offer_id in (v_a, v_b, v_c) and action = 'offer_withdrawn_pending';
  insert into oe5b_test values (11, 'one offer_withdrawn_pending activity row each', '3', v);

  begin perform public.withdraw_pending_offer(v_a, v_agent, 'correcting', null); v := 'withdrawn again';
  exception when others then v := sqlerrm; end;
  insert into oe5b_test values (12, 'withdrawing it a second time', 'offer_not_pending', v);

  -- 13. Today's live release (main) still works: a withdrawal written without a reason code.
  begin update public.qualifying_offers set status = 'withdrawn', withdrawn_at = now(), withdrawn_by_agent_id = v_agent,
          withdrawal_reason = 'Deal fell through' where id = v_acc; v := 'allowed';
  exception when others then v := 'refused: ' || sqlerrm; end;
  insert into oe5b_test values (13, 'the live release path (no reason code) still works', 'allowed', v);

  begin update public.qualifying_offers set withdrawal_reason_code = 'because' where id = v_acc; v := 'allowed';
  exception when check_violation then v := 'refused'; end;
  insert into oe5b_test values (14, 'an unknown reason code on the column', 'refused', v);
end $$;

set constraints all immediate;
select n, test, expected, result, (result = expected) as pass from oe5b_test order by n;
rollback;
