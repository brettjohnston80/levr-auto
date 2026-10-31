-- GX-1: guarantee exceptions for direct-sale brands (docs/plans/guarantee-exceptions-plan.md, section 3).
-- APPLIED by Brett 2026-10-30 in the Supabase SQL Editor. His results:
--   BEFORE: all 7 rows as expected (old pending/met/refunded constraint; values in use met=3,
--     pending=8; 0 searches for Tesla/Rivian/Lucid/Polestar; new columns absent; live
--     record_payment_refund; trigger name free; test admin 1).
--   AFTER: all actual = expected (guard trigger function and record_payment_refund: anon false,
--     authenticated false, service_role true; PUBLIC false; not_applicable allowed; 3 new columns;
--     trigger enabled; GX check in record_payment_refund; customers can't write the new columns;
--     0 existing rows not_applicable).
--   ROLLED-BACK TEST: all 16 cases pass.
--
-- ADDITIONS ONLY, plus one function replaced from its live text (additions only):
--   1. customer_searches.guarantee_status may also be 'not_applicable'.
--   2. customer_searches.guarantee_exception_make: the brand the exception applied to, copied from
--      data/guarantee-exceptions.json by the app when the search's brand is set or changed.
--   3. customers.terms_accepted_at / terms_version: the one standard-terms acceptance (section 4).
--   4. A trigger, customer_searches_guarantee_exception_guard:
--      - 'not_applicable' and guarantee_exception_make go together (both set, or neither);
--      - a 'not_applicable' search can't become 'met' or 'refunded' (so neither the Day-30 job nor
--        a hand-written update can resolve one);
--      - it can go back to 'pending' only before the search goes live (solidified_at null), for the
--        free make/model correction from an exception brand to a guaranteed one.
--   5. record_payment_refund() refuses reason 'guarantee' on a 'not_applicable' search
--      (guarantee_not_applicable). Cancellation and goodwill refunds stay possible.
--
-- One change from the plan (approved by Brett 2026-10-30): the plan had the two switch functions set the state.
-- The brand list is a data file the database can't read, so the app sets it in the same places it
-- already sets the brand (payment webhook, undecided pick, correction, switch), right after the
-- switch function creates the new row. The trigger keeps every one of those writes honest.
--
-- Safe with today's live code on main: nothing writes 'not_applicable' or the new columns, every
-- existing row is 'pending', 'met' or 'refunded' with no exception make (both checks pass), and
-- record_payment_refund keeps its signature and behaviour for every other search.
--
-- Grants: no new table. The trigger function: execute revoked from public, anon, authenticated and
-- granted to service_role (a trigger runs whatever the caller's EXECUTE rights). record_payment_refund
-- keeps its grants (re-stated). The new columns follow the tables' existing privileges: customers
-- read their own searches and customer row through RLS, so they can see their own brand and
-- acceptance; nothing customer-side can write them (no insert/update grants to authenticated).
begin;

alter table public.customer_searches drop constraint customer_searches_guarantee_status_check;
alter table public.customer_searches add constraint customer_searches_guarantee_status_check
  check (guarantee_status in ('pending', 'met', 'refunded', 'not_applicable'));

alter table public.customer_searches
  add column guarantee_exception_make text check (char_length(guarantee_exception_make) <= 100);

alter table public.customers
  add column terms_accepted_at timestamptz,
  add column terms_version text check (char_length(terms_version) <= 50),
  add constraint customers_terms_accepted_shape check ((terms_accepted_at is null) = (terms_version is null));

create function public.customer_searches_guarantee_exception_guard() returns trigger
language plpgsql as $$
begin
  if (new.guarantee_status = 'not_applicable') <> (new.guarantee_exception_make is not null) then
    raise exception 'guarantee_exception_mismatch';
  end if;
  if tg_op = 'UPDATE' and old.guarantee_status = 'not_applicable' and new.guarantee_status <> 'not_applicable' then
    if new.guarantee_status <> 'pending' or new.solidified_at is not null then
      raise exception 'guarantee_not_applicable';
    end if;
  end if;
  return new;
end;
$$;

create trigger customer_searches_guarantee_exception_guard
before insert or update of guarantee_status, guarantee_exception_make on public.customer_searches
for each row execute function public.customer_searches_guarantee_exception_guard();

revoke execute on function public.customer_searches_guarantee_exception_guard() from public, anon, authenticated;
grant execute on function public.customer_searches_guarantee_exception_guard() to service_role;

-- From the live text (20261011200000_refunds_without_cancellation.sql); one check added.
create or replace function public.record_payment_refund(
  p_payment_id uuid,
  p_agent_id uuid,
  p_amount_cents integer,
  p_stripe_refund_id text,
  p_reason text,
  p_cancellation_log_id uuid default null,
  p_notes text default null
) returns public.payments
language plpgsql as $$
declare
  v_payment public.payments;
  v_refund_id uuid;
begin
  if not public.agent_has_role(p_agent_id, 'agent') then
    raise exception 'agent % is not an active agent', p_agent_id;
  end if;
  if not exists (select 1 from public.refund_reasons where code = p_reason and is_active) then
    raise exception 'refund reason % is not an active refund reason', p_reason;
  end if;
  if p_reason = 'cancellation' and p_cancellation_log_id is null then
    raise exception 'a cancellation refund needs its cancellation record';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payments row % not found', p_payment_id;
  end if;
  -- GX-1: no guarantee refund on a search the guarantee doesn't apply to.
  if p_reason = 'guarantee' and exists (
    select 1 from public.customer_searches s where s.id = v_payment.search_id and s.guarantee_status = 'not_applicable'
  ) then
    raise exception 'guarantee_not_applicable';
  end if;
  if p_cancellation_log_id is not null and not exists (
    select 1 from public.cancellation_log cl
    join public.customer_searches s on s.id = cl.search_id
    where cl.id = p_cancellation_log_id and s.customer_id = v_payment.customer_id
  ) then
    raise exception 'cancellation record % does not belong to the customer of payment %', p_cancellation_log_id, p_payment_id;
  end if;
  if p_amount_cents <= 0 then
    raise exception 'p_amount_cents must be positive';
  end if;
  if v_payment.refunded_cents + p_amount_cents > v_payment.amount_cents then
    raise exception 'refund of % cents would exceed remaining balance of % cents on payment %',
      p_amount_cents, v_payment.amount_cents - v_payment.refunded_cents, p_payment_id;
  end if;

  update public.payments set refunded_cents = refunded_cents + p_amount_cents
  where id = p_payment_id returning * into v_payment;

  -- The agent is recorded on the refund row itself (Q8), independent of the activity log.
  insert into public.refunds (cancellation_log_id, payment_id, agent_id, amount_cents, stripe_refund_id, reason, notes)
  values (p_cancellation_log_id, p_payment_id, p_agent_id, p_amount_cents, p_stripe_refund_id, p_reason, p_notes)
  returning id into v_refund_id;

  perform public.log_agent_activity(p_agent_id, 'refund_processed', v_payment.search_id, v_payment.customer_id,
    p_refund_id => v_refund_id,
    p_details => jsonb_build_object('amount_cents', p_amount_cents, 'reason', p_reason,
                                    'payment_type', v_payment.payment_type, 'stripe_refund_id', p_stripe_refund_id));
  return v_payment;
end;
$$;

revoke execute on function public.record_payment_refund(uuid, uuid, integer, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_payment_refund(uuid, uuid, integer, text, text, uuid, text) to service_role;

commit;
