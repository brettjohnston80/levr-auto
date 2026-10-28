-- OE-5b AFTER check (read-only), including the function grant check. One result set.
with roles(role_name) as (values ('anon'), ('authenticated'), ('service_role'))
select 10 + row_number() over (order by role_name) as n, 'execute withdraw_pending_offer(4 args) / ' || role_name as check_name,
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
select 22, 'three-argument version gone', coalesce(to_regprocedure('public.withdraw_pending_offer(uuid,uuid,text)')::text, 'gone'), 'gone'
union all
select 23, 'withdrawal_reason_code values allowed',
       (select pg_get_constraintdef(c.oid) like '%car_sold%dealer_pulled%correcting%other%'
        from pg_constraint c where c.conrelid = 'public.qualifying_offers'::regclass and pg_get_constraintdef(c.oid) like '%withdrawal_reason_code%')::text,
       'true'
union all
select 24, 'customers can''t read the new column',
       (has_column_privilege('anon', 'public.qualifying_offers', 'withdrawal_reason_code', 'SELECT')
        or has_column_privilege('authenticated', 'public.qualifying_offers', 'withdrawal_reason_code', 'SELECT'))::text,
       'false'
union all
select 25, 'tables where anon or authenticated hold REFERENCES or TRIGGER',
       (select count(*)::text from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
         and (has_table_privilege('anon', c.oid, 'REFERENCES') or has_table_privilege('anon', c.oid, 'TRIGGER')
           or has_table_privilege('authenticated', c.oid, 'REFERENCES') or has_table_privilege('authenticated', c.oid, 'TRIGGER'))),
       '0'
union all
select 26, 'reads kept: anon zip_coordinates; authenticated customers, customer_searches, zip_coordinates',
       (has_table_privilege('anon', 'public.zip_coordinates', 'SELECT') and has_table_privilege('authenticated', 'public.customers', 'SELECT')
        and has_table_privilege('authenticated', 'public.customer_searches', 'SELECT') and has_table_privilege('authenticated', 'public.zip_coordinates', 'SELECT'))::text,
       'true'
order by 1;
