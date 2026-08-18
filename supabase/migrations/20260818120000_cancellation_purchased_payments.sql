-- Cancellation & Discretionary Refunds + Purchased celebratory state.
-- Plan approved 2026-08-18 (see plan.md in the repo for the full design
-- writeup and reasoning) -- Part 4 (agent reactivation) was scoped out
-- entirely, not deferred: a cancelled search is final, full stop.
--
-- Two new search_status values ('cancelled', 'purchased') plus three new
-- tables. `closed` is deliberately left alone, still unused -- it was never
-- actually committed as "the purchase signal" (see the roadmap doc's own
-- note flagging this as undecided), so two new, self-documenting values are
-- cleaner than resurrecting an ambiguous one.

-- ---------------------------------------------------------------------------
-- search_status: add 'cancelled' and 'purchased'
-- ---------------------------------------------------------------------------
alter table public.customer_searches
  drop constraint customer_searches_search_status_check;

alter table public.customer_searches
  add constraint customer_searches_search_status_check
  check (search_status in (
    'awaiting_finalization', 'pending_refinement', 'searching', 'paused',
    'closed', 'switched', 'cancelled', 'purchased'
  ));

-- ---------------------------------------------------------------------------
-- customer_searches: new columns
-- ---------------------------------------------------------------------------
alter table public.customer_searches
  add column cancelled_at timestamptz,
  add column cancellation_call_requested_at timestamptz,
  add column purchased_at timestamptz;

comment on column public.customer_searches.cancelled_at is
  'Set once, by cancel_search(), the moment a search is cancelled -- '
  'self-service (no refund, ever) or agent-mediated (may include one or '
  'more refunds, see the refunds table). Final: a cancelled search is never '
  'reopened. No reactivation path exists in this app -- a customer who '
  'wants back in starts a brand-new $699 search.';
comment on column public.customer_searches.cancellation_call_requested_at is
  'Customer chose "talk to an agent about cancelling" instead of (or before) '
  'self-service cancel -- mirrors call_requested_at/switch_call_requested_at '
  'exactly. Surfaces in /internal/outreach for an agent to resolve.';
comment on column public.customer_searches.purchased_at is
  'Set once, by an agent, when a deal actually closes -- no Stripe/deposit '
  'automation drives this yet, purely agent judgment during deal-close. '
  'Flips search_status to purchased, which /account renders as a '
  'celebratory view instead of the normal offer-tracking UI.';

-- ---------------------------------------------------------------------------
-- payments -- one row per successful charge, of any type, ever made
-- against a search. Did not exist before this migration: the original
-- $699 fee only ever had a single, non-overwritten stripe_checkout_session_id
-- column; extension fees shared one column (last_extension_session_id)
-- that gets overwritten on every extension, and isn't even type-consistent
-- (a Checkout Session id for manual extend-now, a PaymentIntent id for
-- auto-renew charges, which never go through Checkout at all); switch fees
-- had no column at all -- handleSwitchFeePayment reads the session, uses it,
-- and discards it. This table is the first place any of these charges are
-- durably, individually recorded. No backfill: there are zero real
-- production customer_searches rows as of this migration (pre-launch), so
-- every payment this table will ever need to represent happens after it
-- exists.
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  search_id uuid not null references public.customer_searches (id),
  payment_type text not null check (payment_type in ('search_fee', 'switch_fee', 'extension_fee')),
  -- Nullable: an auto-renew off-session charge is a direct PaymentIntent,
  -- never a Checkout Session.
  stripe_checkout_session_id text,
  -- Not null: always obtainable, whether from a Checkout Session's
  -- payment_intent field or directly from an off-session PaymentIntent --
  -- this is the id refunds.create() actually needs.
  stripe_payment_intent_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  refunded_cents integer not null default 0
    check (refunded_cents >= 0 and refunded_cents <= amount_cents),
  created_at timestamptz not null default now()
);

comment on table public.payments is
  'One row per successful Stripe charge against a search -- the original '
  '$699 search fee, a $100 switch fee, or a $100 extension fee (manual '
  'extend-now or auto-renew). refunded_cents tracks the running total '
  'refunded so far; amount_cents - refunded_cents is the remaining '
  'refundable balance. Enforced at the DB level via record_refund(), never '
  'just in application code.';
comment on column public.payments.search_id is
  'For payment_type = switch_fee, this is the NEW row the fee unlocked '
  '(mirrors how paid_at already lands on the new row via '
  'switch_customer_search''s p_paid_at, not the old/superseded row).';

create index payments_customer_id_idx on public.payments (customer_id);
create index payments_search_id_idx on public.payments (search_id);

alter table public.payments enable row level security;
-- No policies -- service_role only, same convention as every other
-- internal-only table in this schema (agents, listings, agent_bypass_log).

