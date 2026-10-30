-- After check: the same read-only audit as file 1, run after the migration.
-- Expected: anon_privs empty on every table except zip_coordinates (S);
--   auth_privs empty except zip_coordinates, customers, customer_searches (S);
--   service_privs S,I,U,D on every table; no policies left on offer_addons, documents,
--   deal_progress; the customer_searches insert policy gone (its select policy stays);
--   col_grants empty everywhere.
-- (Phase 1 tables and qualifying_offers were already locked and should look the same as before.)
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
