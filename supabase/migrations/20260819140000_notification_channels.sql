-- Multi-select notification channels + move preferences out of signup.
-- Decided 2026-08-19: communication_channel (single enum) becomes three
-- boolean columns so a customer can pick more than one way to be reached.
-- Backfills existing rows from the current single-channel value before
-- dropping it. communication_frequency is untouched -- stays single-select,
-- just moves where it's collected (account settings, not signup).

alter table public.customers
  add column notify_by_email boolean not null default true,
  add column notify_by_text boolean not null default false,
  add column notify_by_agent_callback boolean not null default false;

update public.customers
set
  notify_by_email = (communication_channel = 'email'),
  notify_by_text = (communication_channel = 'text'),
  notify_by_agent_callback = (communication_channel = 'agent_callback');

alter table public.customers
  drop column communication_channel;

comment on column public.customers.notify_by_email is
  'Multi-select notification channel -- a customer can have any combination of the three notify_by_* columns on. Capture-only for now, same as before -- no sending system reads these yet.';
comment on column public.customers.notify_by_text is
  'See notify_by_email. Requires customers.phone to be set -- enforced in updateAccountSettings, not at the DB layer.';
comment on column public.customers.notify_by_agent_callback is
  'See notify_by_email. Requires customers.phone to be set -- enforced in updateAccountSettings, not at the DB layer.';

-- handle_new_user no longer reads communication_channel/communication_frequency
-- metadata -- neither signup form sends them anymore, both moved to account
-- settings. Column defaults ('real_time', true/false/false) cover every
-- signup path now. full_name/phone still read as before -- phone is now an
-- always-shown, optional field on both signup entry points, not conditional.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.customers (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;