-- ---------------------------------------------------------------------------
-- cancellation_log -- one row per cancellation, self-service or
-- agent-mediated. The single source of truth for "how/why did this search
-- end" -- self-service cancellations get a row here too (no refund, no
-- agent), not just agent-mediated ones, so this table alone answers the
-- question for every cancelled search.
-- ---------------------------------------------------------------------------
create table public.cancellation_log (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.customer_searches (id),
  initiated_by text not null check (initiated_by in ('customer', 'agent')),
  agent_id uuid references public.agents (id),
  reason_category text,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.cancellation_log is
  'Audit trail for every cancellation, self-service or agent-mediated. '
  'agent_id/reason_category are null for a customer-initiated (self-service, '
  'always no-refund) cancellation. Any refunds tied to an agent-mediated '
  'cancellation are separate rows in the refunds table, linked back via '
  'cancellation_log_id.';

create index cancellation_log_search_id_idx on public.cancellation_log (search_id);

alter table public.cancellation_log enable row level security;
-- No policies -- service_role only.

-- ---------------------------------------------------------------------------
-- refunds -- one row per actual Stripe refund issued. Decoupled from
-- cancellation_log so a single cancellation can refund against zero, one,
-- or several different payments (e.g. partial amounts against both the
-- original fee and an extension fee in the same call).
-- ---------------------------------------------------------------------------
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  cancellation_log_id uuid not null references public.cancellation_log (id),
  payment_id uuid not null references public.payments (id),
  agent_id uuid not null references public.agents (id),
  amount_cents integer not null check (amount_cents > 0),
  stripe_refund_id text not null,
  created_at timestamptz not null default now()
);

comment on table public.refunds is
  'One row per real Stripe refund actually issued, always tied back to the '
  'cancellation_log row that authorized it and the specific payments row it '
  'was refunded against. Written only by record_refund(), which enforces '
  '(atomically, FOR UPDATE-locked) that the sum of refunds against a given '
  'payment can never exceed what was actually charged.';

create index refunds_cancellation_log_id_idx on public.refunds (cancellation_log_id);
create index refunds_payment_id_idx on public.refunds (payment_id);

alter table public.refunds enable row level security;
-- No policies -- service_role only.

-- ---------------------------------------------------------------------------
-- cancel_search: used by both self-service (Part 1) and agent-mediated
-- (Part 2) cancellation -- same shape as switch_customer_search serving both
-- a plain and an agent-flavored caller via optional trailing params.
-- ---------------------------------------------------------------------------
create function public.cancel_search(
  p_search_id uuid,
  p_initiated_by text,
  p_agent_id uuid default null,
  p_reason_category text default null,
  p_notes text default null
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

  if v_search.search_status not in ('awaiting_finalization', 'pending_refinement', 'searching', 'paused') then
    raise exception 'search % cannot be cancelled from status %', p_search_id, v_search.search_status;
  end if;

  if p_initiated_by not in ('customer', 'agent') then
    raise exception 'p_initiated_by must be customer or agent';
  end if;

  if p_initiated_by = 'agent' and (p_agent_id is null or p_reason_category is null) then
    raise exception 'p_agent_id and p_reason_category are required when p_initiated_by is agent';
  end if;

  update public.customer_searches
  set search_status = 'cancelled',
      cancelled_at = now()
  where id = p_search_id
  returning * into v_search;

  insert into public.cancellation_log (search_id, initiated_by, agent_id, reason_category, notes)
  values (p_search_id, p_initiated_by, p_agent_id, p_reason_category, p_notes);

  return v_search;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_refund: the sole write path for the refunds table. Always called
-- AFTER the real Stripe refund for this specific payment already succeeded
-- (Postgres can't call Stripe) -- this just durably records it, atomically
-- enforcing the remaining-balance guarantee.
-- ---------------------------------------------------------------------------
create function public.record_refund(
  p_payment_id uuid,
  p_cancellation_log_id uuid,
  p_agent_id uuid,
  p_amount_cents integer,
  p_stripe_refund_id text
)
returns public.payments
language plpgsql
as $$
declare
  v_payment public.payments;
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payments row % not found', p_payment_id;
  end if;

  if p_amount_cents <= 0 then
    raise exception 'p_amount_cents must be positive';
  end if;

  if v_payment.refunded_cents + p_amount_cents > v_payment.amount_cents then
    raise exception 'refund of % cents would exceed remaining balance of % cents on payment %',
      p_amount_cents, v_payment.amount_cents - v_payment.refunded_cents, p_payment_id;
  end if;

  update public.payments
  set refunded_cents = refunded_cents + p_amount_cents
  where id = p_payment_id
  returning * into v_payment;

  insert into public.refunds (cancellation_log_id, payment_id, agent_id, amount_cents, stripe_refund_id)
  values (p_cancellation_log_id, p_payment_id, p_agent_id, p_amount_cents, p_stripe_refund_id);

  return v_payment;
end;
$$;
