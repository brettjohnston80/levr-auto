-- OE-2 ROLLED-BACK TEST. Run after the migration. One transaction ending in ROLLBACK: nothing is
-- kept (scratch login, customer, search, offer, links, submissions). The scratch login is a test
-- address; the agent is the persistent test admin (never Brett). Each case is its own sub-block.
-- Expected: every row pass = true.
begin;
create temp table oe2_test (n int, test text, expected text, result text) on commit drop;

do $$
declare
  v_uid uuid := gen_random_uuid();
  v_agent uuid;
  v_search uuid;
  v_offer uuid;
  v_sub uuid;
  v_sub2 uuid;
  v text;
begin
  select id into v_agent from public.agents where email = 'claude-verify-admin@levrauto-test.invalid';
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'claude-verify-oe2-rollback@levrauto-test.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.customer_searches (customer_id, make, model, model_year)
  values (v_uid, 'Toyota', 'Camry', 2026) returning id into v_search;
  insert into public.qualifying_offers (customer_search_id, dealer_name, offer_price_cents, msrp_cents)
  values (v_search, 'CLAUDE VERIFY OE2 DEALER', 2810000, 3089500) returning id into v_offer;

  -- Links for the claim cases: good, expired, revoked.
  insert into public.dealer_offer_requests (customer_search_id, created_by_agent_id, token_hash, request_dealer_name, delivery_channel, expires_at)
  values (v_search, v_agent, 'oe2-test-good', 'Test Dealer A', 'copied_link', now() + interval '7 days'),
         (v_search, v_agent, 'oe2-test-old', 'Test Dealer B', 'copied_link', now() - interval '1 minute'),
         (v_search, v_agent, 'oe2-test-cancelled', 'Test Dealer C', 'email', now() + interval '7 days');
  update public.dealer_offer_requests set revoked_at = now(), revoked_by_agent_id = v_agent where token_hash = 'oe2-test-cancelled';

  -- 1-6. Customers' roles can't reach the new tables or the function.
  begin execute 'set local role anon'; perform 1 from public.dealer_offer_requests limit 1; execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe2_test values (1, 'anon reads dealer_offer_requests', 'refused', v);

  begin execute 'set local role authenticated'; perform 1 from public.offer_submissions limit 1; execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe2_test values (2, 'authenticated reads offer_submissions', 'refused', v);

  begin execute 'set local role anon';
        insert into public.dealer_link_attempts (attempt_ip_hash, attempt_outcome) values ('x', 'bad_token');
        execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe2_test values (3, 'anon writes dealer_link_attempts', 'refused', v);

  begin execute 'set local role authenticated';
        execute format('insert into public.offer_submissions (customer_search_id, submission_source) values (%L, %L)', v_search, 'agent');
        execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe2_test values (4, 'authenticated inserts a submission', 'refused', v);

  begin execute 'set local role anon'; perform public.claim_dealer_offer_request('oe2-test-good', '{"x":1}'::jsonb); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe2_test values (5, 'anon runs the claim function', 'refused', v);

  begin execute 'set local role authenticated'; perform public.claim_dealer_offer_request('oe2-test-good', '{"x":1}'::jsonb); execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe2_test values (6, 'authenticated runs the claim function', 'refused', v);

  -- 7. The server's role: write a link and a draft, read them, log an attempt.
  begin execute 'set local role service_role';
        execute format('insert into public.dealer_offer_requests (customer_search_id, created_by_agent_id, token_hash, request_dealer_name, delivery_channel, expires_at) values (%L, %L, %L, %L, %L, now() + interval ''1 day'')',
                       v_search, v_agent, 'oe2-test-service', 'Test Dealer D', 'email');
        execute format('insert into public.offer_submissions (customer_search_id, submission_source, created_by_agent_id) values (%L, %L, %L)', v_search, 'agent', v_agent);
        insert into public.dealer_link_attempts (attempt_ip_hash, attempt_outcome) values ('oe2-test-ip', 'opened');
        perform 1 from public.offer_submissions where customer_search_id = v_search;
        execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe2_test values (7, 'service_role writes and reads links, submissions, attempts', 'allowed', v);

  -- 8. service_role can't delete links (by design: links are cancelled, not deleted).
  begin execute 'set local role service_role'; delete from public.dealer_offer_requests where token_hash = 'oe2-test-service'; execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into oe2_test values (8, 'service_role deletes a link', 'refused', v);

  -- 9-12. The claim function.
  begin select public.claim_dealer_offer_request('oe2-test-good', '{"vin":"TEST"}'::jsonb) into v_sub;
        select submission_status || '/' || submission_source || '/' || (submitted_payload = working_payload)::text into v
          from public.offer_submissions where id = v_sub;
  exception when others then v := 'error: ' || sqlerrm; end;
  insert into oe2_test values (9, 'a good link claims once, as an awaiting-review dealer submission', 'awaiting_review/dealer_link/true', v);

  begin perform public.claim_dealer_offer_request('oe2-test-good', '{"vin":"AGAIN"}'::jsonb); v := 'claimed again';
  exception when others then v := sqlerrm; end;
  insert into oe2_test values (10, 'the same link a second time', 'link_unusable', v);

  begin perform public.claim_dealer_offer_request('oe2-test-old', '{"x":1}'::jsonb); v := 'claimed';
  exception when others then v := sqlerrm; end;
  insert into oe2_test values (11, 'an expired link', 'link_unusable', v);

  begin perform public.claim_dealer_offer_request('oe2-test-cancelled', '{"x":1}'::jsonb); v := 'claimed';
  exception when others then v := sqlerrm; end;
  insert into oe2_test values (12, 'a cancelled link', 'link_unusable', v);

  begin perform public.claim_dealer_offer_request('no-such-token', '{"x":1}'::jsonb); v := 'claimed';
  exception when others then v := sqlerrm; end;
  insert into oe2_test values (13, 'an unknown token', 'link_unusable', v);

  -- 14-19. The rules.
  begin insert into public.dealer_offer_requests (customer_search_id, created_by_agent_id, token_hash, request_dealer_name, delivery_channel, expires_at)
        values (v_search, v_agent, 'oe2-test-10days', 'Test Dealer E', 'email', now() + interval '10 days'); v := 'allowed';
  exception when check_violation then v := 'refused'; end;
  insert into oe2_test values (14, 'a link with a 10-day expiry', 'refused', v);

  begin update public.dealer_offer_requests set revoked_at = now() where token_hash = 'oe2-test-old'; v := 'allowed';
  exception when check_violation then v := 'refused'; end;
  insert into oe2_test values (15, 'cancelling a link without naming the agent', 'refused', v);

  begin insert into public.offer_submissions (customer_search_id, submission_source, submission_status) values (v_search, 'agent', 'sent'); v := 'allowed';
  exception when check_violation then v := 'refused'; end;
  insert into oe2_test values (16, 'a sent submission without an offer', 'refused', v);

  begin insert into public.offer_submissions (customer_search_id, submission_source) values (v_search, 'dealer_link'); v := 'allowed';
  exception when check_violation then v := 'refused'; end;
  insert into oe2_test values (17, 'a dealer submission with no payload', 'refused', v);

  begin update public.qualifying_offers set offer_submission_id = gen_random_uuid() where id = v_offer;
        set constraints all immediate; v := 'allowed';
  exception when foreign_key_violation then v := 'refused'; end;
  insert into oe2_test values (18, 'an offer pointing at a submission that does not exist', 'refused', v);

  -- 19. A sent submission and its offer point at each other; deleting the offer removes the
  --     submission (test resets), but the submission can't be deleted out from under its offer.
  insert into public.offer_submissions (customer_search_id, submission_source, created_by_agent_id)
  values (v_search, 'agent', v_agent) returning id into v_sub2;
  update public.qualifying_offers set offer_submission_id = v_sub2 where id = v_offer;
  update public.offer_submissions set submission_status = 'sent', sent_qualifying_offer_id = v_offer, sent_at = now() where id = v_sub2;
  begin delete from public.offer_submissions where id = v_sub2; set constraints all immediate; v := 'allowed';
  exception when foreign_key_violation then v := 'refused'; end;
  insert into oe2_test values (19, 'deleting a sent submission while its offer exists', 'refused', v);

  begin delete from public.qualifying_offers where id = v_offer; set constraints all immediate;
        select count(*)::text into v from public.offer_submissions where id = v_sub2;
  exception when others then v := 'error: ' || sqlerrm; end;
  insert into oe2_test values (20, 'deleting the offer removes its sent submission (rows left)', '0', v);

  -- 21. Deleting the search removes its links and submissions (test cleanup path).
  begin delete from public.customer_searches where id = v_search; set constraints all immediate;
        select ((select count(*) from public.dealer_offer_requests where customer_search_id = v_search)
              + (select count(*) from public.offer_submissions where customer_search_id = v_search))::text into v;
  exception when others then v := 'error: ' || sqlerrm; end;
  insert into oe2_test values (21, 'deleting the search removes links and submissions (rows left)', '0', v);
end $$;

set constraints all immediate;
select n, test, expected, result, (result = expected) as pass from oe2_test order by n;
rollback;
