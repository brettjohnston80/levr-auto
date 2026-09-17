-- Combination-preferences step (2026-09-17), part of the ranked-trim-union
-- redesign (see CLAUDE.md). Once colour/interior/feature answers validate
-- against the UNION of ranked trims rather than just #1, a customer's
-- separate per-category rankings no longer pin down one exact car -- "LE
-- #1, Ocean Gem #1, Cockpit Red leather #1" could describe a combination
-- that doesn't exist on any single real trim (Ocean Gem only on LE,
-- Cockpit Red leather only on XSE). This table is the customer's final
-- refinement pass across real (trim, exterior colour, interior, seating)
-- tuples -- ones that actually exist together on one real trim -- letting
-- them rank or exclude specific combinations once the per-category
-- answers alone can't disambiguate.
--
-- DENORMALIZED IDENTITY, NO FK -- same convention as search_trim_preferences
-- and search_option_selections on this exact schema, and the same reason:
-- a combination's identity is a historical fact about what the customer
-- was shown and chose among, and a later configurator batch re-import
-- must never retroactively rewrite or dangle it.
--
-- FEATURES ARE DELIBERATELY ABSENT FROM THIS TABLE. A combination is a
-- (trim, exterior colour, interior, seating) tuple only -- features never
-- fork it, per the explicit design constraint. Whether a given combination
-- includes/excludes/lacks a particular feature is display-only, computed
-- at render time from the trim's own feature options plus the customer's
-- existing search_option_selections feature answers; storing it here would
-- mean rewriting every combination row whenever an unrelated feature
-- answer changed.
create table public.search_combination_preferences (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.customer_searches (id) on delete cascade,

  -- Copied at write time, same reasoning as search_trim_preferences.trim /
  -- search_option_selections.selection: a historical record of what the
  -- customer chose among, not a live pointer into the current batch.
  trim text not null,
  -- Nullable for the same reason search_trim_preferences.model_year is --
  -- buildTrimOptions tolerates listings with no year.
  model_year smallint,
  -- Nullable: a category that was never a real question for the current
  -- ranked-trim union (categoryHasRealChoiceAcrossTrims false -- seating is
  -- the common case) contributes a single implicit "no preference" value,
  -- stored here as NULL rather than inventing a placeholder string.
  exterior_color text,
  interior text,
  seating text,

  rank_position smallint,
  excluded boolean not null default false,
  created_at timestamptz not null default now(),

  -- Same mutually-exclusive shape as search_trim_preferences_rank_shape /
  -- search_option_selections_rank_shape: ranked XOR excluded, no third
  -- state, an untouched combination produces no row at all.
  constraint search_combination_preferences_rank_shape check (
    (rank_position is not null and excluded = false)
    or (rank_position is null and excluded = true)
  ),

  -- Postgres treats NULL <> NULL in a unique constraint -- without these,
  -- two rows both meaning "no seating preference" on the same trim+colour+
  -- interior would never collide, silently allowing duplicate answers for
  -- the exact same real combination. Same pattern as
  -- search_trim_preferences.model_year_key / dealer_aliases.dealer_city_key.
  model_year_key smallint generated always as (coalesce(model_year, -1)) stored,
  exterior_color_key text generated always as (coalesce(exterior_color, '')) stored,
  interior_key text generated always as (coalesce(interior, '')) stored,
  seating_key text generated always as (coalesce(seating, '')) stored,

  -- One statement per real combination per search.
  unique (search_id, trim, model_year_key, exterior_color_key, interior_key, seating_key)
);

comment on table public.search_combination_preferences is
  'The customer''s ranked/excluded preferences over specific real (trim, '
  'exterior colour, interior, seating) combinations for one search -- the '
  'final refinement pass once per-category rankings alone can''t pin down '
  'one exact car. Additive alongside search_trim_preferences and '
  'search_option_selections, which stay the per-category detail. Features '
  'are deliberately not part of a combination''s identity -- see the table '
  'header comment.';

-- Ranks must be unique within a search. Partial for the same reason as
-- search_trim_preferences_rank_idx: excluded rows all carry NULL.
create unique index if not exists search_combination_preferences_rank_idx
  on public.search_combination_preferences (search_id, rank_position)
  where rank_position is not null;

-- Every read is "all combination preferences for this search", for the
-- agent view and for rendering the customer's own saved answers back.
create index if not exists search_combination_preferences_search_idx
  on public.search_combination_preferences (search_id);

-- ---------------------------------------------------------------------------
-- RLS -- service role only, zero policies, matching search_trim_preferences
-- and search_option_selections. The customer never writes this directly:
-- finalize-actions.ts checks ownership on the RLS-subject user client and
-- performs the write through createAdminClient().
-- ---------------------------------------------------------------------------
alter table public.search_combination_preferences enable row level security;
-- No policies.
