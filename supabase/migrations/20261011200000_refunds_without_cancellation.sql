-- Agent dashboard Phase 1, Step 7: refund reasons, and refunds that don't need a cancellation.
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (section 8.1, and section 10 Step 7).
--
-- What this does:
--   * refund_reasons: lookup (Q15): cancellation, guarantee, goodwill, duplicate_charge, other.
--     Full revoke from anon/authenticated; RLS on, no policies.
--   * refunds: cancellation_log_id becomes optional; new reason (FK to refund_reasons) and notes;
--     a check that a 'cancellation' refund has a cancellation_log_id (other reasons may also have
--     one, e.g. a goodwill refund issued while cancelling); and a
--     unique index on stripe_refund_id so one Stripe refund can never be recorded twice.
--     Existing rows (all cancellation refunds) get reason = 'cancellation'.
--   * record_payment_refund(): the new single writer. Same locking and balance check as
--     record_refund, plus: active agent, active reason, a cancellation refund has its cancellation
--     record, and any cancellation record belongs to the same customer as the payment. The agent is recorded on the refund row itself
--     (Q8); the activity row is written through log_agent_activity (never fails the refund).
--   * record_refund(): SAME signature, now a thin wrapper (reason 'cancellation'), so the deployed
--     cancellation flow (src/lib/agent-cancellation-actions.ts:190) keeps working unchanged.
--
-- Money note: these functions only RECORD a refund after Stripe has already issued it; they never
-- call Stripe. No customer-facing behaviour changes.

create table public.refund_reasons (
  code text primary key,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.refund_reasons enable row level security;
revoke select, insert, update, delete, truncate on public.refund_reasons from anon, authenticated;
insert into public.refund_reasons (code, label) values
  ('cancellation', 'Cancellation'),
  ('guarantee', 'Day-30 guarantee'),
  ('goodwill', 'Goodwill'),
  ('duplicate_charge', 'Duplicate charge'),
  ('other', 'Other');

alter table public.refunds
  alter column cancellation_log_id drop not null,
  add column reason text not null default 'cancellation' references public.refund_reasons (code),
  add column notes text check (notes is null or char_length(notes) <= 2000);
alter table public.refunds alter column reason drop default; -- new rows must say why
-- A cancellation refund must point at its cancellation. Other reasons MAY also point at one: the
-- agent-mediated cancellation flow can issue goodwill or guarantee refunds in the same call, and
-- the reason keeps that distinction for reporting.
alter table public.refunds add constraint refunds_cancellation_reason_needs_record
  check (reason <> 'cancellation' or cancellation_log_id is not null);
create unique index refunds_stripe_refund_id_idx on public.refunds (stripe_refund_id);

create function public.record_payment_refund(
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

-- Same signature as today: the deployed cancellation flow keeps working.
create or replace function public.record_refund(
  p_payment_id uuid,
  p_cancellation_log_id uuid,
  p_agent_id uuid,
  p_amount_cents integer,
  p_stripe_refund_id text
) returns public.payments
language plpgsql as $$
begin
  return public.record_payment_refund(
    p_payment_id, p_agent_id, p_amount_cents, p_stripe_refund_id, 'cancellation', p_cancellation_log_id, null);
end;
$$;

revoke execute on function public.record_payment_refund(uuid, uuid, integer, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_payment_refund(uuid, uuid, integer, text, text, uuid, text) to service_role;
revoke execute on function public.record_refund(uuid, uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.record_refund(uuid, uuid, uuid, integer, text) to service_role;
