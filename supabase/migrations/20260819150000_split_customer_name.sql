-- Split full_name into first_name/last_name, and stop collecting name at
-- signup entirely -- name is now collected in account settings instead,
-- where both fields are required. Nullable at the DB layer (a fresh
-- signup has neither until they fill out account settings); required
-- enforced in updateAccountSettings, not here.

alter table public.customers
  add column first_name text,
  add column last_name text;

-- Best-effort backfill: split existing full_name on the first space.
-- A single-word name backfills to first_name only, last_name stays null.
update public.customers
set
  first_name = split_part(full_name, ' ', 1),
  last_name = case
    when position(' ' in full_name) > 0
    then trim(substring(full_name from position(' ' in full_name) + 1))
    else null
  end
where full_name is not null and full_name != '';

alter table public.customers
  drop column full_name;

comment on column public.customers.first_name is
  'Collected in account settings, not at signup -- null until a customer fills it in. Required (both first_name and last_name) when submitting updateAccountSettings, not enforced at the DB layer.';
comment on column public.customers.last_name is
  'See first_name.';

-- handle_new_user no longer reads full_name metadata -- neither signup
-- form collects a name anymore, that moved to account settings.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.customers (id, email, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;
