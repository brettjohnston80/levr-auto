-- Read-only. One result set (the editor shows only the last one): every table in public.
-- rls = RLS on; policies = name/role/command/using/with check; anon_* / auth_* = table privileges;
-- col_grants = any column-level grants to anon/authenticated.
select c.relname as table_name,
       c.relrowsecurity as rls,
       coalesce((select string_agg(format('%s [%s %s] using(%s) check(%s)', p.policyname, array_to_string(p.roles, ','), p.cmd,
                 coalesce(p.qual,'-'), coalesce(p.with_check,'-')), ' || ')
                 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname), '') as policies,
       concat_ws(',', case when has_table_privilege('anon', c.oid, 'SELECT') then 'S' end,
                      case when has_table_privilege('anon', c.oid, 'INSERT') then 'I' end,
                      case when has_table_privilege('anon', c.oid, 'UPDATE') then 'U' end,
                      case when has_table_privilege('anon', c.oid, 'DELETE') then 'D' end,
                      case when has_table_privilege('anon', c.oid, 'TRUNCATE') then 'T' end,
                      case when has_table_privilege('anon', c.oid, 'REFERENCES') then 'R' end,
                      case when has_table_privilege('anon', c.oid, 'TRIGGER') then 'G' end) as anon_privs,
       concat_ws(',', case when has_table_privilege('authenticated', c.oid, 'SELECT') then 'S' end,
                      case when has_table_privilege('authenticated', c.oid, 'INSERT') then 'I' end,
                      case when has_table_privilege('authenticated', c.oid, 'UPDATE') then 'U' end,
                      case when has_table_privilege('authenticated', c.oid, 'DELETE') then 'D' end,
                      case when has_table_privilege('authenticated', c.oid, 'TRUNCATE') then 'T' end,
                      case when has_table_privilege('authenticated', c.oid, 'REFERENCES') then 'R' end,
                      case when has_table_privilege('authenticated', c.oid, 'TRIGGER') then 'G' end) as auth_privs,
       concat_ws(',', case when has_table_privilege('service_role', c.oid, 'SELECT') then 'S' end,
                      case when has_table_privilege('service_role', c.oid, 'INSERT') then 'I' end,
                      case when has_table_privilege('service_role', c.oid, 'UPDATE') then 'U' end,
                      case when has_table_privilege('service_role', c.oid, 'DELETE') then 'D' end) as service_privs,
       coalesce((select string_agg(distinct cp.grantee || ':' || cp.privilege_type || '(' || cp.column_name || ')', ' ')
                 from information_schema.column_privileges cp
                 where cp.table_schema = 'public' and cp.table_name = c.relname
                   and cp.grantee in ('anon','authenticated')
                   and not has_table_privilege(cp.grantee, c.oid, cp.privilege_type)), '') as col_grants
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m','f')
order by (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('authenticated', c.oid, 'INSERT')) desc, 1;
