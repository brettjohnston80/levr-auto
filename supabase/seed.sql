-- Seed data — run once, after the initial schema migration.
-- Edit the email below to your real one before running.

insert into public.agents (name, email)
values ('Brett Johnston', 'bjohnston@levrauto.com')
on conflict (email) do nothing;
