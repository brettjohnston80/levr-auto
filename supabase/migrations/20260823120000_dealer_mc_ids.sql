-- LEVRating Phase A follow-up: capture MarketCheck's real dealer identity
-- (mc_dealer_id) instead of relying solely on name/city/state matching.
-- Scope decided 2026-08-23.
--
-- Correction made during planning, not a literal transcription of the
-- original ask: the field to capture is mc_dealership.mc_dealer_id, not
-- the top-level dealer.id -- confirmed directly against a live MarketCheck
-- API call that dealer.id is actually mc_website_id (a different, unrelated
-- id), consistently across every sample checked. mc_dealership.mc_dealer_id
-- is the field MarketCheck itself names "dealer id."
--
-- listings already has dealer_phone/dealer_website (existing columns,
-- already populated by marketcheck-sync.ts's toListingRow) -- only
-- mc_dealer_id and dealer_type are genuinely new there. dealer_aliases has
-- none of the four yet.

alter table public.listings
  add column mc_dealer_id integer,
  add column dealer_type text;

comment on column public.listings.mc_dealer_id is
  'MarketCheck''s stable dealer identifier (raw_data->mc_dealership->'
  'mc_dealer_id), not the same as the top-level dealer.id field (which is '
  'actually mc_website_id) -- see this migration''s header comment.';

alter table public.dealer_aliases
  add column mc_dealer_id integer,
  add column dealer_phone text,
  add column dealer_website text,
  add column dealer_type text,
  add column confirmed_via text not null default 'agent' check (confirmed_via in ('agent', 'system'));

comment on column public.dealer_aliases.mc_dealer_id is
  'Same MarketCheck dealer identifier as listings.mc_dealer_id -- the '
  'matching key for auto-linking a new alias to an already-confirmed '
  'dealership, set once at alias-insert time and never overwritten on '
  'later syncs, same convention as dealer_name/dealer_city/dealer_state.';

comment on column public.dealer_aliases.confirmed_via is
  'How this alias was confirmed -- ''agent'' (the existing Confirm-as-new/'
  'Merge-into-existing UI, confirmed_by_agent_id set) or ''system'' (auto-'
  'linked via a shared mc_dealer_id with an already-confirmed alias, '
  'confirmed_by_agent_id left null). Same shape as cancellation_log''s '
  'initiated_by column, not a repurposed confirmed_by_agent_id sentinel or '
  'a separate boolean.';

-- Unconfirmed-new-alias auto-link lookup: "does this mc_dealer_id already
-- match a confirmed alias elsewhere." Partial, since coverage of
-- mc_dealer_id isn't guaranteed for every historical row.
create index dealer_aliases_mc_dealer_id_idx
  on public.dealer_aliases (mc_dealer_id)
  where mc_dealer_id is not null;

-- ---------------------------------------------------------------------------
-- One-time backfill: listings.mc_dealer_id / listings.dealer_type, re-parsed
-- from raw_data -- every existing row already carries this in the full raw
-- API response it stored at sync time (confirmed directly: 879/879 current
-- rows have it), so no MarketCheck re-sync is needed for this half of the
-- backfill. The dealer_aliases side (which needs conflict detection and the
-- retroactive auto-link pass, not just a 1:1 column copy) is a separate,
-- one-time application-code pass run after this migration -- see the
-- LEVRating Phase A follow-up entry in CLAUDE.md for that verification.
-- ---------------------------------------------------------------------------
update public.listings
set
  mc_dealer_id = (raw_data -> 'mc_dealership' ->> 'mc_dealer_id')::integer,
  dealer_type = raw_data -> 'dealer' ->> 'dealer_type'
where raw_data is not null;
