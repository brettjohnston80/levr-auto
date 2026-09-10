-- Configurator dataset (Toyota + Honda), step 2 of 9.
--
-- Per-trim factory-configurator research: exterior colors, interior
-- color/material, seating configurations, wheels, roof, drivetrain
-- variants and features -- each tagged with how it is obtainable
-- (standard / standalone / package-only / unavailable), and for
-- package-only items, the package's name, itemized contents and price.
--
-- Source: data/toyota-configurator-full-2026-09-09.csv (171 rows, 21
-- models) and data/honda-configurator-full-2026-09-09.csv (72 rows, 11
-- models), both MY2026-MY2027, added in the previous step.
--
-- SCOPE, deliberately narrow: Toyota + Honda only -- 2 of the 36 makes
-- intake now offers. The richer configurator-driven finalize flow is the
-- EXCEPTION, not the norm; every other make keeps using today's
-- inventory-derived trim/colors/options flow unchanged. /finalize decides
-- per search by looking for a matching configurator_trims row, so a future
-- make lights up by importing data, not by editing code.
--
-- Batched with an explicit promote step, same draft-then-promote shape as
-- vehicle_dataset_batches -- an import never partially replaces the batch
-- real traffic is being served from.

-- ---------------------------------------------------------------------------
-- configurator_batches
-- ---------------------------------------------------------------------------
create table public.configurator_batches (
  id uuid primary key default gen_random_uuid(),
  -- Plural: one batch covers BOTH source CSVs (Toyota + Honda), unlike
  -- vehicle_dataset_batches' single source_filename, because the two makes
  -- are researched and imported together as one coverage set.
  source_files text[] not null,
  is_live boolean not null default false,
  imported_at timestamptz not null default now(),
  promoted_at timestamptz
);

comment on table public.configurator_batches is
  'One row per configurator-dataset import. is_live marks which batch '
  '/finalize currently reads -- flipped only via promote_configurator_batch, '
  'never edited directly, so an import never partially replaces the data '
  'real traffic is being served from.';

-- At most one live batch at a time -- a unique index on a boolean scoped
-- to true rows only, the standard Postgres idiom (a second is_live=true
-- row collides on the indexed value). Same pattern as
-- vehicle_dataset_batches_one_live_idx.
create unique index configurator_batches_one_live_idx
  on public.configurator_batches (is_live)
  where is_live;

-- ---------------------------------------------------------------------------
-- configurator_trims
-- ---------------------------------------------------------------------------
-- One row per source CSV row. The CSV's grain is make+model+trim+
-- model_year+drivetrain+fuel_type: the same nominal trim can appear more
-- than once for genuinely different builds (e.g. a RAV4 XLE in FWD Hybrid
-- and AWD Hybrid), and those carry different option sets, so drivetrain
-- and fuel_type are part of the identity rather than descriptive extras.
create table public.configurator_trims (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.configurator_batches (id) on delete cascade,

  make text not null,
  model text not null,
  trim text not null,
  model_year smallint not null,
  drivetrain text,
  fuel_type text,
  body_style text,

  -- Scoped to batch_id as well as the identity tuple: two batches can
  -- legitimately hold the same trim, and only one of them is ever live.
  unique (batch_id, make, model, trim, model_year, drivetrain, fuel_type)
);

comment on table public.configurator_trims is
  'One row per configurator CSV row. drivetrain/fuel_type are part of the '
  'identity, not decoration -- the same trim name can describe several '
  'real builds with different option sets.';

-- The gating lookup /finalize performs per search: does configurator data
-- exist for this make/model/year, and which trims. Matched against the
-- trim list derived from real MarketCheck inventory (buildTrimOptions),
-- which stays the source of truth for what is actually buyable -- a miss
-- means "no rich data", and the search falls back to today's flow.
create index configurator_trims_lookup_idx
  on public.configurator_trims (batch_id, make, model, model_year);

