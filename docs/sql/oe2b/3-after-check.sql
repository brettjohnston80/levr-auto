-- OE-2b AFTER check (read-only), including the function grant check. One result set.
with roles(role_name) as (values ('anon'), ('authenticated'), ('service_role'))
select 10 + row_number() over (order by role_name) as n, 'execute send_offer_submission / ' || role_name as check_name,
       has_function_privilege(role_name, 'public.send_offer_submission(uuid,uuid,jsonb)', 'EXECUTE')::text as actual,
       case when role_name = 'service_role' then 'true' else 'false' end as expected
from roles
union all
select 20, 'security definer with search_path=public',
       (select p.prosecdef::text || ', ' || coalesce(array_to_string(p.proconfig, ' '), '')
        from pg_proc p where p.oid = 'public.send_offer_submission(uuid,uuid,jsonb)'::regprocedure),
       'true, search_path=public'
union all
select 21, 'PUBLIC can execute (should not)',
       (select exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                       where p.oid = 'public.send_offer_submission(uuid,uuid,jsonb)'::regprocedure
                         and a.grantee = 0 and a.privilege_type = 'EXECUTE'))::text,
       'false'
order by 1;
