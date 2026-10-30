-- GX-1 AFTER check (read-only), including the function grant checks. One result set.
with roles(role_name) as (values ('anon'), ('authenticated'), ('service_role'))
select 10 + row_number() over (order by role_name) as n, 'execute guard trigger function / ' || role_name as check_name,
       has_function_privilege(role_name, 'public.customer_searches_guarantee_exception_guard()', 'EXECUTE')::text as actual,
       case when role_name = 'service_role' then 'true' else 'false' end as expected
from roles
union all
select 20 + row_number() over (order by role_name), 'execute record_payment_refund / ' || role_name,
       has_function_privilege(role_name, 'public.record_payment_refund(uuid,uuid,integer,text,text,uuid,text)', 'EXECUTE')::text,
       case when role_name = 'service_role' then 'true' else 'false' end
from roles
union all
select 30, 'PUBLIC can execute either function (should not)',
       (select exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                       where p.oid in ('public.customer_searches_guarantee_exception_guard()'::regprocedure,
                                       'public.record_payment_refund(uuid,uuid,integer,text,text,uuid,text)'::regprocedure)
                         and a.grantee = 0 and a.privilege_type = 'EXECUTE'))::text,
       'false'
union all
select 31, 'guarantee_status allows not_applicable',
       (select (pg_get_constraintdef(oid) like '%not_applicable%')::text from pg_constraint where conname = 'customer_searches_guarantee_status_check'),
       'true'
union all
select 32, 'new columns present', (select count(*)::text from information_schema.columns where table_schema = 'public'
         and ((table_name = 'customer_searches' and column_name = 'guarantee_exception_make')
           or (table_name = 'customers' and column_name in ('terms_accepted_at', 'terms_version')))), '3'
union all
select 33, 'trigger present and enabled', (select (count(*) = 1)::text from pg_trigger where tgname = 'customer_searches_guarantee_exception_guard' and tgenabled = 'O'), 'true'
union all
select 34, 'record_payment_refund has the GX check', (select (prosrc like '%guarantee_not_applicable%')::text from pg_proc
         where oid = 'public.record_payment_refund(uuid,uuid,integer,text,text,uuid,text)'::regprocedure), 'true'
union all
select 35, 'customers can''t write the new columns',
       (has_column_privilege('authenticated', 'public.customer_searches', 'guarantee_exception_make', 'UPDATE')
        or has_column_privilege('authenticated', 'public.customers', 'terms_accepted_at', 'UPDATE')
        or has_column_privilege('anon', 'public.customers', 'terms_accepted_at', 'SELECT'))::text,
       'false'
union all
select 36, 'existing rows unchanged: none not_applicable', (select count(*)::text from public.customer_searches where guarantee_status = 'not_applicable' or guarantee_exception_make is not null), '0'
order by 1;
