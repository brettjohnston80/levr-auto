-- OE-4 AFTER check (read-only), including the function grant check. One result set.
with roles(role_name) as (values ('anon'), ('authenticated'), ('service_role'))
select 10 + row_number() over (order by role_name) as n, 'execute record_offer_otd / ' || role_name as check_name,
       has_function_privilege(role_name, 'public.record_offer_otd(uuid,uuid,jsonb,integer,boolean)', 'EXECUTE')::text as actual,
       case when role_name = 'service_role' then 'true' else 'false' end as expected
from roles
union all
select 20, 'security definer with search_path=public',
       (select p.prosecdef::text || ', ' || coalesce(array_to_string(p.proconfig, ' '), '')
        from pg_proc p where p.oid = 'public.record_offer_otd(uuid,uuid,jsonb,integer,boolean)'::regprocedure),
       'true, search_path=public'
union all
select 21, 'PUBLIC can execute (should not)',
       (select exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                       where p.oid = 'public.record_offer_otd(uuid,uuid,jsonb,integer,boolean)'::regprocedure
                         and a.grantee = 0 and a.privilege_type = 'EXECUTE'))::text,
       'false'
union all
select 22, 'otd_recorded is an allowed event type',
       ((select pg_get_constraintdef(oid) from pg_constraint where conname = 'notification_events_event_type_check') like '%otd_recorded%')::text,
       'true'
union all
select 23, 'existing notification events still valid (rows failing the new check)',
       (select count(*)::text from public.notification_events where event_type not in
         ('offer_logged','offer_response_recorded','deal_progress_update','search_purchased','offer_withdrawn','guarantee_resolved','otd_recorded')),
       '0'
order by 1;
