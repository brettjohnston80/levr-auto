-- OE-2 AFTER check (read-only), including the explicit-grant check. One result set.
-- Privileges are written as letters: S select, I insert, U update, D delete, T truncate,
-- R references, G trigger; '-' means none.
with roles(role_name) as (values ('anon'), ('authenticated'), ('service_role')),
tbl(relname, want_service) as (values
  ('dealer_offer_requests', 'S,I,U'),
  ('offer_submissions',     'S,I,U,D'),
  ('dealer_link_attempts',  'S,I,D')),
privs as (
  select t.relname, r.role_name, t.want_service,
         coalesce(nullif(concat_ws(',',
           case when has_table_privilege(r.role_name, c.oid, 'SELECT') then 'S' end,
           case when has_table_privilege(r.role_name, c.oid, 'INSERT') then 'I' end,
           case when has_table_privilege(r.role_name, c.oid, 'UPDATE') then 'U' end,
           case when has_table_privilege(r.role_name, c.oid, 'DELETE') then 'D' end,
           case when has_table_privilege(r.role_name, c.oid, 'TRUNCATE') then 'T' end,
           case when has_table_privilege(r.role_name, c.oid, 'REFERENCES') then 'R' end,
           case when has_table_privilege(r.role_name, c.oid, 'TRIGGER') then 'G' end), ''), '-') as got
  from tbl t join pg_class c on c.relname = t.relname and c.relnamespace = 'public'::regnamespace
  cross join roles r)
select 10 + row_number() over (order by relname, role_name) as n,
       'grants: ' || relname || ' / ' || role_name as check_name, got as actual,
       case when role_name = 'service_role' then want_service else '-' end as expected
from privs
union all
select 20 + row_number() over (order by r.role_name), 'execute claim function / ' || r.role_name,
       has_function_privilege(r.role_name, 'public.claim_dealer_offer_request(text,jsonb)', 'EXECUTE')::text,
       case when r.role_name = 'service_role' then 'true' else 'false' end
from roles r
union all
select 30 + row_number() over (order by c.relname), 'RLS on, policies: ' || c.relname,
       c.relrowsecurity::text || ', ' || (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname),
       'true, 0'
from pg_class c where c.relnamespace = 'public'::regnamespace
  and c.relname in ('dealer_offer_requests', 'offer_submissions', 'dealer_link_attempts')
union all
select 40, 'claim function is security definer with search_path=public',
       (select p.prosecdef::text || ', ' || coalesce(array_to_string(p.proconfig, ' '), '')
        from pg_proc p where p.oid = 'public.claim_dealer_offer_request(text,jsonb)'::regprocedure),
       'true, search_path=public'
union all
select 41, 'qualifying_offers_submission_fk',
       (select pg_get_constraintdef(oid) from pg_constraint where conname = 'qualifying_offers_submission_fk'),
       'FOREIGN KEY (offer_submission_id) REFERENCES offer_submissions(id)'
union all
select 42, 'sent offer link deletes with its offer',
       (select pg_get_constraintdef(oid) from pg_constraint
        where conrelid = 'public.offer_submissions'::regclass and contype = 'f'
          and pg_get_constraintdef(oid) like '%qualifying_offers%'),
       'FOREIGN KEY (sent_qualifying_offer_id) REFERENCES qualifying_offers(id) ON DELETE CASCADE'
union all
select 43, 'new indexes',
       (select count(*)::text from pg_indexes where schemaname = 'public' and indexname in
         ('dealer_offer_requests_search_idx', 'offer_submissions_review_idx', 'offer_submissions_search_idx', 'dealer_link_attempts_ip_idx')),
       '4'
union all
select 44, 'existing offers untouched (offer_submission_id set)',
       (select count(*)::text from public.qualifying_offers where offer_submission_id is not null), '0'
order by 1;
