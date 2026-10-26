-- OE-1 (offer-entry phase, chunk 1): offer details the customer sees, fee lines, the options on
-- the car, window stickers and a home for LEVRating. Plan: docs/plans/offer-entry-phase-plan.md
-- (sections 3.2 and 5.0).
-- APPLIED by Brett in the SQL Editor, 2026-10-25. Rolled-back test 17/17 pass; a6: 18 existing
-- offers, 0 non-agent source, 0 with out-the-door, 0 with a sent time. (The editor showed only the
-- last result of the before and after checks; from the app side the public key is refused on
-- offer_fees, offer_vehicle_options and the new interior column, and the service role reads them.)
-- ADDITIONS ONLY, checked safe with the live code on main (2026-10-25):
--   - every new qualifying_offers / offer_addons / dealerships column is nullable or has a
--     constant default, existing rows pass both new checks, and today's inserts name their
--     columns, so nothing live changes;
--   - two new tables, read and written only through the service role (nothing live uses them);
--   - documents' type check is swapped in this transaction to add 'window_sticker' (the three
--     existing types are kept; the table has no rows today);
--   - seven new activity types, categories 'offer' and 'dealer' (both allowed).
-- Grants (CLAUDE.md, "Explicit grants on every new database object"): the new tables get RLS,
-- the revoke from anon and authenticated, and explicit service_role grants. No anon grant.
-- The existing tables keep their grants; qualifying_offers stays closed to anon and
-- authenticated (Appendix A, 2026-10-24), and new columns inherit that.
-- The guarantee code doesn't change: is_below_msrp stays the guarantee price test, and none of
-- these columns feed it.
begin;

-- Sent-offer data the customer sees.
alter table public.qualifying_offers
  add column offer_source text not null default 'agent'
    check (offer_source in ('agent', 'dealer_link', 'dealer_account')),
  add column offer_submission_id uuid,                       -- FK added in OE-2
  add column sent_by_agent_id uuid references public.agents (id),
  add column sent_to_customer_at timestamptz,                 -- null on offers logged before this phase
  add column vehicle_interior_color text check (char_length(vehicle_interior_color) <= 200),
  add column vehicle_model_year smallint,
  add column good_until date,
  add column note_to_customer text check (char_length(note_to_customer) <= 1000),
  -- Out-the-door: null until recorded (customer sees "Out-the-door quote requested").
  add column otd_source text check (otd_source in ('estimate', 'dealer_quote')),
  add column otd_total_cents integer check (otd_total_cents > 0),
  add column otd_recorded_at timestamptz,
  add column otd_recorded_by_agent_id uuid references public.agents (id),
  add column otd_requested_at timestamptz,
  add column addons_none_confirmed boolean not null default false,
  add column other_fees_none_confirmed boolean not null default false,
  -- Warnings the agent confirmed past (above sticker, duplicate, inactive search).
  add column warnings_confirmed text[] not null default '{}',
  add column warnings_confirmed_by_agent_id uuid references public.agents (id),
  -- The agent confirms the car's trim matches the customer's (the guarantee is make, model and
  -- trim only; Brett 2026-10-18). Informational: the Day-30 check is unchanged.
  add column trim_match_confirmed boolean,
  -- Out-of-state buyers: tax paid at registration, not to the dealer.
  add column tax_paid_at_registration boolean not null default false,
  add constraint qualifying_offers_otd_shape check (
    (otd_source is null and otd_total_cents is null and otd_recorded_at is null)
    or (otd_source is not null and otd_total_cents is not null and otd_recorded_at is not null)
  ),
  add constraint qualifying_offers_warnings_known check (
    warnings_confirmed <@ array['above_sticker', 'duplicate_vin', 'duplicate_dealer', 'inactive_search']::text[]
  );

-- Doc fee, sales tax, title & registration, other fees. Add-ons stay in offer_addons.
create table public.offer_fees (
  id uuid primary key default gen_random_uuid(),
  qualifying_offer_id uuid not null references public.qualifying_offers (id) on delete cascade,
  fee_kind text not null check (fee_kind in ('doc_fee', 'sales_tax', 'title_registration', 'other')),
  fee_label text check (char_length(fee_label) <= 200),      -- required for 'other'
  fee_amount_cents integer not null check (fee_amount_cents >= 0),
  fee_note text check (char_length(fee_note) <= 300),
  created_at timestamptz not null default now(),
  constraint offer_fees_other_needs_label check (fee_kind <> 'other' or fee_label is not null)
);
create unique index offer_fees_one_fixed_kind_idx
  on public.offer_fees (qualifying_offer_id, fee_kind) where fee_kind <> 'other';
create index offer_fees_offer_idx on public.offer_fees (qualifying_offer_id);

-- What's on this car: the customer's wanted options ticked on / not on, plus extras.
create table public.offer_vehicle_options (
  id uuid primary key default gen_random_uuid(),
  qualifying_offer_id uuid not null references public.qualifying_offers (id) on delete cascade,
  vehicle_option_name text not null check (char_length(vehicle_option_name) <= 300),
  -- The customer's ranked selection this answers (null for an extra on the car).
  search_option_selection_id uuid references public.search_option_selections (id) on delete set null,
  customer_asked_for boolean not null,
  on_the_car boolean not null,
  sticker_price_cents integer check (sticker_price_cents >= 0),
  install_kind text check (install_kind in ('factory', 'dealer', 'port')),
  created_at timestamptz not null default now(),
  constraint offer_vehicle_options_extra_is_on_car check (customer_asked_for or on_the_car)
);
create index offer_vehicle_options_offer_idx on public.offer_vehicle_options (qualifying_offer_id);

-- Add-ons: which ones the customer wanted, and whether the dealer says they can come off.
alter table public.offer_addons
  add column addon_customer_wanted boolean not null default false,
  add column addon_dealer_says_removable boolean;

-- Window sticker documents (the three existing types are kept).
alter table public.documents drop constraint documents_type_check;
alter table public.documents add constraint documents_type_check
  check (type in ('financing_proof', 'service_agreement', 'offer_sheet', 'window_sticker'));

-- LEVRating home (the calculation is a later project). Null = "New to LEVR — no rating yet".
alter table public.dealerships
  add column levrating numeric(2,1) check (levrating between 1.0 and 5.0),
  add column levrating_count integer not null default 0 check (levrating_count >= 0),
  add column levrating_updated_at timestamptz;

-- The two locks, and explicit grants, on the new tables.
alter table public.offer_fees enable row level security;
alter table public.offer_vehicle_options enable row level security;
revoke select, insert, update, delete, truncate on public.offer_fees, public.offer_vehicle_options from anon, authenticated;
-- The server inserts these with an offer, reads them for Your Deal and the agent page, and
-- edits or removes fee lines when the out-the-door breakdown is recorded later.
grant select, insert, update, delete on public.offer_fees, public.offer_vehicle_options to service_role;

-- New activity types.
insert into public.agent_activity_types (code, label, category) values
  ('offer_draft_saved', 'Saved an offer draft', 'offer'),
  ('offer_sent', 'Sent an offer to the customer', 'offer'),
  ('offer_warning_confirmed', 'Confirmed an offer warning', 'offer'),
  ('offer_otd_recorded', 'Recorded an out-the-door breakdown', 'offer'),
  ('dealer_link_created', 'Asked a dealer to submit an offer', 'dealer'),
  ('dealer_link_revoked', 'Cancelled a dealer offer link', 'dealer'),
  ('dealer_submission_discarded', 'Discarded a dealer submission', 'offer');

commit;
