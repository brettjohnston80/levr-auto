-- Offer highlight/note (customer -> agent signal) and offer-detail fields.
-- Plan: docs/plans/offer-detail-highlight-plan.md (approved 2026-09-25).
-- All columns are additive and nullable; existing rows are unaffected.
--
-- HIGHLIGHT / NOTE. A customer can mark a PENDING offer highlighted
-- ("interested, not ready to commit") and/or leave a short note for their
-- agent. The two are independent. Editable only while the offer is pending
-- (enforced by the server actions' .eq("status", "pending") write guard);
-- once the offer is accepted/declined/withdrawn they are frozen and kept, so
-- the agent keeps the context. customer_highlighted_at follows this schema's
-- convention that a nullable timestamp IS the boolean (vehicle_sold_at,
-- deposit_confirmed_at) and gives the agent a "when".
--
-- AGENT VISIBILITY. There is deliberately no email/SMS. Instead
-- customer_activity_at is bumped by every highlight/note change AND by a
-- decline, and agent_reviewed_at is set by "Mark reviewed" on the agent's
-- outreach page. An offer is unreviewed while
--   customer_activity_at > coalesce(agent_reviewed_at, -infinity)
-- so an item never ages out, and any later customer change makes it
-- reappear. (Un-highlighting / clearing a note leaves no other timestamp
-- behind, which is why activity is tracked in its own column rather than
-- derived from the others.)
--
-- DETAIL FIELDS. Dealer address, VIN and stock number, copied onto the
-- offer when the agent logs it -- pre-filled from a linked MarketCheck
-- listing when one is chosen, typed otherwise, all optional. Same
-- copy-at-log-time convention as vehicle_trim / msrp_cents: a later
-- listing re-sync can't rewrite what the dealer actually offered. Listing
-- PHOTOS are not copied -- they're read live from the linked listing, and
-- only when LISTING_PHOTOS_ENABLED is on (off until MarketCheck's photo
-- terms are reviewed).

alter table public.qualifying_offers
  add column customer_highlighted_at timestamptz,
  add column customer_note text,
  add column customer_note_updated_at timestamptz,
  add column customer_activity_at timestamptz,
  add column agent_reviewed_at timestamptz,
  add column dealer_street text,
  add column dealer_city text,
  add column dealer_state text,
  add column dealer_zip text,
  add column vin text,
  add column stock_number text;

alter table public.qualifying_offers
  add constraint qualifying_offers_customer_note_length
    check (customer_note is null or char_length(customer_note) <= 500),
  add constraint qualifying_offers_dealer_zip_format
    check (dealer_zip is null or dealer_zip ~ '^[0-9]{5}$');

comment on column public.qualifying_offers.customer_highlighted_at is
  'Customer marked this pending offer as interesting (null = not highlighted). Frozen once the offer leaves pending.';
comment on column public.qualifying_offers.customer_note is
  'Customer''s short note to their agent (max 500 chars). Agent-facing only; never shown to the dealer by the app.';
comment on column public.qualifying_offers.customer_activity_at is
  'Bumped by any customer highlight/note change or a decline. Unreviewed while newer than agent_reviewed_at.';
comment on column public.qualifying_offers.agent_reviewed_at is
  'Set by "Mark reviewed" in the agent''s "Customer activity on offers" section.';
comment on column public.qualifying_offers.dealer_street is
  'Dealer address, copied at log time (pre-filled from a linked listing when available). Shown to the customer.';
