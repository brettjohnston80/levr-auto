-- Phase 1 of the ranked-trim colour/interior/feature redesign (2026-09-16).
--
-- WHY THIS COLUMN EXISTS. Once a colour/interior/feature answer can be
-- valid against ANY of the customer's ranked trims (not just the #1),
-- "which trim(s) actually offer this" stops being a fact `configuratorTrimId`
-- alone can carry -- an agent reading this row has no way to tell whether
-- the customer's ranked colour is buildable on their #1 choice specifically
-- or only on a lower-ranked fallback, without this.
--
-- DENORMALIZED, NEVER FK'D OR LIVE-JOINED -- same convention as
-- package_name / package_price_cents / package_contents on this exact
-- table, and for the same reason (see this table's original migration,
-- 20260909140000): an option row belongs to a batch, and promoting a new
-- batch must never retroactively change what a customer already answered.
-- If a later re-import narrows or widens which trims offer a colour, this
-- column must keep saying what was true the moment the customer answered,
-- not what's true today. Populated once, at write time
-- (writeConfiguratorSelections, phase 3), from whichever of the customer's
-- ranked-and-resolved trims genuinely carried a matching, non-'unavailable'
-- option row at that moment.
--
-- Nullable, no default: null is the correct value for every row written
-- before this column existed, and there's no sane default to backfill --
-- re-deriving it after the fact would mean joining against TODAY's
-- configurator_options, which is exactly the drift this column exists to
-- avoid.
alter table public.search_option_selections
  add column available_on_trims text[];

comment on column public.search_option_selections.available_on_trims is
  'Which of the customer''s ranked trims (by display label, e.g. "XSE 2026") '
  'genuinely offered this option at the moment it was saved. Null for rows '
  'written before this column existed. Never FK''d or re-derived from a live '
  'join -- a later configurator batch re-import must not retroactively '
  'rewrite what was true when the customer answered, same reasoning as '
  'package_name/package_price_cents/package_contents on this table.';
