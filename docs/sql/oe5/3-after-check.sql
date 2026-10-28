-- OE-5 AFTER check (read-only), including the function grant check. One result set.
with roles(role_name) as (values ('anon'), ('authenticated'), ('service_role'))
select 10 + row_number() over (order by role_name) as n, 'execute withdraw_pending_offer / ' || role_name as check_name,
       has_function_privilege(role_name, 'public.withdraw_pending_offer(uuid,uuid,text,text)', 'EXECUTE')::text as actual,
       case when role_name = 'service_role' then 'true' else 'false' end as expected
from roles
union all
select 20, 'security definer with search_path=public',
       (select p.prosecdef::text || ', ' || coalesce(array_to_string(p.proconfig, ' '), '')
        from pg_proc p where p.oid = 'public.withdraw_pending_offer(uuid,uuid,text,text)'::regprocedure),
       'true, search_path=public'
union all
select 21, 'PUBLIC can execute (should not)',
       (select exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                       where p.oid = 'public.withdraw_pending_offer(uuid,uuid,text,text)'::regprocedure
                         and a.grantee = 0 and a.privilege_type = 'EXECUTE'))::text,
       'false'
union all
select 22, 'activity type offer_withdrawn_pending', (select count(*)::text from public.agent_activity_types where code = 'offer_withdrawn_pending'), '1'
union all
select 23, 'withdrawal_reason_code values allowed',
       (select pg_get_constraintdef(c.oid) like '%car_sold%dealer_pulled%correcting%other%'
        from pg_constraint c where c.conrelid = 'public.qualifying_offers'::regclass and pg_get_constraintdef(c.oid) like '%withdrawal_reason_code%')::text,
       'true'
union all
select 24, 'customers still can''t read the new column (offers are closed to anon and authenticated)',
       (has_column_privilege('anon', 'public.qualifying_offers', 'withdrawal_reason_code', 'SELECT')
        or has_column_privilege('authenticated', 'public.qualifying_offers', 'withdrawal_reason_code', 'SELECT'))::text,
       'false'
order by 1;
