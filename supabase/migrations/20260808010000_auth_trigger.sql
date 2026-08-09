-- Auto-create a public.customers row whenever someone signs up via Supabase Auth.
--
-- SECURITY DEFINER so the trigger can write to public.customers regardless of
-- RLS (the signing-up user isn't fully "authenticated" as themselves yet at
-- the moment this fires). search_path is pinned to public per Supabase's
-- guidance, to prevent search_path hijacking in a SECURITY DEFINER function.
create function public.handle_new_user()
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
