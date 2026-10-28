-- OE-2 BEFORE check (read-only). One result set. Expected value in each row's "expected" column.
select * from (values
  (1, 'dealer_offer_requests exists',   coalesce(to_regclass('public.dealer_offer_requests')::text, 'no'), 'no'),
  (2, 'offer_submissions exists',       coalesce(to_regclass('public.offer_submissions')::text, 'no'), 'no'),
  (3, 'dealer_link_attempts exists',    coalesce(to_regclass('public.dealer_link_attempts')::text, 'no'), 'no'),
  (4, 'claim function exists',          coalesce(to_regprocedure('public.claim_dealer_offer_request(text,jsonb)')::text, 'no'), 'no'),
  (5, 'offer_submission_id column type',
      coalesce((select data_type from information_schema.columns
                where table_schema = 'public' and table_name = 'qualifying_offers' and column_name = 'offer_submission_id'), 'missing'), 'uuid'),
  (6, 'offers with offer_submission_id set',
      (select count(*)::text from public.qualifying_offers where offer_submission_id is not null), '0'),
  (7, 'qualifying_offers_submission_fk exists',
      (select count(*)::text from pg_constraint where conname = 'qualifying_offers_submission_fk'), '0'),
  (8, 'set_updated_at() exists',        coalesce(to_regprocedure('public.set_updated_at()')::text, 'no'), 'set_updated_at()'),
  (9, 'persistent test admin (used by the rolled-back test)',
      (select count(*)::text from public.agents where email = 'claude-verify-admin@levrauto-test.invalid'), '1')
) as t(n, check_name, actual, expected)
order by n;
