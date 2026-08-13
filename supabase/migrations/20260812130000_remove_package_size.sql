-- Eliminates the 3-tier pricing structure ($699/$899/$999 for 1/2/3
-- concurrent makes/models). LEVR Auto is now flat $699 for exactly one
-- vehicle, always — package_size no longer means anything.
alter table public.customer_searches drop column package_size;

-- Redefine switch_customer_search without package_size in the new row's
-- insert (see 20260810120000_switch_customer_search_rpc.sql for the
-- original — this is the same function, just without the dropped column).
create or replace function public.switch_customer_search(
  p_old_search_id uuid,
  p_new_make text,
  p_new_model text
)
returns public.customer_searches
language plpgsql
as $$
declare
  v_old public.customer_searches;
  v_new public.customer_searches;
begin
  select * into v_old
  from public.customer_searches
  where id = p_old_search_id
  for update;

  if not found then
    raise exception 'customer_searches row % not found', p_old_search_id;
  end if;

  if v_old.superseded_by_id is not null or v_old.search_status = 'switched' then
    raise exception 'search % has already been switched', p_old_search_id;
  end if;

  -- trim/colors/required_options deliberately reset to defaults, not copied
  -- from the old row — they're model-specific and may not even apply to the
  -- new make/model. zip carries over: customer-level, not vehicle-specific.
  -- paid_at/solidified_at/guarantee_status stay at column defaults
  -- (null/null/'pending') — this is a fresh, unpaid engagement.
  insert into public.customer_searches (customer_id, make, model, zip)
  values (v_old.customer_id, p_new_make, p_new_model, v_old.zip)
  returning * into v_new;

  update public.customer_searches
  set superseded_by_id = v_new.id,
      search_status = 'switched'
  where id = p_old_search_id;

  return v_new;
end;
$$;
