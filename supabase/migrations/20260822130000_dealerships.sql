-- LEVRating Phase A: dealership entity + salesperson roster. Scope decided
-- 2026-08-22. "Dealer" today only exists as denormalized dealer_name/
-- dealer_city/dealer_state fields on listings, sourced raw from MarketCheck
-- with no dedup across name variants for the same real physical dealership.
-- This introduces dealerships as a real, trackable entity, with
-- dealer_aliases as the layer connecting raw sourced identities to it.
--
-- listings itself is deliberately untouched -- no dealership_id/alias FK
-- added to it. It stays purely raw sourced data per its own existing table
-- comment; listing counts per alias/dealership are computed at read time by
-- grouping listings.dealer_name/dealer_city/dealer_state in application
-- code, same convention already used by outreach-queue.ts's per-dealer
-- aggregation and inventory-count.ts's Haversine pass.

-- ---------------------------------------------------------------------------
-- dealerships
-- ---------------------------------------------------------------------------
-- The real, deduplicated record -- one row per actual physical dealership,
-- regardless of how many dealer_name variants MarketCheck reports for it.
create table public.dealerships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  state text,
  created_at timestamptz not null default now()
);

comment on table public.dealerships is
  'One row per real, agent-confirmed physical dealership. Never written to '
  'directly from sync -- only created via confirm_dealer_alias_as_new, '
  'which links it to the alias that spawned it in the same transaction.';

-- ---------------------------------------------------------------------------
-- dealer_aliases
-- ---------------------------------------------------------------------------
-- Every distinct (dealer_name, dealer_city, dealer_state) identity actually
-- seen in listings, and whether it's been matched to a real dealerships row
-- yet. dealership_id/confirmed_at/confirmed_by_agent_id all stay null until
-- an agent confirms it (as new or merged into an existing dealership) via
-- /internal/dealerships -- this null state is what naturally builds the
-- unconfirmed queue as real syncs run.
--
-- dealer_city_key/dealer_state_key: a plain unique constraint on
-- (dealer_name, dealer_city, dealer_state) would not dedupe rows where city/
-- state are both null, since Postgres treats NULL <> NULL in uniqueness
-- checks -- two syncs both reporting a dealer with no city would otherwise
-- create two alias rows. These generated columns coalesce nulls to '' so
-- the unique constraint (and the sync upsert's ON CONFLICT target) is
-- actually null-safe.
create table public.dealer_aliases (
  id uuid primary key default gen_random_uuid(),
  dealer_name text not null,
  dealer_city text,
  dealer_state text,
  dealer_city_key text generated always as (coalesce(dealer_city, '')) stored,
  dealer_state_key text generated always as (coalesce(dealer_state, '')) stored,

  dealership_id uuid references public.dealerships (id),
  confirmed_at timestamptz,
  confirmed_by_agent_id uuid references public.agents (id),

  created_at timestamptz not null default now(),

  unique (dealer_name, dealer_city_key, dealer_state_key)
);

comment on table public.dealer_aliases is
  'Every distinct raw dealer identity seen in listings.dealer_name/'
  'dealer_city/dealer_state. dealership_id null = unconfirmed. Populated by '
  'ensureDealerAliasesForListings on every sync (insert-if-new, never '
  'overwrites an existing row''s confirmation), plus the one-time backfill '
  'below for data that predates this table.';

-- Unconfirmed-queue read path: every row with dealership_id null.
create index dealer_aliases_unconfirmed_idx
  on public.dealer_aliases (created_at)
  where dealership_id is null;

create index dealer_aliases_dealership_id_idx on public.dealer_aliases (dealership_id);

-- ---------------------------------------------------------------------------
-- dealership_salespeople
-- ---------------------------------------------------------------------------
-- Simple agent-facing roster tied to a confirmed dealership. Fully
-- internal, never customer-facing.
create table public.dealership_salespeople (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  added_by_agent_id uuid references public.agents (id),
  created_at timestamptz not null default now()
);

comment on table public.dealership_salespeople is
  'Agent-maintained roster of salesperson contacts per dealership. Internal '
  'only -- never read by any customer-facing page.';

create index dealership_salespeople_dealership_id_idx
  on public.dealership_salespeople (dealership_id);

-- ---------------------------------------------------------------------------
-- RLS -- service role only, same convention as every other internal-only
-- table in this codebase (listings, agents, cancellation_log, etc).
-- ---------------------------------------------------------------------------
alter table public.dealerships enable row level security;
alter table public.dealer_aliases enable row level security;
alter table public.dealership_salespeople enable row level security;
-- No policies on any of the three.

-- ---------------------------------------------------------------------------
-- confirm_dealer_alias_as_new
-- ---------------------------------------------------------------------------
-- Atomically creates the dealerships row and links the alias to it, so two
-- agents can't race to confirm the same alias into two different new
-- dealerships. Row-locks the alias first; raises if it's already confirmed
-- (same guard shape as switch_customer_search/admin_pause_search elsewhere
-- in this codebase). Merge-into-existing (linking an alias to an already-
-- confirmed dealership) doesn't need a function -- it's a single-row guarded
-- update from dealership-actions.ts, not a multi-table write.
create function public.confirm_dealer_alias_as_new(
  p_alias_id uuid,
  p_name text,
  p_city text,
  p_state text,
  p_agent_id uuid
)
returns public.dealer_aliases
language plpgsql
as $$
declare
  v_alias public.dealer_aliases;
  v_dealership_id uuid;
begin
  select * into v_alias
  from public.dealer_aliases
  where id = p_alias_id
  for update;

  if not found then
    raise exception 'dealer_aliases row % not found', p_alias_id;
  end if;

  if v_alias.dealership_id is not null then
    raise exception 'dealer alias % has already been confirmed', p_alias_id;
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'p_name is required';
  end if;

  insert into public.dealerships (name, city, state)
  values (btrim(p_name), nullif(btrim(coalesce(p_city, '')), ''), nullif(btrim(coalesce(p_state, '')), ''))
  returning id into v_dealership_id;

  update public.dealer_aliases
  set dealership_id = v_dealership_id,
      confirmed_at = now(),
      confirmed_by_agent_id = p_agent_id
  where id = p_alias_id
  returning * into v_alias;

  return v_alias;
end;
$$;

-- ---------------------------------------------------------------------------
-- One-time backfill: populate dealer_aliases from every distinct dealer
-- identity already sitting in listings, so the unconfirmed queue reflects
-- real existing data on day one instead of starting empty. Going forward,
-- ensureDealerAliasesForListings (wired into every sync call) keeps this
-- current -- no recurring job needed.
-- ---------------------------------------------------------------------------
insert into public.dealer_aliases (dealer_name, dealer_city, dealer_state)
select distinct dealer_name, dealer_city, dealer_state
from public.listings
where dealer_name is not null
on conflict (dealer_name, dealer_city_key, dealer_state_key) do nothing;
