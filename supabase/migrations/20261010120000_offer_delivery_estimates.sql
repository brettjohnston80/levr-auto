-- Delivery estimates on offers, before acceptance (Brett's walkthrough note 9,
-- plan approved 2026-10-10).
--
-- Whether an estimate is STANDARD for an offer (dealer beyond the customer's
-- pickup range, or the customer prefers delivery) is decided at read time
-- from the current pickup range, never stored, so changing the range (the
-- map slider) changes it immediately. These columns hold only what was
-- actually asked for and what came back.
--
-- One estimate per offer: a re-request or an updated figure overwrites the
-- previous one (same convention as offer_addons' removal fields).

begin;

alter table public.qualifying_offers
  add column delivery_estimate_status text
    check (delivery_estimate_status in ('requested', 'provided', 'unavailable')),
  add column delivery_estimate_cents integer
    check (delivery_estimate_cents >= 0),
  add column delivery_estimate_note text
    check (char_length(delivery_estimate_note) <= 500),
  add column delivery_estimate_requested_at timestamptz,
  add column delivery_estimate_requested_by text
    check (delivery_estimate_requested_by in ('customer', 'agent')),
  add column delivery_estimate_provided_at timestamptz,
  -- A figure exists exactly when the status says one was provided. The
  -- coalesce keeps both sides true/false (a NULL check result would pass).
  add constraint qualifying_offers_delivery_estimate_shape check (
    (coalesce(delivery_estimate_status, '') = 'provided') = (delivery_estimate_cents is not null)
  );

comment on column public.qualifying_offers.delivery_estimate_status is
  'Delivery estimate from the dealer: requested (asked for, not back yet), provided (delivery_estimate_cents is the figure), unavailable (the dealer will not deliver). Null = never asked.';
comment on column public.qualifying_offers.delivery_estimate_cents is
  'The dealer''s delivery fee in cents; 0 = free delivery. Set only when status is provided.';
comment on column public.qualifying_offers.delivery_estimate_note is
  'Optional agent note on the estimate (e.g. what it covers). Shown to the customer.';
comment on column public.qualifying_offers.delivery_estimate_requested_at is
  'When the estimate was asked for (by the customer, or by the agent when logging an offer that needs one).';
comment on column public.qualifying_offers.delivery_estimate_requested_by is
  'customer = the customer asked on an open offer; agent = marked requested from the dealer while logging the offer.';
comment on column public.qualifying_offers.delivery_estimate_provided_at is
  'When the agent recorded the figure (or that the dealer will not deliver).';

-- Agent worklist: estimates still to get.
create index qualifying_offers_delivery_estimate_requested_idx
  on public.qualifying_offers (delivery_estimate_requested_at)
  where delivery_estimate_status = 'requested';

commit;
