-- OE-5 (revised 2026-10-27 for the reason choice): an agent withdraws a pending offer, and
-- every withdrawal (pending, or an accepted offer released) carries a reason code.
-- NOT YET APPLIED. Brett runs it in the SQL Editor; committed with his results.
--
-- ADDITIONS ONLY:
--   1. qualifying_offers.withdrawal_reason_code: 'car_sold' | 'dealer_pulled' | 'correcting' |
--      'other' (nullable; checked only for its values). The guarantee rule (Brett, 2026-10-27)
--      reads it: a withdrawn offer doesn't count, unless it was withdrawn because the car sold,
--      when the existing sold rule applies. "Car sold" also sets vehicle_sold_at.
--      It is NOT required by a constraint yet: today's live "Release this accepted offer" on
--      main writes a withdrawal without one, and a constraint would break it. The new code
--      requires it; a constraint can follow once that code is deployed (OE-5b, after deploy).
--   2. Activity type offer_withdrawn_pending.
--   3. withdraw_pending_offer(offer, agent, reason code, note): pending offers only; "other"
--      needs a note; one transaction. withdrawal_reason keeps the note (or the choice's label),
--      so the existing withdrawn-metadata check is satisfied.
-- Releasing an accepted offer stays withdrawAcceptedOffer in the app (it writes the code too,
-- in the Chunk 9 follow-up). Guarantee logic changes are app code on the branch, planned
-- separately (docs/plans/offer-entry-phase-plan.md, 3.3c); nothing here changes the Day-30 check.
--
-- Refusals (raised as the message): agent_not_active, reason_code_invalid, note_required,
-- offer_not_found, offer_not_pending.
begin;

alter table public.qualifying_offers
  add column withdrawal_reason_code text
    check (withdrawal_reason_code in ('car_sold', 'dealer_pulled', 'correcting', 'other'));

insert into public.agent_activity_types (code, label, category) values
  ('offer_withdrawn_pending', 'Withdrew an offer before the customer accepted', 'offer');

create function public.withdraw_pending_offer(p_offer_id uuid, p_agent_id uuid, p_reason_code text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_offer public.qualifying_offers;
  v_customer uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_label text;
begin
  if not exists (select 1 from public.agents where id = p_agent_id and active) then
    raise exception 'agent_not_active';
  end if;
  v_label := case p_reason_code
    when 'car_sold' then 'Car sold'
    when 'dealer_pulled' then 'Dealer pulled the quote'
    when 'correcting' then 'Correcting the offer'
    when 'other' then 'Other'
  end;
  if v_label is null then raise exception 'reason_code_invalid'; end if;
  if p_reason_code = 'other' and v_note is null then raise exception 'note_required'; end if;

  select * into v_offer from public.qualifying_offers where id = p_offer_id for update;
  if not found then raise exception 'offer_not_found'; end if;
  if v_offer.status <> 'pending' then raise exception 'offer_not_pending'; end if;

  update public.qualifying_offers
     set status = 'withdrawn', withdrawn_at = now(), withdrawn_by_agent_id = p_agent_id,
         withdrawal_reason_code = p_reason_code,
         withdrawal_reason = left(coalesce(v_note, v_label), 500),
         -- "Car sold": the existing sold rule then decides the guarantee (a customer who
         -- responded within 24 hours of delivery doesn't get it counted against them).
         vehicle_sold_at = case when p_reason_code = 'car_sold' then coalesce(vehicle_sold_at, now()) else vehicle_sold_at end
   where id = p_offer_id;

  select customer_id into v_customer from public.customer_searches where id = v_offer.customer_search_id;
  perform public.log_agent_activity(
    p_agent_id, 'offer_withdrawn_pending', v_offer.customer_search_id, v_customer, p_offer_id, v_offer.dealer_alias_id,
    null, null, jsonb_build_object('reason_code', p_reason_code, 'note', v_note));
end $$;

revoke execute on function public.withdraw_pending_offer(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.withdraw_pending_offer(uuid, uuid, text, text) to service_role;

commit;
