-- Communication preferences, captured at signup per the customer's choice.
-- This migration only captures the data — the actual notification-sending
-- system (texts/emails going out on a real-time or digest cadence) is a
-- separate, later build.
alter table public.customers
  add column communication_frequency text not null default 'real_time'
    check (communication_frequency in ('real_time', 'daily_digest')),
  add column communication_channel text not null default 'email'
    check (communication_channel in ('text', 'email', 'agent_callback'));

comment on column public.customers.communication_frequency is
  'How often the customer wants to hear about new offers/updates. Capture-only for now — no sending system reads this yet.';
comment on column public.customers.communication_channel is
  'How the customer wants to be reached: text, email, or a personal agent who calls them back. Capture-only for now.';

-- The signup trigger (handle_new_user) already reads full_name/phone out of
-- auth.users.raw_user_meta_data; extend it to also read these two, falling
-- back to the column defaults for any signup path that doesn't send them
-- (e.g. the inline quick-signup modal, which stays intentionally minimal).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.customers (id, email, full_name, phone, communication_frequency, communication_channel)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'communication_frequency', 'real_time'),
    coalesce(new.raw_user_meta_data ->> 'communication_channel', 'email')
  );
  return new;
end;
$$;
