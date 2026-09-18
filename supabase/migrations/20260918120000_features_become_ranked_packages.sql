-- Features become ranked packages (2026-09-18).
--
-- Features stop being a plain want/exclude/silence checklist and become a
-- fourth ranked category, identical in shape to exterior_color / interior /
-- seating / trim: an ordered "Your order" list plus explicit exclusions,
-- built from a pool a customer taps into rather than a set of independent
-- pills. The rankable ITEM becomes the package (packageName ?? name), not
-- the individual feature -- "Cold Weather Package" as one thing to rank,
-- not "Heated seats" and "Heated steering wheel" as two a customer could
-- split between want and exclude. See CLAUDE.md's "auto-select-all
-- redesign" and "ranked preferences" entries for why this shape (pool /
-- ranked / excluded, silence = no opinion) is already the house style for
-- every other category here.
--
-- TWO CONSTRAINTS DROP 'feature', NOT JUST ONE -- found by reading the
-- actual constraint definitions rather than trusting CLAUDE.md's prose
-- summary of them. search_option_selections_rank_shape (feature_exclusions
-- migration, 2026-09-14) governs the SHAPE (how rank_position/excluded
-- relate to question_kind); search_option_selections_question_kind_check
-- (ranked_preferences migration, 2026-09-14) separately governs the
-- allowed VALUES of question_kind itself, `check (question_kind in
-- ('ranked', 'preference', 'feature'))`. Tightening only the first and
-- leaving the second alone would still functionally block nothing --
-- nothing will ever write question_kind='feature' again after step 3 of
-- this build -- but it would leave the same stale-documentation problem
-- this migration exists to fix, just in the sibling constraint instead.
-- Both are updated together here for that reason.
--
-- Neither change is a functional unblock, for the same reason in both
-- cases: once the application writes question_kind='ranked' for
-- category='feature' rows (step 3 of this build, not this migration), the
-- EXISTING 'ranked' branch of rank_shape already accepts them correctly --
-- it has no category filter at all -- and 'ranked' is already a legal
-- question_kind value today. This migration is cleanup and correctness of
-- the constraints as documentation, not something later code depends on.
-- The 'preference' branch/value stays untouched in both constraints, same
-- as every prior migration on this table -- legacy, nothing writes it, not
-- worth rewriting again on the chance it's ever reintroduced.
--
-- SAFE TO REWRITE IN PLACE: search_option_selections holds ZERO rows in
-- production, INCLUDING zero category='feature' rows, independently
-- re-verified 2026-09-18 immediately before writing this migration (not
-- just trusted from the two prior migrations' own zero-row claims) --
-- there is nothing to migrate, backfill, or reinterpret.
--
-- rank_position stays smallint, excluded stays boolean not null default
-- false -- both already exist on this table from the ranked_preferences
-- migration (2026-09-14) and need no changes. The partial unique index
-- search_option_selections_rank_idx (search_id, category, rank_position)
-- where rank_position is not null already covers category='feature' rows
-- correctly by construction -- it has no category filter either, and a
-- ranked package genuinely needs its rank position unique within its own
-- category, same as every other ranked category.

alter table public.search_option_selections
  drop constraint if exists search_option_selections_rank_shape;

alter table public.search_option_selections
  add constraint search_option_selections_rank_shape check (
    -- Ranked: an order position, or an explicit refusal. Never both, never
    -- neither -- an option the customer ignored produces no row. Now the
    -- ONLY shape 'ranked' rows can take, feature/package rows included.
    (question_kind = 'ranked'
       and ((rank_position is not null and excluded = false)
            or (rank_position is null and excluded = true)))
    -- Preference: legacy, nothing writes it. Unchanged on purpose, same as
    -- every prior migration on this table.
    or (question_kind = 'preference'
       and rank_position is null and excluded = false)
  );

alter table public.search_option_selections
  drop constraint if exists search_option_selections_question_kind_check;

alter table public.search_option_selections
  add constraint search_option_selections_question_kind_check
    check (question_kind in ('ranked', 'preference'));

comment on column public.search_option_selections.question_kind is
  'Which answer shape this row records. ''ranked'' covers every category '
  'this app asks about today -- exterior colour, interior, seating, and '
  '(as of 2026-09-18) features/packages -- an ordered list plus explicit '
  'exclusions, silence meaning no opinion. ''preference'' is a legacy kind '
  'nothing writes anymore, retained only so the two check constraints on '
  'this column do not need rewriting again if a non-ranked preference '
  'question is ever reintroduced. ''feature'' existed 2026-09-09 through '
  '2026-09-18 and is no longer a legal value at all -- see the '
  'ranked_preferences and features_become_ranked_packages migrations for '
  'the two steps of that transition.';
