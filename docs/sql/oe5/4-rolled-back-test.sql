-- OE-5 ROLLED-BACK TEST. Run after the migration. One transaction ending in ROLLBACK.
-- Scratch login on a test address; the agent is the persistent test admin (never Brett).
-- Expected: every row pass = true.
begin;
create temp table oe5_test (n int, test text, expected text, result text) on commit drop;

do $$
declare
  v_uid uuid := gen_random_uuid();
  v_agent uuid;
  v_off uuid;
  v_search uuid;
  v_pending uuid;
  v_accepted uuid;
  v text;
begin
  select id into v_agent from public.agents where email = 'claude-verify-admin@levrauto-test.invalid';
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'claude-verify-oe5-rollback@levrauto-test.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.customer_searches (customer_id, make, model, model_year) values (v_uid, 'Toyota', 'Camry', 2026)
  returning id into v_search;
  insert into public.qualifying_offers (customer_search_id, dealer_name, offer_price_cents, msrp_cents, delivered_at)
  values (v_search, 'CLAUDE VERIFY OE5 A', 2810000, 3089500, now()) returning id into v_pending;
  insert into public.qualifying_offers (customer_search_id, dealer_name, offer_price_cents, msrp_cents, delivered_at, status, customer_responded_at)
  values (v_search, 'CLAUDE VERIFY OE5 B', 2850000, 3089500, now(), 'customer_accepted', now()) returning id into v_accepted;

  -- 1-2. Customers' roles can't run it.
  begin execute 'set local role anon'; perform public.withdraw_pending_offer(v_pending, v_agent, 'x'); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe5_test values (1, 'anon runs withdraw_pending_offer', 'refused', v);
  begin execute 'set local role authenticated'; perform public.withdraw_pending_offer(v_pending, v_agent, 'x'); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe5_test values (2, 'authenticated runs withdraw_pending_offer', 'refused', v);

  -- 3-6. Refusals.
  begin perform public.withdraw_pending_offer(v_pending, v_agent, '   '); v := 'withdrawn';
  exception when others then v := sqlerrm; end;
  insert into oe5_test values (3, 'no reason', 'reason_required', v);
  begin perform public.withdraw_pending_offer(v_accepted, v_agent, 'test'); v := 'withdrawn';
  exception when others then v := sqlerrm; end;
  insert into oe5_test values (4, 'an accepted offer (that is a release, not this)', 'offer_not_pending', v);
  begin
    insert into public.agents (email, name, active, in_rotation) values ('claude-verify-oe5-off@levrauto-test.invalid', 'CLAUDE VERIFY OFF', false, false)
    returning id into v_off;
    perform public.withdraw_pending_offer(v_pending, v_off, 'test'); v := 'withdrawn';
  exception when others then v := sqlerrm; end;
  insert into oe5_test values (5, 'an inactive agent', 'agent_not_active', v);
  select status into v from public.qualifying_offers where id = v_pending;
  insert into oe5_test values (6, 'after the refusals the offer is still pending', 'pending', v);

  -- 7-9. A good withdrawal.
  begin perform public.withdraw_pending_offer(v_pending, v_agent, '  Dealer corrected the doc fee  '); v := 'withdrawn';
  exception when others then v := 'error: ' || sqlerrm; end;
  insert into oe5_test values (7, 'a pending offer with a reason', 'withdrawn', v);
  select q.status || '/' || (q.withdrawn_by_agent_id = v_agent)::text || '/' || q.withdrawal_reason || '/' || (q.delivered_at is not null)::text
    into v from public.qualifying_offers q where q.id = v_pending;
  insert into oe5_test values (8, 'withdrawn, by the agent, reason trimmed, delivered_at kept', 'withdrawn/true/Dealer corrected the doc fee/true', v);
  set constraints all immediate;
  select count(*)::text into v from public.agent_activity_log where qualifying_offer_id = v_pending and action = 'offer_withdrawn_pending';
  insert into oe5_test values (9, 'one offer_withdrawn_pending activity row', '1', v);

  begin perform public.withdraw_pending_offer(v_pending, v_agent, 'again'); v := 'withdrawn again';
  exception when others then v := sqlerrm; end;
  insert into oe5_test values (10, 'withdrawing it a second time', 'offer_not_pending', v);
end $$;

set constraints all immediate;
select n, test, expected, result, (result = expected) as pass from oe5_test order by n;
rollback;
