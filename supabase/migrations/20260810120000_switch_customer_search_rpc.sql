-- Change-request logic: switching make/model must never be a silent edit —
-- it creates a new customer_searches row and marks the old one superseded.
-- That's two related writes that must succeed or fail together (an old row
-- marked 'switched' with no valid new row, or a new row nothing points back
-- to, would both be corrupt states), and supabase-js has no multi-statement
-- transaction, so this is a single plpgsql function instead of sequential
-- client calls.
--
-- `for update` locks the old row for the duration of the transaction so two
-- concurrent switch requests on the same search can't both succeed.
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
  -- new make/model. zip and package_size carry over: customer-level, not
  -- vehicle-specific. paid_at/solidified_at/guarantee_status stay at column
  -- defaults (null/null/'pending') — this is a fresh, unpaid engagement.
  insert into public.customer_searches (customer_id, make, model, package_size, zip)
  values (v_old.customer_id, p_new_make, p_new_model, v_old.package_size, v_old.zip)
  returning * into v_new;

  update public.customer_searches
  set superseded_by_id = v_new.id,
      search_status = 'switched'
  where id = p_old_search_id;

  return v_new;
end;
$$;
