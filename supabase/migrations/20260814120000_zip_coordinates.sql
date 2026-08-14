-- Reference table: ZIP Code Tabulation Area (ZCTA) centroid coordinates,
-- sourced from the US Census Bureau Gazetteer ZCTA file (public domain, no
-- attribution required --
-- https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html).
--
-- Used to compute real distance between a customer's zip and a listing's
-- dealer_zip for the Step 2 zip-radius inventory count -- see CLAUDE.md
-- "Pricing Pivot Tracking": Step 2 requires real zip-radius filtering, not a
-- nationwide-only count (local sourcing keeps transport cost/coordination
-- lowest).
--
-- Schema only -- this migration does not load data. Populate separately from
-- the Gazetteer ZCTA National file (tab-delimited), via Supabase's Table
-- Editor CSV import (or `\copy` if you have direct DB access), mapping
-- GEOID -> zip, INTPTLAT -> latitude, INTPTLONG -> longitude. Do not
-- hand-populate this table -- it needs the full ~33k-row national set to be
-- useful, and any partial/manually-typed subset would silently make some
-- zips "un-locatable" with no obvious failure mode.
--
-- Plain lat/long columns, not PostGIS/earthdistance -- listings volume per
-- make/model is small enough (capped at 150 rows via marketcheck-sync.ts,
-- already indexed on (make, model)) that distance filtering happens in
-- application code against that small result set, not via a spatial index.
create table public.zip_coordinates (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);

comment on table public.zip_coordinates is
  'ZCTA centroid coordinates from the US Census Bureau Gazetteer file. Used '
  'for application-side Haversine distance calculations against '
  'listings.dealer_zip and a customer''s intake zip -- see CLAUDE.md '
  '"Pricing Pivot Tracking", Step 2.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Non-sensitive public reference data -- unlike listings/agents (RLS enabled,
-- zero policies, locked to service_role only), this table is meant to be
-- read directly by anon and authenticated alike, so it gets an explicit
-- permissive select policy instead of relying on the base GRANTs from
-- grants.sql. Bulk-imported once from the Gazetteer CSV and never written to
-- by the app -- no insert/update/delete policy is added, which (same as
-- listings/agents) locks writes to service_role only even though
-- authenticated already has table-level insert/update/delete GRANTs from
-- grants.sql's ALTER DEFAULT PRIVILEGES.

alter table public.zip_coordinates enable row level security;

create policy "Anyone can read zip coordinates"
  on public.zip_coordinates for select
  using (true);

-- No insert/update/delete policy: locked to service_role only, by design.
