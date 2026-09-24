-- One accepted offer per search, plus an agent "release" path for an
-- accepted offer whose deal fell through.
--
-- WHY THE INDEX: respondToOffer only guarded `.eq("status", "pending")` on
-- the single offer being responded to, so nothing stopped a customer
-- accepting a second offer on the same search -- which would open a second,
-- parallel closing flow (two PandaDoc service agreements, two deposits, two
-- "Mark purchased" buttons). The app now refuses a second accept with a
-- friendly message, but two browser tabs accepting different offers at the
-- same instant would both pass that app-level check. This partial unique
-- index is the backstop that makes the rule race-proof: the second write
-- fails with 23505, which respondToOffer maps to the same message. Same
-- shape as configurator_batches_one_live_idx.
--
-- Verified before writing (2026-09-24, read-only scan of production): 10
-- offers, 5 customer_accepted, each on a different search -- zero existing
-- duplicates. If a duplicate somehow appears before this runs, the CREATE
-- fails loudly rather than applying over bad data.
--
-- WHY THE WITHDRAWN COLUMNS: nothing could ever un-accept an offer (status
-- is only ever written by respondToOffer, and only from 'pending'), so
-- without a release path the index above would permanently strand a
-- customer whose accepted deal fell through (dealer sold the car, financing
-- collapsed, ...). withdrawAcceptedOffer (agent-only) moves the offer to
-- 'withdrawn' -- already a legal status value in the original CHECK, just
-- never written until now -- which falls outside the index's WHERE clause,
-- so the customer can then accept a different offer.
--
-- Deliberately NOT reusing 'customer_declined': the customer never declined
-- this offer, and an agent needs to be able to tell "the customer said no"
-- apart from "the deal fell through."
--
-- A withdrawal never touches customer_responded_at, delivered_at, or
-- vehicle_sold_at -- the Day-30 guarantee evaluation reads exactly those
-- columns (never status), so releasing an offer can't retroactively change
-- a guarantee outcome.

create unique index qualifying_offers_one_accepted_per_search_idx
  on public.qualifying_offers (customer_search_id)
  where status = 'customer_accepted';

alter table public.qualifying_offers
  add column withdrawn_at timestamptz,
  add column withdrawn_by_agent_id uuid references public.agents (id),
  add column withdrawal_reason text;

-- One-directional on purpose: a withdrawn offer must carry who/when/why,
-- but nothing forces these null on other statuses (a withdrawal is
-- terminal -- respondToOffer only ever writes from 'pending' -- so there is
-- no path back out of 'withdrawn' that would leave stale metadata behind).
alter table public.qualifying_offers
  add constraint qualifying_offers_withdrawn_requires_metadata
  check (
    status <> 'withdrawn'
    or (withdrawn_at is not null and withdrawn_by_agent_id is not null and withdrawal_reason is not null)
  );

comment on column public.qualifying_offers.withdrawn_at is
  'Set by withdrawAcceptedOffer (agent-only) when an accepted offer is released because the deal fell through. Terminal.';
comment on column public.qualifying_offers.withdrawn_by_agent_id is
  'Agent who released the accepted offer.';
comment on column public.qualifying_offers.withdrawal_reason is
  'Agent-entered reason for the release. Agent-facing only -- never shown to the customer.';
