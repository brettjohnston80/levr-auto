-- OE-4 BEFORE check (read-only). One result set.
select * from (values
  (1, 'record_offer_otd exists', coalesce(to_regprocedure('public.record_offer_otd(uuid,uuid,jsonb,integer,boolean)')::text, 'no'), 'no'),
  (2, 'event types today: guarantee_resolved allowed, otd_recorded not yet',
      (select (pg_get_constraintdef(oid) like '%guarantee_resolved%')::text || '/' || (pg_get_constraintdef(oid) like '%otd_recorded%')::text
       from pg_constraint where conname = 'notification_events_event_type_check'), 'true/false'),
  (3, 'activity type offer_otd_recorded', (select count(*)::text from public.agent_activity_types where code = 'offer_otd_recorded'), '1'),
  (4, 'offers with a dealer out-the-door quote', (select count(*)::text from public.qualifying_offers where otd_source is not null), '0'),
  (5, 'persistent test admin (used by the rolled-back test)',
      (select count(*)::text from public.agents where email = 'claude-verify-admin@levrauto-test.invalid' and active), '1')
) as t(n, check_name, actual, expected)
order by n;
