-- LEVRating Phasex B follow-on to the previous migration: revert_purchased_search
-- must clear purchased_qualifying_offer_id alongside purchased_at, mirroring
-- the existing null-out behavior exactly (markSearchPurchased sets both
-- together via a plain JS update, not an RPC, so no migration was needed for
-- that half). Same signature as the existing function, so this replaces it
-- in place rather than creating a new overload.
create or replace function public.revert_purchased_search(
  p_search_id uuid,
  p_agent_id uuid,
  p_reason text
)
returns public.customer_searches
language plpgsql
as $$
declare
  v_search public.customer_searches;
begin
  select * into v_search
  from public.customer_searches
  where id = p_search_id
  for update;

  if not found then
    raise exception 'customer_searches row % not found', p_search_id;
  end if;

  if v_search.search_status <> 'purchased' then
    raise exception 'search % cannot be reverted from status %', p_search_id, v_search.search_status;
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'p_reason is required';
  end if;

  update public.customer_searches
  set search_status = 'searching',
      purchased_at = null,
      purchased_qualifying_offer_id = null
  where id = p_search_id
  returning * into v_search;

  insert into public.purchase_status_log (search_id, agent_id, action, reason)
  values (p_search_id, p_agent_id, 'reverted', p_reason);

  return v_search;
end;
$$;
