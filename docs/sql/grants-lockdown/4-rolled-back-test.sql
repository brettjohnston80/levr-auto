-- Rolled-back test for the grants lock-down. Run after the migration (or paste the migration's
-- statements, without begin/commit, at the marked spot to test it first). Everything rolls back.
-- One result set: every access that is still allowed.
begin;
-- (optional: migration statements here)

create temp table t_result(role_name text, table_name text, action text, outcome text);

do $$
declare r text; t text; act text; ok boolean;
begin
  foreach r in array array['anon','authenticated'] loop
    for t in select c.relname from pg_class c
             where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1 loop
      -- A real read as that role (authenticated = a signed-in customer with a made-up id).
      perform set_config('request.jwt.claims',
        '{"sub":"00000000-0000-0000-0000-00000000c0de","role":"' || r || '"}', true);
      begin
        execute 'set local role ' || r;
        execute format('select 1 from public.%I limit 1', t);
        ok := true;
      exception when insufficient_privilege then
        ok := false;
      end;
      reset role;
      insert into t_result values (r, t, 'select', case when ok then 'allowed' else 'refused' end);
      -- Write privileges, checked directly (an actual write would need valid rows).
      foreach act in array array['insert','update','delete','truncate'] loop
        insert into t_result values (r, t, act,
          case when has_table_privilege(r, format('public.%I', t), act) then 'allowed' else 'refused' end);
      end loop;
    end loop;
  end loop;
end $$;

-- Expected after the migration: exactly four rows
--   anon select zip_coordinates
--   authenticated select customer_searches, customers, zip_coordinates
-- Any other row is a failure.
select role_name, table_name, action, outcome from t_result
where outcome <> 'refused'
order by 1, 2, 3;
rollback;
