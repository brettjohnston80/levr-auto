-- Configurator options: a fifth availability value, 'unknown' (2026-10-11,
-- Brett).
--
-- When the research leaves an item's availability BLANK on purpose (it
-- couldn't confirm either way), the import used to resolve it to
-- 'unavailable'. In the trim comparison that showed as "—", which reads as
-- "this trim doesn't have it" -- e.g. heated front seats on a 2027 Grand
-- Cherokee Limited Reserve. It is now stored as 'unknown' and shown as
-- "Not confirmed". Like 'unavailable', it is never offered as a customer
-- choice. Other ambiguous source wording ("Unknown", "Unconfirmed"...)
-- still resolves to 'unavailable' -- only a deliberate blank changes.
--
-- The check constraint was declared inline, so its name is looked up
-- rather than assumed.

do $$
declare
  c text;
begin
  select con.conname into c
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname = 'configurator_options'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%availability%'
    and pg_get_constraintdef(con.oid) ilike '%unavailable%'
    and pg_get_constraintdef(con.oid) not ilike '%package_name%';
  if c is null then
    raise exception 'availability check constraint not found on configurator_options';
  end if;
  execute format('alter table public.configurator_options drop constraint %I', c);
end $$;

alter table public.configurator_options
  add constraint configurator_options_availability_check check (availability in (
    'standard', 'standalone', 'package_only', 'unavailable', 'unknown'
  ));

comment on column public.configurator_options.availability is
  'Normalized availability: standard / standalone / package_only / unavailable / unknown. '
  'unknown = the research left it blank on purpose (not confirmed either way); shown to '
  'customers as "Not confirmed", never offered as a choice. availability_raw keeps the '
  'source text verbatim.';
