-- Ranked preferences replace the three-way priority scale (2026-09-14).
--
-- Tester feedback: must_have / like_to_have / open_to asks the customer to
-- rate each option in isolation, which is not how anyone actually chooses a
-- colour. They have an order of preference, and usually a couple they would
-- actively refuse. This models that directly: an ordered list, plus explicit
-- exclusions, plus silence for everything they did not feel strongly about.
--
-- SCOPE: exterior_color, interior and seating become ranked. FEATURES ARE
-- DELIBERATELY UNCHANGED -- they stay a yes/no checklist, because "do you
-- want a heated steering wheel" has no meaningful ordering against "do you
-- want a moonroof"; they are independent adds, not competing choices.
--
-- WHY rank_position AND NOT rank. `rank` is a built-in Postgres ordered-set
-- aggregate. It is legal as a column name, but a bare `rank` in a select
-- list is ambiguous enough that PostgREST already tripped over it during
-- the pre-migration audit (2026-09-13), returning "WITHIN GROUP is required
-- for ordered-set aggregate rank". Every read of this column goes through
-- PostgREST, so the ambiguity sits directly in the hot path. rank_position
-- costs nothing and removes the question entirely.
--
-- SAFE TO REWRITE IN PLACE: search_option_selections holds ZERO rows in
-- production (verified 2026-09-14 with a positive control, so the zero is a
-- real count and not a silently-failed query). There is nothing to migrate,
-- back-fill or reinterpret, which is why priority can simply be dropped
-- rather than dual-written.

-- ---------------------------------------------------------------------------
-- search_option_selections: priority -> rank_position + excluded
-- ---------------------------------------------------------------------------

-- The old shape constraint pairs question_kind with priority; it has to go
-- before priority does.
alter table public.search_option_selections
  drop constraint if exists search_option_selections_priority_shape;

alter table public.search_option_selections
  drop column if exists priority;

alter table public.search_option_selections
  add column if not exists rank_position smallint,
  add column if not exists excluded boolean not null default false;

-- 'ranked' is a THIRD kind, not a rename of 'preference'. Keeping the kinds
-- distinct is what lets the shape constraint below stay enforceable: a
-- ranked row and a feature row have genuinely different required fields, and
-- collapsing them would mean no constraint could tell a valid row from a
-- half-populated one. 'preference' is retained in the check for now so the
-- constraint does not have to be rewritten again if a non-ranked preference
-- question is ever reintroduced; nothing writes it today.
-- The original question_kind check was declared inline, so Postgres named
-- it automatically. Rather than GUESS that name -- and silently leave the
-- old two-value constraint in place if the guess is wrong, which would
-- reject every 'ranked' row -- find it by its definition and drop it.
-- Loops rather than selecting one row, and excludes the shape constraint
-- added below by name, so re-running this migration is safe: a second run
-- finds and drops whatever it created the first time before recreating it,
-- instead of failing on "constraint already exists".
do $$
declare
  con_name text;
begin
  for con_name in
    select conname
    from pg_constraint
    where conrelid = 'public.search_option_selections'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%question_kind%'
      and conname <> 'search_option_selections_rank_shape'
  loop
    execute format(
      'alter table public.search_option_selections drop constraint %I', con_name
    );
  end loop;
end $$;

alter table public.search_option_selections
  add constraint search_option_selections_question_kind_check
    check (question_kind in ('ranked', 'preference', 'feature'));

-- A row exists ONLY because the customer said something about that option:
-- they ranked it, or they refused it. Anything they left alone has no row at
-- all, so "no opinion" needs no third state and can never be confused with
-- "ranked last". Features carry neither field.
alter table public.search_option_selections
  drop constraint if exists search_option_selections_rank_shape;

alter table public.search_option_selections
  add constraint search_option_selections_rank_shape check (
    (question_kind = 'ranked'
       and ((rank_position is not null and excluded = false)
            or (rank_position is null and excluded = true)))
    or (question_kind = 'feature'
       and rank_position is null and excluded = false)
    or (question_kind = 'preference'
       and rank_position is null and excluded = false)
  );

-- Ranks are positions in a list, so two options cannot share one. Partial,
-- because excluded rows all carry rank_position null and would otherwise
-- collide with each other.
create unique index if not exists search_option_selections_rank_idx
  on public.search_option_selections (search_id, category, rank_position)
  where rank_position is not null;

comment on column public.search_option_selections.rank_position is
  '1-based position in the customer''s ranked list for this category, or '
  'NULL when the option was explicitly excluded. Named rank_position rather '
  'than rank because a bare `rank` is ambiguous with Postgres''s ordered-set '
  'aggregate of the same name and PostgREST chokes on it in a select list.';

