-- LEVR Auto — Initial database schema
-- Reference: CLAUDE.md "Critical schema decisions" + LEVR-Auto-Core-Processes-v1.md
--
-- Five tables:
--   agents             — internal team members who own customer relationships
--   customers           — 1:1 with auth.users, carries assigned_agent_id
--   customer_searches   — one row per make/model being actively searched (the demand registry)
--   listings             — raw MarketCheck-sourced inventory, VIN-deduplicated
--   qualifying_offers    — real itemized dealer offers only; NEVER auto-derived from listings

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- agents
-- ---------------------------------------------------------------------------
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.agents is
  'Internal team members. Today this is just Brett — table exists from day one so '
  'assigned_agent_id has somewhere real to point once there is a second person.';

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
-- 1:1 with auth.users (Supabase Auth is the next build step after this schema).
-- email/full_name/phone are denormalized copies of intake/auth data for convenient
-- reads (e.g. an agent-facing admin view) without joining into auth.users.
create table public.customers (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  assigned_agent_id uuid references public.agents (id),
  created_at timestamptz not null default now()
);

comment on column public.customers.assigned_agent_id is
  'Same agent stays with a customer across every search/switch, for continuity. '
  'Set from day one even though it only ever points to one agent today.';

-- ---------------------------------------------------------------------------
-- customer_searches
-- ---------------------------------------------------------------------------
-- One row per make/model a customer is actively (or was) searching for.
-- This table doubles as the demand registry: MarketCheck sync cadence for a given
-- make/model is driven by whether any row here has search_status = 'searching'.
--
-- guarantee_status and search_status are deliberately independent:
--   - guarantee_status resolves once, at Day 30 (met or refunded), and never changes after.
--   - search_status tracks whether we're still actively looking, which continues through
--     Day 60 regardless of the Day-30 outcome (a customer can be refunded AND still get a
--     later qualifying offer before Day 60 — they keep both, per Core-Processes-v1.md).
create table public.customer_searches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,

  make text not null,
  model text not null,
  trim text,
  required_options text[] not null default '{}',
  colors text[] not null default '{}',
  zip text,

  -- How many concurrent make/models were purchased together (1 = $699, 2 = $899, 3 = $999).
  -- Full payment/order modeling is deferred to the Stripe integration build step; this is
  -- just enough to know which pricing tier this search belongs to.
  package_size smallint not null default 1 check (package_size between 1 and 3),

  guarantee_status text not null default 'pending'
    check (guarantee_status in ('pending', 'met', 'refunded')),
  search_status text not null default 'pending_refinement'
    check (search_status in ('pending_refinement', 'searching', 'paused', 'closed', 'switched')),

  -- Day-0 anchor for the Day 30 / Day 60 clocks is payment, not row creation.
  paid_at timestamptz,
  -- Customer has 24h post-payment to fine-tune trim/color/options; search doesn't
  -- start (search_status -> 'searching') until solidified.
  solidified_at timestamptz,

  -- Switching make/model creates a new row and marks the old one superseded,
  -- per the "Change Request" flow in Core-Processes-v1.md — never a silent edit.
  superseded_by_id uuid references public.customer_searches (id),

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customer_searches is
  'One row per make/model a customer is searching for. Doubles as the demand '
  'registry driving MarketCheck sync cadence — see search_status.';

-- Demand registry lookup: which make/models currently need active syncing.
create index customer_searches_active_make_model_idx
  on public.customer_searches (make, model)
  where search_status = 'searching';

