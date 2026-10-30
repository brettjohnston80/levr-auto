-- GX-1 BEFORE check (read-only). One result set.
select * from (values
  (1, 'guarantee_status check is the one being replaced',
      (select pg_get_constraintdef(oid) from pg_constraint where conname = 'customer_searches_guarantee_status_check' and conrelid = 'public.customer_searches'::regclass),
      'CHECK ((guarantee_status = ANY (ARRAY[''pending''::text, ''met''::text, ''refunded''::text])))'),
  (2, 'guarantee_status values in use (record them)',
      (select string_agg(guarantee_status || '=' || n, ', ' order by guarantee_status) from (select guarantee_status, count(*) n from public.customer_searches group by 1) t),
      'pending/met/refunded only'),
  (3, 'searches for Tesla, Rivian, Lucid or Polestar',
      (select count(*)::text from public.customer_searches where make in ('Tesla', 'Rivian', 'Lucid', 'Polestar')), '0'),
  (4, 'new columns absent',
      (select count(*)::text from information_schema.columns where table_schema = 'public'
         and ((table_name = 'customer_searches' and column_name = 'guarantee_exception_make')
           or (table_name = 'customers' and column_name in ('terms_accepted_at', 'terms_version')))), '0'),
  (5, 'record_payment_refund is the live version (no GX check yet)',
      (select (prosrc like '%refund_processed%' and prosrc not like '%guarantee_not_applicable%')::text
         from pg_proc where oid = 'public.record_payment_refund(uuid,uuid,integer,text,text,uuid,text)'::regprocedure), 'true'),
  (6, 'trigger name free',
      (select count(*)::text from pg_trigger where tgname = 'customer_searches_guarantee_exception_guard'), '0'),
  (7, 'persistent test admin (used by the rolled-back test)',
      (select count(*)::text from public.agents where email = 'claude-verify-admin@levrauto-test.invalid' and active), '1')
) as t(n, check_name, actual, expected)
order by n;
