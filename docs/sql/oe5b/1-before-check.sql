-- OE-5b BEFORE check (read-only). One result set.
select * from (values
  (1, 'OE-5 three-argument withdraw_pending_offer exists', coalesce(to_regprocedure('public.withdraw_pending_offer(uuid,uuid,text)')::text, 'no'), 'withdraw_pending_offer(uuid,uuid,text)'),
  (2, 'four-argument version exists', coalesce(to_regprocedure('public.withdraw_pending_offer(uuid,uuid,text,text)')::text, 'no'), 'no'),
  (3, 'withdrawal_reason_code column exists',
      (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'qualifying_offers' and column_name = 'withdrawal_reason_code'), '0'),
  (4, 'withdrawn offers today', (select count(*)::text from public.qualifying_offers where status = 'withdrawn'), '0'),
  (5, 'tables where anon or authenticated hold REFERENCES or TRIGGER (record the number)',
      (select count(*)::text from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
         and (has_table_privilege('anon', c.oid, 'REFERENCES') or has_table_privilege('anon', c.oid, 'TRIGGER')
           or has_table_privilege('authenticated', c.oid, 'REFERENCES') or has_table_privilege('authenticated', c.oid, 'TRIGGER'))),
      'more than 0'),
  (6, 'persistent test admin (used by the rolled-back test)',
      (select count(*)::text from public.agents where email = 'claude-verify-admin@levrauto-test.invalid' and active), '1')
) as t(n, check_name, actual, expected)
order by n;
