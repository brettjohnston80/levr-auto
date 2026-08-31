-- Matchmaker vehicle-dataset replacement, Step 1 (schema + import). Scope
-- decided 2026-08-30. Replaces the static, hand-regenerated
-- generated-matchmaker-data.ts (735 vehicles, 1-5 scale, soft-weighted
-- fitScore()) with a real Supabase table backing a hard-filter +
-- rank-weighted system (1,601 vehicles, 9 dimensions scored 50-100,
-- computed offline by matchmaker_scoring_pipeline.py).
--
-- This dataset is explicitly NOT static like the old 735-vehicle set --
-- it's expected to be re-imported as new research passes land (new model
-- years, corrective passes, expanded makes). vehicle_dataset_batches exists
-- specifically for that: each import lands as its own batch of rows,
-- entirely separate from whatever's currently live, so a new import can
-- never partially clobber or corrupt the batch real users are being served
-- from mid-import. Promoting a batch live is one atomic, explicit action
-- (promote_vehicle_dataset_batch), never a per-row edit -- same
-- draft-then-explicit-promote shape already used elsewhere in this
-- codebase for articles/social_posts, just adapted for a bulk dataset
-- instead of a single editable row.

-- ---------------------------------------------------------------------------
-- vehicle_dataset_batches
-- ---------------------------------------------------------------------------
create table public.vehicle_dataset_batches (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  row_count integer not null,
  is_live boolean not null default false,
  imported_at timestamptz not null default now(),
  promoted_at timestamptz,
  notes text
);

comment on table public.vehicle_dataset_batches is
  'One row per vehicle-dataset import. is_live marks which batch the live '
  'site currently reads -- flipped only via promote_vehicle_dataset_batch, '
  'never edited directly, so a new import never partially replaces the '
  'batch real traffic is being served from.';

-- At most one live batch at a time -- a plain unique index on a boolean
-- column, scoped to true rows only, is the standard Postgres idiom for
-- this (a second is_live=true row would collide on the indexed value).
-- Defense-in-depth alongside promote_vehicle_dataset_batch's own guard
-- below, same double-guard convention as record_refund/resolveCancellation
-- elsewhere in this codebase.
create unique index vehicle_dataset_batches_one_live_idx
  on public.vehicle_dataset_batches (is_live)
  where is_live;

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
-- One row per make/model/trim/model_year, tied to the batch it was
-- imported in. Columns mirror matchmaker-vehicle-dataset-2026-v18-scored.csv
-- 1:1 (see matchmaker_scoring_pipeline.py / matchmaker-data-spec.md for
-- sourcing + scoring methodology) -- money columns converted to integer
-- cents at import time, matching this codebase's existing convention
-- (listings.price_cents/msrp_cents), everything else kept at the same
-- precision/shape the pipeline outputs.
--
-- The 9 *_score columns are precomputed offline by the pipeline, already
-- scored 50-100 relative to same-body-style-class peers. They are never
-- recalculated client-side or per-request -- only the final rank-weighted
-- total (score * rank-position weight, summed) happens live, in
-- application code, against whatever priority order the customer picked.
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  dataset_batch_id uuid not null references public.vehicle_dataset_batches (id) on delete cascade,

  make text not null,
  model text not null,
  trim text not null,
  model_year smallint not null,
  is_performance_trim boolean not null default false,

  -- Hard-filter field #1. Normalized by the pipeline into exactly the 9
  -- classes the app's VehicleType enum uses -- SUV/Sedan/Truck/Coupe/
  -- Hatchback/Cargo Van/Convertible/Minivan/Wagon. Constrained here so a
  -- future import can't silently introduce a class the UI has no option
  -- for; update this constraint and matchmaker-data.ts's VEHICLE_TYPES
  -- together if that ever needs to change.
  body_style text not null check (
    body_style in (
      'SUV', 'Sedan', 'Truck', 'Coupe', 'Hatchback',
      'Cargo Van', 'Convertible', 'Minivan', 'Wagon'
    )
  ),

  doors smallint,
  -- Hard-filter field #2 (minimum-only -- see app-level filter logic).
  seating_capacity smallint,
  drivetrain text,
  -- Raw sourced value (Gas/EV/Hybrid/PHEV/Diesel/Hydrogen) -- kept as
  -- sourced, not normalized here. The app's 4-button powertrain
  -- preference (Gas/Diesel/Hybrid/Electric) folds PHEV into Hybrid and
  -- Hydrogen into Electric for display/segmentation purposes only; that
  -- fold happens in application code so the raw sourced fact isn't lost.
  fuel_type text,

  msrp_cents integer,
  destination_fee_cents integer,
  -- Hard-filter field #3. msrp_cents + destination_fee_cents, as computed
  -- by the pipeline (not recomputed at query time).
  true_starting_price_cents integer,

  epa_city_mpg numeric,
  epa_hwy_mpg numeric,
  epa_combined_mpg numeric,
  range_mi numeric,

  nhtsa_overall_stars smallint,

  passenger_volume_cuft numeric,
  front_legroom_in numeric,
  rear_legroom_in numeric,
  third_row_legroom_in numeric,
  front_headroom_in numeric,
  rear_headroom_in numeric,
  third_row_headroom_in numeric,
  has_third_row boolean not null default false,

  cargo_volume_seats_up_cuft numeric,
  max_cargo_volume_cuft numeric,
  towing_capacity_lbs integer,
  payload_capacity_lbs integer,

  reliability_rating numeric,

  horsepower integer,
  torque_lbft integer,
  zero_to_60_sec numeric,
  top_speed_mph integer,

  tech_score smallint,

  warranty_basic_years smallint,
  warranty_basic_miles integer,
  warranty_powertrain_years smallint,
  warranty_powertrain_miles integer,

  resale_depreciation_pct numeric,

  manufacturer_link text,
  safety_source text,
  fuel_tank_capacity_gal numeric,
  resale_source text,
  reliability_source_note text,

  -- The 9 Matchmaker scoring dimensions. Precomputed by
  -- matchmaker_scoring_pipeline.py, 50-100 scale, relative to same-
  -- body_style-class peers. Not null -- the v18 pipeline output has zero
  -- blanks across all 1,601 rows: missing underlying specs floor the
  -- score at 50 (never below), so unknown data is never rewarded when a
  -- customer prioritizes that dimension -- distinct from the pipeline's
  -- separate 75-point fallback used only for zero-variance-with-real-data
  -- cases. See matchmaker_scoring_pipeline.py for the exact rule.
  safety_score numeric(5, 2) not null,
  comfort_score numeric(5, 2) not null,
  cargo_score numeric(5, 2) not null,
  fuel_economy_score numeric(5, 2) not null,
  reliability_score numeric(5, 2) not null,
  tech_features_score numeric(5, 2) not null,
  price_value_score numeric(5, 2) not null,
  resale_value_score numeric(5, 2) not null,
  performance_score numeric(5, 2) not null,

  created_at timestamptz not null default now(),

  -- Guards against a bad re-run of the import script creating duplicate
  -- rows within the same batch. Different batches are free to repeat the
  -- same tuple -- that's the whole point of batches.
  --
  -- make/model/trim/model_year alone is NOT enough -- confirmed against
  -- the real v18 CSV that 132 distinct real vehicles share that exact
  -- tuple (e.g. Hyundai Tucson SE 2026 exists as both Gas and Hybrid;
  -- Porsche Cayenne Base 2026 exists as both an SUV and a Coupe body
  -- style). body_style/drivetrain/fuel_type make the full tuple unique
  -- across all 1,601 real rows -- verified by dry-running the actual CSV
  -- before this migration was finalized, not assumed.
  unique (dataset_batch_id, make, model, trim, model_year, body_style, drivetrain, fuel_type)
);

