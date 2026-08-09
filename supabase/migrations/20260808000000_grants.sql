-- Explicit privilege grants on the public schema.
--
-- Table-level GRANTs and RLS policies are two separate layers in Postgres —
-- service_role bypasses RLS, but still needs a base GRANT to touch a table at
-- all. Supabase projects normally get this configured automatically via
-- ALTER DEFAULT PRIVILEGES at project creation; this project didn't end up
-- with it (confirmed via "permission denied for table agents" from
-- service_role), so it's set explicitly here instead.
--
-- Broad GRANTs + RLS-as-the-real-gate is the standard, documented Supabase
-- security model: wide open at the SQL privilege layer, restricted by policy.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

grant select on all tables in schema public to anon;

-- Apply the same grants to anything created by future migrations, so this
-- doesn't have to be repeated by hand every time a new table is added.
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on sequences to authenticated;

alter default privileges in schema public
  grant select on tables to anon;
