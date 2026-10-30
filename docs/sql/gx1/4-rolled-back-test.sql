-- GX-1 ROLLED-BACK TEST. Run after the migration. One transaction ending in ROLLBACK.
-- A scratch login on a test address; the agent is the persistent test admin (never Brett).
-- Expected: every row pass = true.
begin;
create temp table gx1_test (n int, test text, expected text, result text) on commit drop;

do $$
declare
  v_uid uuid := gen_random_uuid();
  v_agent uuid;
  v_tesla uuid; v_toyota uuid; v_live_tesla uuid; v_draft uuid;
  v_pay_tesla uuid; v_pay_toyota uuid;
  v text;
begin
  select id into v_agent from public.agents where email = 'claude-verify-admin@levrauto-test.invalid';
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'claude-verify-gx1-rollback@levrauto-test.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());

  -- An exception search (live 31 days, so the Day-30 query would see it if it were pending) and a normal one.
  insert into public.customer_searches (customer_id, make, model, model_year, search_status, paid_at, finalized_at, solidified_at,
                                        guarantee_status, guarantee_exception_make)
  values (v_uid, 'Tesla', 'Model 3', 2026, 'searching', now() - interval '32 days', now() - interval '32 days', now() - interval '31 days',
          'not_applicable', 'Tesla') returning id into v_live_tesla;
  insert into public.customer_searches (customer_id, make, model, model_year, search_status, paid_at, finalized_at, solidified_at)
  values (v_uid, 'Toyota', 'Camry', 2026, 'searching', now() - interval '32 days', now() - interval '32 days', now() - interval '31 days')
  returning id into v_toyota;

  -- 1-2. A not_applicable search can't be resolved.
  begin update public.customer_searches set guarantee_status = 'met' where id = v_live_tesla; v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (1, 'not_applicable to met (make still set)', 'guarantee_exception_mismatch', v);
  begin update public.customer_searches set guarantee_status = 'refunded', guarantee_exception_make = null where id = v_live_tesla; v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (2, 'not_applicable to refunded (make cleared too)', 'guarantee_not_applicable', v);

  -- 3. Refunds: guarantee refused on the exception search; goodwill works; guarantee still works on a normal search.
  insert into public.payments (customer_id, search_id, payment_type, stripe_payment_intent_id, amount_cents)
  values (v_uid, v_live_tesla, 'search_fee', 'pi_claude_verify_gx1_a', 69900) returning id into v_pay_tesla;
  insert into public.payments (customer_id, search_id, payment_type, stripe_payment_intent_id, amount_cents)
  values (v_uid, v_toyota, 'search_fee', 'pi_claude_verify_gx1_b', 69900) returning id into v_pay_toyota;
  begin perform public.record_payment_refund(v_pay_tesla, v_agent, 69900, 're_claude_verify_gx1_1', 'guarantee'); v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (3, 'guarantee refund on the exception search', 'guarantee_not_applicable', v);
  begin perform public.record_payment_refund(v_pay_tesla, v_agent, 10000, 're_claude_verify_gx1_2', 'goodwill'); v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (4, 'goodwill refund on the exception search', 'allowed', v);
  begin perform public.record_payment_refund(v_pay_toyota, v_agent, 69900, 're_claude_verify_gx1_3', 'guarantee'); v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (5, 'guarantee refund on a normal search (unchanged)', 'allowed', v);

  -- 6. The two go together.
  begin update public.customer_searches set guarantee_status = 'not_applicable' where id = v_toyota; v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (6, 'not_applicable without the make', 'guarantee_exception_mismatch', v);
  begin update public.customer_searches set guarantee_exception_make = 'Toyota' where id = v_toyota; v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (7, 'the make without not_applicable', 'guarantee_exception_mismatch', v);

  -- 8. A normal search still resolves.
  begin update public.customer_searches set guarantee_status = 'met' where id = v_toyota; v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (8, 'normal search to met (unchanged)', 'allowed', v);

  -- 9. The Day-30 job's selection (pending, live 30+ days) never includes the exception search.
  update public.customer_searches set guarantee_status = 'pending' where id = v_toyota;
  select (count(*) filter (where id = v_toyota))::text || '/' || (count(*) filter (where id = v_live_tesla))::text into v
  from public.customer_searches where guarantee_status = 'pending' and solidified_at <= now() - interval '30 days' and id in (v_toyota, v_live_tesla);
  insert into gx1_test values (9, 'Day-30 selection: normal / exception', '1/0', v);

  -- 10-11. Before the search goes live, a correction can move it back to pending; after, it can't.
  insert into public.customer_searches (customer_id, make, model, model_year, paid_at, guarantee_status, guarantee_exception_make)
  values (v_uid, 'Rivian', 'R1S', 2026, now(), 'not_applicable', 'Rivian') returning id into v_draft;
  begin update public.customer_searches set make = 'Ford', model = 'Bronco', guarantee_status = 'pending', guarantee_exception_make = null where id = v_draft; v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (10, 'correction before going live: not_applicable to pending', 'allowed', v);
  begin update public.customer_searches set guarantee_status = 'pending', guarantee_exception_make = null where id = v_live_tesla; v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (11, 'after going live: not_applicable to pending', 'guarantee_not_applicable', v);

  -- 12. A new row (a switch) can start as an exception.
  begin
    insert into public.customer_searches (customer_id, make, model, model_year, guarantee_status, guarantee_exception_make)
    values (v_uid, 'Lucid', 'Air', 2026, 'not_applicable', 'Lucid') returning id into v_tesla; v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (12, 'insert as not_applicable with the make', 'allowed', v);

  -- 13. Terms acceptance: time and version together.
  begin update public.customers set terms_accepted_at = now() where id = v_uid; v := 'allowed';
  exception when check_violation then v := 'refused'; end;
  insert into gx1_test values (13, 'terms time without a version', 'refused', v);
  begin update public.customers set terms_accepted_at = now(), terms_version = '2026-10-interim' where id = v_uid; v := 'allowed';
  exception when others then v := sqlerrm; end;
  insert into gx1_test values (14, 'terms time and version', 'allowed', v);

  -- 15-16. Customers' roles can't run the refund function.
  begin execute 'set local role anon'; perform public.record_payment_refund(v_pay_toyota, v_agent, 1, 're_x', 'goodwill'); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into gx1_test values (15, 'anon runs record_payment_refund', 'refused', v);
  begin execute 'set local role authenticated'; perform public.record_payment_refund(v_pay_toyota, v_agent, 1, 're_x', 'goodwill'); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into gx1_test values (16, 'authenticated runs record_payment_refund', 'refused', v);
end $$;

set constraints all immediate;
select n, test, expected, result,
       result = expected as pass
from gx1_test order by n;
rollback;
