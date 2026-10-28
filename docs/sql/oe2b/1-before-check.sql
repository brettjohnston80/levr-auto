-- OE-2b BEFORE check (read-only). One result set; compare actual with expected.
select * from (values
  (1, 'send_offer_submission exists', coalesce(to_regprocedure('public.send_offer_submission(uuid,uuid,jsonb)')::text, 'no'), 'no'),
  (2, 'OE-2 tables present', (select count(*)::text from pg_class where relnamespace = 'public'::regnamespace
      and relname in ('offer_submissions', 'dealer_offer_requests', 'dealer_link_attempts')), '3'),
  (3, 'activity types offer_sent and offer_warning_confirmed', (select count(*)::text from public.agent_activity_types
      where code in ('offer_sent', 'offer_warning_confirmed')), '2'),
  (4, 'log_agent_activity(9 args) exists', coalesce(to_regprocedure(
      'public.log_agent_activity(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,jsonb)')::text, 'no'),
      'log_agent_activity(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,jsonb)'),
  (5, 'submissions in the table', (select count(*)::text from public.offer_submissions), '0'),
  (6, 'persistent test admin (used by the rolled-back test)',
      (select count(*)::text from public.agents where email = 'claude-verify-admin@levrauto-test.invalid' and active), '1')
) as t(n, check_name, actual, expected)
order by n;
