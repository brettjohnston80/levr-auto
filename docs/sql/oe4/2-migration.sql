-- OE-4: recording the dealer's out-the-door quote on a sent offer (offer entry, Chunk 9).
-- NOT YET APPLIED. Brett runs it in the SQL Editor; committed with his results.
--
-- ADDITIONS ONLY:
--   1. notification_events' event_type check gains 'otd_recorded' (the "Your out-the-door price
--      from {dealer} is in" email, plan 6.3). Widening a list: every existing row stays valid.
--   2. record_offer_otd(): replaces a sent offer's fee lines, checks the out-the-door total
--      against the lines (within $1), stamps the dealer's quote and writes offer_otd_recorded,
--      in one transaction. It never changes the price or the sticker (a new offer for that).
-- Nothing in today's live code on main writes 'otd_recorded' or calls the function.
-- Refusals (raised as the message): agent_not_active, offer_not_found, offer_not_sent,
-- offer_not_open, otd_already_recorded, other_fees_contradiction, otd_mismatch.
begin;

alter table public.notification_events drop constraint notification_events_event_type_check;
alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in (
    'offer_logged',
    'offer_response_recorded',
    'deal_progress_update',
    'search_purchased',
    'offer_withdrawn',
    'guarantee_resolved',
    'otd_recorded'          -- offer entry: the dealer's out-the-door quote is in (accept unblocked)
  ));

create function public.record_offer_otd(
  p_offer_id uuid, p_agent_id uuid, p_fees jsonb, p_otd_total_cents integer, p_other_fees_none boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_offer public.qualifying_offers;
  v_customer uuid;
  v_fees jsonb := coalesce(p_fees, '[]'::jsonb);
  v_sum bigint;
begin
  if not exists (select 1 from public.agents where id = p_agent_id and active) then
    raise exception 'agent_not_active';
  end if;
  select * into v_offer from public.qualifying_offers where id = p_offer_id for update;
  if not found then raise exception 'offer_not_found'; end if;
  if v_offer.sent_to_customer_at is null then raise exception 'offer_not_sent'; end if;
  if v_offer.status not in ('pending', 'customer_accepted') then raise exception 'offer_not_open'; end if;
  if v_offer.otd_source = 'dealer_quote' then raise exception 'otd_already_recorded'; end if;
  if exists (select 1 from jsonb_array_elements(v_fees) f where f->>'kind' = 'other') = coalesce(p_other_fees_none, false) then
    raise exception 'other_fees_contradiction';
  end if;

  delete from public.offer_fees where qualifying_offer_id = p_offer_id;
  insert into public.offer_fees (qualifying_offer_id, fee_kind, fee_label, fee_amount_cents, fee_note)
  select p_offer_id, f->>'kind', nullif(f->>'label', ''), (f->>'amount_cents')::integer, nullif(f->>'note', '')
  from jsonb_array_elements(v_fees) f;

  -- Price + add-ons + the fees the dealer collects (tax paid at registration is left out).
  select v_offer.offer_price_cents
         + coalesce((select sum(amount_cents) from public.offer_addons where qualifying_offer_id = p_offer_id), 0)
         + coalesce((select sum(fee_amount_cents) from public.offer_fees
                     where qualifying_offer_id = p_offer_id
                       and not (fee_kind = 'sales_tax' and v_offer.tax_paid_at_registration)), 0)
    into v_sum;
  if abs(p_otd_total_cents - v_sum) > 100 then raise exception 'otd_mismatch'; end if;

  update public.qualifying_offers
     set otd_source = 'dealer_quote', otd_total_cents = p_otd_total_cents, otd_recorded_at = now(),
         otd_recorded_by_agent_id = p_agent_id, other_fees_none_confirmed = coalesce(p_other_fees_none, false)
   where id = p_offer_id;

  select customer_id into v_customer from public.customer_searches where id = v_offer.customer_search_id;
  perform public.log_agent_activity(
    p_agent_id, 'offer_otd_recorded', v_offer.customer_search_id, v_customer, p_offer_id, v_offer.dealer_alias_id,
    null, null, jsonb_build_object('otd_total_cents', p_otd_total_cents, 'fees', jsonb_array_length(v_fees)));
end $$;

revoke execute on function public.record_offer_otd(uuid, uuid, jsonb, integer, boolean) from public, anon, authenticated;
grant execute on function public.record_offer_otd(uuid, uuid, jsonb, integer, boolean) to service_role;

commit;