comment on column public.search_option_selections.excluded is
  'TRUE means the customer explicitly refused this option -- "not open to '
  'it". Materially different from simply not ranking it, which means no '
  'opinion and produces no row at all. An agent must never offer an '
  'excluded option; an unranked one is merely unremarkable.';

-- ---------------------------------------------------------------------------
-- search_trim_preferences
-- ---------------------------------------------------------------------------
-- Trim ranking lives in its own table rather than as another
-- search_option_selections category, for three reasons that are structural
-- rather than stylistic:
--
--   1. A trim option is identified by trim AND MODEL YEAR. "LE 2026" and
--      "LE 2027" are different real choices with different inventory and
--      different prices -- buildTrimOptions has keyed on trim+year since
--      2026-09-09 precisely because collapsing them was misleading.
--      search_option_selections.selection is a single text column with no
--      room for the year.
--   2. Rows in search_option_selections are validated at write time against
--      configurator_options for the chosen trim. A trim is not an option
--      row; it is the thing that SELECTS which option rows apply, so it has
--      nothing to validate against in that table.
--   3. search_option_selections.category deliberately mirrors
--      configurator_options.category so the two stay joinable (see that
--      table's own comment). 'trim' is not a configurator_options category,
--      and adding it would quietly break that stated invariant.
create table if not exists public.search_trim_preferences (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.customer_searches (id) on delete cascade,

  -- The inventory-derived trim as shown to the customer, copied at write
  -- time. Denormalized on purpose, same reasoning as the package fields in
  -- search_option_selections: this is a historical record of what the
  -- customer chose from, and must not shift if a later dataset import
  -- renames or drops the trim.
  trim text not null,
  -- Nullable because buildTrimOptions tolerates listings with no year
  -- (TrimOption.year is `number | null`); a trim option genuinely can exist
  -- without one, and rejecting that here would make such a trim unrankable.
  model_year smallint,

  rank_position smallint,
  excluded boolean not null default false,

  -- Which researched configurator build this trim resolved to, when it
  -- resolved at all. NULL is the common, expected case: 34 of 36 makes have
  -- no configurator data, and even within Toyota/Honda a trim only matches
  -- when it resolves to EXACTLY ONE candidate. Recorded so an agent can see
  -- whether the customer's #1 was a researched build or an inventory-only
  -- string. No FK: configurator_trims rows belong to a batch, and promoting
  -- a new batch would otherwise dangle or silently repoint a historical
  -- answer -- the same reasoning that keeps search_option_selections
  -- FK-free.
  configurator_trim_id uuid,

  created_at timestamptz not null default now(),

  constraint search_trim_preferences_rank_shape check (
    (rank_position is not null and excluded = false)
    or (rank_position is null and excluded = true)
  ),

  -- One statement per trim option per search. Year is part of the identity,
  -- so ranking "LE 2026" does not prevent separately ranking "LE 2027".
  --
  -- Keyed through a generated column because Postgres treats NULL <> NULL
  -- in a unique constraint: a plain unique(search_id, trim, model_year)
  -- would happily allow the SAME unknown-year trim to be ranked twice.
  -- Same pattern, and the same reason, as dealer_aliases' dealer_city_key /
  -- dealer_state_key.
  model_year_key smallint generated always as (coalesce(model_year, -1)) stored,

  unique (search_id, trim, model_year_key)
);

comment on table public.search_trim_preferences is
  'The customer''s ranked trim preferences for one search, in the order they '
  'want them searched for. Only the #1 ranked trim drives which configurator '
  'colour/feature questions are asked; the rest of the list is the agent''s '
  'fallback search order when the top choice is not in real inventory.';

-- Ranks must be unique within a search. Partial for the same reason as
-- above: excluded rows all carry NULL.
create unique index if not exists search_trim_preferences_rank_idx
  on public.search_trim_preferences (search_id, rank_position)
  where rank_position is not null;

-- Every read is "all trim preferences for this search", for the agent view
-- and for rendering the customer's own saved answers back to them.
create index if not exists search_trim_preferences_search_idx
  on public.search_trim_preferences (search_id);

-- ---------------------------------------------------------------------------
-- RLS -- service role only, zero policies, matching search_option_selections
-- and every other internal table here. The customer never writes this
-- directly: finalize-actions.ts checks ownership on the RLS-subject user
-- client and performs the write through createAdminClient().
-- ---------------------------------------------------------------------------
alter table public.search_trim_preferences enable row level security;
-- No policies.
