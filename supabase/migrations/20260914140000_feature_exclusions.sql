-- Features gain a real third state: explicitly refused (2026-09-14).
--
-- Until now a feature was binary. A row existed (question_kind='feature',
-- excluded=false) meaning "wants it", or no row existed meaning nothing was
-- said. There was no way to record "explicitly does NOT want this", which is
-- a materially different instruction: an agent must never offer a refused
-- feature, whereas an unmentioned one is simply unremarkable. Same
-- distinction the ranked categories (colour / interior / seating / trim)
-- have carried since 20260914120000.
--
-- THE ONLY CHANGE IS DROPPING "and excluded = false" FROM THE FEATURE
-- BRANCH. rank_position stays NOT NULL-able -- i.e. still forced to null --
-- because no ordering concept applies to features at all. They are
-- independent adds: there is no meaningful answer to "do you want a heated
-- steering wheel more than a moonroof", which is exactly why features were
-- kept off the ranked model in the first place.
--
-- THE 'preference' BRANCH IS DELIBERATELY UNCHANGED. It is a legacy kind
-- that nothing writes today, retained so the constraint does not need
-- rewriting if a non-ranked preference question is ever reintroduced.
-- Loosening a branch we do not use would widen the surface for no benefit.
--
-- NOT AFFECTED, both checked rather than assumed:
--   * search_option_selections_rank_idx is partial, "where rank_position is
--     not null", so features never enter it whatever `excluded` says.
--   * Row identity is unique on (search_id, category, selection), so one
--     feature can never be simultaneously wanted and refused -- the two
--     states are mutually exclusive by construction, not by this check.
--
-- SAFE TO REPLACE IN PLACE: search_option_selections holds ZERO rows,
-- re-verified immediately before this migration was written (2026-09-14)
-- with a positive control, so the zero is a real count and not a silently
-- failed query. Loosening a check constraint cannot invalidate existing
-- rows in any case -- every row legal under the old rule stays legal under
-- the new one, so this is a widening, never a narrowing.

alter table public.search_option_selections
  drop constraint if exists search_option_selections_rank_shape;

alter table public.search_option_selections
  add constraint search_option_selections_rank_shape check (
    -- Ranked: an order position, or an explicit refusal. Never both,
    -- never neither -- an option the customer ignored produces no row.
    (question_kind = 'ranked'
       and ((rank_position is not null and excluded = false)
            or (rank_position is null and excluded = true)))
    -- Feature: never ranked, but now free to be wanted OR refused.
    or (question_kind = 'feature'
       and rank_position is null)
    -- Preference: legacy, nothing writes it. Unchanged on purpose.
    or (question_kind = 'preference'
       and rank_position is null and excluded = false)
  );

comment on column public.search_option_selections.excluded is
  'TRUE means the customer explicitly refused this option -- "not open to '
  'it". Materially different from simply not choosing it, which means no '
  'opinion and produces no row at all. Applies to BOTH ranked categories '
  'and features (features since 2026-09-14): for a ranked option it sits '
  'alongside a NULL rank_position, for a feature it is the only thing '
  'distinguishing a refusal from a request. An agent must never offer an '
  'excluded option; an unmentioned one is merely unremarkable.';