create index customer_searches_customer_id_idx
  on public.customer_searches (customer_id);

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
-- Raw MarketCheck-sourced inventory. Just sourced data, refreshed on a cadence.
-- An advertised listing price is NEVER automatically a Qualifying Offer.
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  vin text not null unique,

  make text not null,
  model text not null,
  trim text,
  year integer,
  color text,

  price_cents integer,
  msrp_cents integer,

  -- Testing showed MarketCheck defaults to mostly used inventory without an explicit
  -- car_type=new filter on every sync call. This constraint is a defensive backstop
  -- against that filter ever being dropped upstream.
  car_type text not null default 'new' check (car_type = 'new'),

  dealer_name text,
  dealer_phone text,
  dealer_website text,
  dealer_city text,
  dealer_state text,
  dealer_zip text,

  -- Full raw API response, for reprocessing/debugging without re-fetching.
  raw_data jsonb,

  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.listings is
  'Raw sourced inventory from MarketCheck. VIN is the de-duplication key — '
  'always upsert on VIN, never insert-always, or re-syncs create duplicate rows.';

create index listings_make_model_idx on public.listings (make, model);

-- ---------------------------------------------------------------------------
-- qualifying_offers
-- ---------------------------------------------------------------------------
-- ONLY populated when a dealer actually responds to outreach with a real, itemized
-- offer they're willing to honor. This is a hard business rule, not a UI nuance —
-- see the comment on `listings` above. Only rows in this table count toward the
-- 30-day guarantee.
create table public.qualifying_offers (
  id uuid primary key default gen_random_uuid(),
  customer_search_id uuid not null references public.customer_searches (id) on delete cascade,
  -- Nullable: a dealer may offer a matching unit that was never in our listings
  -- table (e.g. off-lot inventory not surfaced by the MarketCheck sync).
  listing_id uuid references public.listings (id),

  dealer_name text not null,
  dealer_contact text,

  offer_price_cents integer not null,
  -- MSRP snapshot at time of offer (Total Monroney: base + factory options +
  -- destination, excluding tax/title/doc/dealer add-ons) — stored here rather than
  -- only read from listings so a later price correction can't retroactively change
  -- an already-made guarantee determination.
  msrp_cents integer not null,
  is_below_msrp boolean generated always as (offer_price_cents < msrp_cents) stored,

  received_at timestamptz not null default now(),
  -- 24h response-window clock (Sold-to-someone-else edge case) starts here, not at
  -- received_at — delivery to the customer's dashboard may lag raw receipt/parsing.
  delivered_at timestamptz,
  customer_responded_at timestamptz,
  vehicle_sold_at timestamptz,

  status text not null default 'pending'
    check (status in ('pending', 'customer_accepted', 'customer_declined', 'withdrawn')),

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.qualifying_offers is
  'Real itemized dealer offers only. is_below_msrp encodes the exact Qualifying '
  'Offer rule. Whether a given offer ultimately "counts" toward the Day-30 '
  'guarantee in the sold-before-response edge case is a derived determination '
  'built from delivered_at / customer_responded_at / vehicle_sold_at — deliberately '
  'not pre-computed into a stored column here.';

create index qualifying_offers_customer_search_id_idx
  on public.qualifying_offers (customer_search_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.customer_searches
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.qualifying_offers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Enabled everywhere. The service_role key (used server-side) bypasses RLS
-- automatically. Write paths (intake, offer creation, listing sync) aren't built
-- yet, so for now these policies are read-only for authenticated customers on
-- their own data; listings and agents have no public policies at all (internal/
-- operational only).

alter table public.agents enable row level security;
alter table public.customers enable row level security;
alter table public.customer_searches enable row level security;
alter table public.listings enable row level security;
alter table public.qualifying_offers enable row level security;

create policy "Customers can view their own record"
  on public.customers for select
  using (auth.uid() = id);

create policy "Customers can view their own searches"
  on public.customer_searches for select
  using (auth.uid() = customer_id);

create policy "Customers can view offers on their own searches"
  on public.qualifying_offers for select
  using (
    exists (
      select 1 from public.customer_searches cs
      where cs.id = qualifying_offers.customer_search_id
        and cs.customer_id = auth.uid()
    )
  );

-- No policies on agents or listings: locked to service_role only, by design.