comment on table public.vehicles is
  'Matchmaker reference dataset -- researched specs + precomputed scores '
  'per real, currently-sold trim. Entirely separate from listings, which '
  'is live MarketCheck dealer inventory (VIN-keyed, no spec/score data). '
  'Only rows in the batch marked is_live on vehicle_dataset_batches should '
  'ever be read by the live site.';

create index vehicles_dataset_batch_id_idx on public.vehicles (dataset_batch_id);
create index vehicles_batch_body_style_idx on public.vehicles (dataset_batch_id, body_style);

-- ---------------------------------------------------------------------------
-- promote_vehicle_dataset_batch
-- ---------------------------------------------------------------------------
-- The only path that ever sets is_live -- atomically demotes whatever
-- batch is currently live (if any) and promotes the target, so the live
-- site is never mid-transition between two batches. Row-locks the target
-- first, same guard shape as confirm_dealer_alias_as_new/
-- switch_customer_search elsewhere in this codebase.
--
-- *** THIS ALONE DOES NOT UPDATE THE LIVE SITE. *** /matchmaker
-- (src/app/matchmaker/page.tsx) is a fully static route -- confirmed
-- 2026-09-02 by reading next.config.ts (no custom cache/ISR config), the
-- route itself (no `export const revalidate`, no `export const dynamic`,
-- unlike every other real-data page in this codebase, e.g.
-- src/app/account/page.tsx), and the admin Supabase client (no fetch
-- cache overrides). With none of those present, Next.js renders this
-- route exactly once, at build time, and never revalidates it
-- automatically -- there is no ISR timer here. getLiveVehicles() only
-- ever runs again on the NEXT `next build` (i.e. the next Vercel
-- deploy). So: call this function, THEN trigger a deploy (push to
-- origin/main) -- in that order, every time. Calling this function
-- after a deploy has zero effect on the live site until another deploy
-- happens. Deliberately accepted as-is, not forced dynamic (2026-09-02).
create function public.promote_vehicle_dataset_batch(p_batch_id uuid)
returns public.vehicle_dataset_batches
language plpgsql
as $$
declare
  v_batch public.vehicle_dataset_batches;
begin
  select * into v_batch
  from public.vehicle_dataset_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'vehicle_dataset_batches row % not found', p_batch_id;
  end if;

  update public.vehicle_dataset_batches
  set is_live = false
  where is_live = true
    and id <> p_batch_id;

  update public.vehicle_dataset_batches
  set is_live = true,
      promoted_at = now()
  where id = p_batch_id
  returning * into v_batch;

  return v_batch;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS -- service role only, same convention as every other table in this
-- codebase (listings, agents, dealerships, etc). The live site reads
-- through a server-side admin client, never a direct client-side query.
-- ---------------------------------------------------------------------------
alter table public.vehicle_dataset_batches enable row level security;
alter table public.vehicles enable row level security;
-- No policies on either.
