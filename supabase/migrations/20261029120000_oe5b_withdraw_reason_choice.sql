-- OE-5b: the withdrawal reason choice (Brett, 2026-10-27), on top of OE-5 as applied.
-- APPLIED by Brett 2026-10-29 in the Supabase SQL Editor. His results:
--   BEFORE: all 6 rows as expected (OE-5 three-argument function present; four-argument absent;
--     reason-code column absent; 0 withdrawn offers; 13 tables with anon/authenticated REFERENCES
--     or TRIGGER; test admin 1).
--   AFTER: all actual = expected (4-arg execute anon false, authenticated false, service_role
--     true; PUBLIC false; security definer, search_path=public; three-argument version gone;
--     reason-code values enforced; customers can't read the new column; 0 tables with
--     REFERENCES/TRIGGER; the four kept reads still there).
--   ROLLED-BACK TEST: all 14 cases pass.
--
-- ADDITIONS ONLY, plus one function replaced (nothing on main calls it):
--   1. qualifying_offers.withdrawal_reason_code: 'car_sold' | 'dealer_pulled' | 'correcting' |
--      'other'. Nullable, checked only for its values: today's live "Release this accepted
--      offer" on main writes a withdrawal without one, so requiring it now would break the live
--      site. The branch's code requires it; a constraint follows after the offer-entry deploy
--      (production had 0 withdrawn offers on 2026-10-28).
--   2. withdraw_pending_offer(offer, agent, reason) is replaced by
--      withdraw_pending_offer(offer, agent, reason code, note): "Other" needs a note; "Car sold"
--      sets vehicle_sold_at so the existing sold rule decides the guarantee; withdrawal_reason
--      keeps the note, or the choice's label. The three-argument version is dropped.
--   3. Leftover from the grants lock-down (Brett, 2026-10-27): anon and authenticated lose
--      REFERENCES and TRIGGER on every table in public. Nothing uses them; SELECT, INSERT,
--      UPDATE and DELETE are untouched (zip_coordinates, customers and customer_searches keep
--      their reads).
-- The guarantee change for withdrawn offers is app code on the branch (guarantee.ts); nothing
-- here changes the Day-30 check.
--
-- Refusals (raised as the message): agent_not_active, reason_code_invalid, note_required,
-- offer_not_found, offer_not_pending.
begin;

alter table public.qualifying_offers
  add column withdrawal_reason_code text
    check (withdrawal_reason_code in ('car_sold', 'dealer_pulled', 'correcting', 'other'));

drop function public.withdraw_pending_offer(uuid, uuid, text);

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

revoke references, trigger on all tables in schema public from anon, authenticated;

commit;
