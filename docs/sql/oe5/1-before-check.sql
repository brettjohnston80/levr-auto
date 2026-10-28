-- OE-5 BEFORE check (read-only). One result set.
select * from (values
  (1, 'withdraw_pending_offer exists', coalesce(to_regprocedure('public.withdraw_pending_offer(uuid,uuid,text)')::text, 'no'), 'no'),
  (2, 'activity type offer_withdrawn_pending', (select count(*)::text from public.agent_activity_types where code = 'offer_withdrawn_pending'), '0'),
  (3, 'withdrawn is a legal offer status',
      ((select pg_get_constraintdef(oid) from pg_constraint where conname = 'qualifying_offers_status_check') like '%withdrawn%')::text, 'true'),
  (4, 'withdrawal metadata check present',
      (select count(*)::text from pg_constraint where conname = 'qualifying_offers_withdrawn_requires_metadata'), '1'),
  (5, 'persistent test admin (used by the rolled-back test)',
      (select count(*)::text from public.agents where email = 'claude-verify-admin@levrauto-test.invalid' and active), '1')
) as t(n, check_name, actual, expected)
order by n;