-- ---------------------------------------------------------------------------
-- configurator_options
-- ---------------------------------------------------------------------------
-- The normalized grain: one row per parsed item from the CSV's option
-- columns. Those columns are a two-level delimited string, NOT JSON --
-- items split on ' ;; ', fields on ' | ' as
-- `name | availability | price | package_ref`, with an optional ' -- '
-- free-text note suffix. Parsing happens at import; nothing downstream
-- ever re-parses raw CSV text.
create table public.configurator_options (
  id uuid primary key default gen_random_uuid(),
  trim_id uuid not null references public.configurator_trims (id) on delete cascade,

  -- Which CSV column this item came from. Kept as a check-constrained text
  -- column rather than a Postgres enum type, matching this codebase's
  -- existing convention (payments.payment_type, cancellation_log.
  -- initiated_by, purchase_status_log.action). Adding a category later is
  -- then a constraint change, not a type migration -- which is what lets
  -- this scale to future makes/categories without a schema rewrite.
  category text not null check (category in (
    'exterior_color', 'interior', 'seating', 'wheels', 'roof', 'drivetrain', 'feature'
  )),
  name text not null,

  -- The source availability string, verbatim, including any free-text
  -- qualifier. Preserved for audit because the normalization below is
  -- lossy and, for the ambiguous bucket, deliberately opinionated -- this
  -- column is what makes a later re-classification possible without
  -- re-importing from CSV.
  availability_raw text,

  -- Normalized availability. The source field is NOT a clean four-value
  -- enum: across 3,975 option items there are ~180 distinct strings --
  -- 85.5% match one of the four exactly, 7.1% carry a clean prefix plus a
  -- qualifier ('Unavailable (cloth only)', 'Standard (Honda Sensing)'),
  -- and 7.4% are ambiguous (163 blank, 50 'Unknown', 26 'Unconfirmed',
  -- 17 'Not confirmed', plus 'Available', 'Unclear', 'Not Applicable').
  --
  -- Import normalizes exact-match first, then prefix-match to recover the
  -- 7.1%, and resolves EVERYTHING ambiguous to 'unavailable' (approved
  -- decision) so it is omitted from customer questions. A false omission
  -- is far safer than offering a feature the car cannot have.
  availability text not null check (availability in (
    'standard', 'standalone', 'package_only', 'unavailable'
  )),

  -- Integer cents, matching listings.price_cents/msrp_cents. NULL means
  -- price genuinely unknown/unparseable and MUST NOT render as "$0" --
  -- the source mixes '$0', '+$475', 'included' and blanks.
  price_cents integer,
  -- True where the source said 'included' rather than a figure: the item
  -- costs nothing extra *because* it comes with something else. Distinct
  -- from price_cents = 0 (free, standalone) and from NULL (unknown).
  price_is_included boolean not null default false,

  -- Package fields, populated only for availability = 'package_only'.
  -- Denormalized onto the option row on purpose: the agent-facing view
  -- needs name + contents + price in one read, and an option belongs to
  -- exactly one package.
  --
  -- Items whose package reference does not resolve against that row's
  -- package_definitions are DROPPED at import, not stored with nulls
  -- (approved decision) -- 11 such features exist in the source, all
  -- Toyota C-HR XSE. A package-only "yes" with no name, contents or price
  -- cannot be actioned by an agent, so it must never reach a customer.
  package_name text,
  package_price_cents integer,
  package_contents text[],

  notes text,

  -- Package fields travel together: either this is a package-only item
  -- with a resolved package name, or it carries no package data at all.
  -- Prevents a half-populated row from ever reaching the agent view.
  constraint configurator_options_package_shape check (
    (availability = 'package_only' and package_name is not null)
    or (availability <> 'package_only' and package_name is null
        and package_price_cents is null and package_contents is null)
  )
);

comment on table public.configurator_options is
  'One row per parsed configurator option. availability is normalized for '
  'querying; availability_raw keeps the source text verbatim so a later '
  're-classification never needs a re-import.';

-- Every read is "all options for this trim", usually filtered by category.
create index configurator_options_trim_idx
  on public.configurator_options (trim_id, category);

-- ---------------------------------------------------------------------------
-- promote_configurator_batch
-- ---------------------------------------------------------------------------
-- The ONLY supported way to flip is_live. Demote-then-promote happens
-- inside one transaction, with the target row locked FOR UPDATE first, so
-- two concurrent promotions cannot both succeed and the table is never
-- momentarily left with zero or two live batches. Mirrors
-- promote_vehicle_dataset_batch exactly.
--
-- Never edit is_live with a direct UPDATE: that skips the lock and the
-- atomic demote, leaving the partial unique index
-- (configurator_batches_one_live_idx) as the only thing standing between a
-- mistake and two live batches. The index is defense-in-depth, not the
-- primary guard.
--
-- Unlike promote_vehicle_dataset_batch, this one does NOT need a
-- deploy afterwards to take effect. /finalize is a dynamic route (it is
-- auth-gated and reads per-request), so a promoted batch is live for the
-- next request. The static-route promote-then-deploy sequencing that
-- /matchmaker requires does not apply here.
create function public.promote_configurator_batch(p_batch_id uuid)
returns public.configurator_batches
language plpgsql
as $$
declare
  v_batch public.configurator_batches;
begin
  select * into v_batch
  from public.configurator_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'configurator_batches row % not found', p_batch_id;
  end if;

  update public.configurator_batches
  set is_live = false
  where is_live = true
    and id <> p_batch_id;

  update public.configurator_batches
  set is_live = true,
      promoted_at = now()
  where id = p_batch_id
  returning * into v_batch;

  return v_batch;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS -- service role only, zero policies, same convention as every other
-- table in this codebase (listings, vehicles, dealerships, etc). /finalize
-- reads through a server-side admin client, never a direct client query.
-- ---------------------------------------------------------------------------
alter table public.configurator_batches enable row level security;
alter table public.configurator_trims enable row level security;
alter table public.configurator_options enable row level security;
-- No policies on any of the three.
