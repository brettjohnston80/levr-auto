-- OE-5: an agent withdraws a pending offer (offer entry; Brett 2026-10-27, for correcting a
-- recorded out-the-door quote and any other offer that's wrong before the customer accepts).
-- APPLIED by Brett in the SQL Editor, 2026-10-27, as written here (the first version, before the
-- withdrawal reason choice). Don't run it again. Results: before check 5/5 as expected; after
-- check as expected (only service_role can execute; PUBLIC false; activity type present);
-- rolled-back test 10/10. The reason choice and the guarantee rule come in OE-5b.
--
-- ADDITIONS ONLY: one activity type and one function. 'withdrawn' is already a legal offer
-- status (initial schema), with its who/when/why columns and the metadata check (2026-09-24).
-- Releasing an ACCEPTED offer stays withdrawAcceptedOffer, unchanged.
--
-- Guarantee: unchanged by this migration. The Day-30 check never reads an offer's status, so a
-- withdrawn offer that was delivered below its sticker still counts today (as a released
-- accepted offer does). Any change to that needs Brett's OK and is its own step.
--
-- Refusals (raised as the message): agent_not_active, reason_required, offer_not_found,
-- offer_not_pending.
begin;

insert into public.agent_activity_types (code, label, category) values
  ('offer_withdrawn_pending', 'Withdrew an offer before the customer accepted', 'offer');

create function public.withdraw_pending_offer(p_offer_id uuid, p_agent_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_offer public.qualifying_offers;
  v_customer uuid;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if not exists (select 1 from public.agents where id = p_agent_id and active) then
    raise exception 'agent_not_active';
  end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  select * into v_offer from public.qualifying_offers where id = p_offer_id for update;
  if not found then raise exception 'offer_not_found'; end if;
  if v_offer.status <> 'pending' then raise exception 'offer_not_pending'; end if;

  update public.qualifying_offers
     set status = 'withdrawn', withdrawn_at = now(), withdrawn_by_agent_id = p_agent_id,
         withdrawal_reason = left(v_reason, 500)
   where id = p_offer_id;

  select customer_id into v_customer from public.customer_searches where id = v_offer.customer_search_id;
  perform public.log_agent_activity(
    p_agent_id, 'offer_withdrawn_pending', v_offer.customer_search_id, v_customer, p_offer_id, v_offer.dealer_alias_id,
    null, null, jsonb_build_object('reason', left(v_reason, 500)));
end $$;

revoke execute on function public.withdraw_pending_offer(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.withdraw_pending_offer(uuid, uuid, text) to service_role;

commit;
