-- Ranking-indicator (Green/Yellow/Red/Gray) data layer, part of the
-- results-card redesign approved 2026-09-02 (see
-- data/matchmaker-duplicate-investigation-and-grouping-plan-2026-09-02.md,
-- Part 3). A dimension score of exactly 50 is ambiguous on its own -- it
-- means EITHER "no underlying data at all" (the pipeline's universal
-- floor, see matchmaker_scoring_pipeline.py) OR "real data, but
-- genuinely tied for worst in its body-style class" (a legitimate score,
-- not a gap). The UI needs to render these two cases differently (Gray
-- "no data" vs. a real Red rating), and that determination has to be made
-- from the same raw spec column(s) the score itself is built from -- so
-- it's computed once, offline, in the pipeline (compute_has_data_flags),
-- not re-derived (and risked drifting) in application code. See never
-- infer "has data" from the score value alone anywhere in the frontend.
--
-- Nullable, same reasoning as towing_payload_score's migration
-- (20260902120000_towing_payload_score.sql) -- the two already-promoted
-- batches (and the currently-live one) predate this column and have
-- nothing to backfill from. Only a new import (once run against this
-- migration) will populate all 10 for its own rows.
alter table public.vehicles
  add column safety_has_data boolean,
  add column comfort_has_data boolean,
  add column cargo_has_data boolean,
  add column fuel_economy_has_data boolean,
  add column reliability_has_data boolean,
  add column tech_features_has_data boolean,
  add column price_value_has_data boolean,
  add column resale_value_has_data boolean,
  add column performance_has_data boolean,
  add column towing_payload_has_data boolean;

comment on column public.vehicles.safety_has_data is
  'Whether safety_score reflects real nhtsa_overall_stars data (true) or the universal missing-data floor (false/null). Never infer this from safety_score alone -- a score of exactly 50 is ambiguous between the two.';
comment on column public.vehicles.comfort_has_data is
  'Whether comfort_score reflects real legroom/headroom data (true) or the universal missing-data floor (false/null).';
comment on column public.vehicles.cargo_has_data is
  'Whether cargo_score reflects real bed_length_ft (Truck) or cargo_volume_seats_up_cuft (everyone else) data (true), or the universal missing-data floor (false/null).';
comment on column public.vehicles.fuel_economy_has_data is
  'Whether fuel_economy_score reflects real epa_combined_mpg/range_mi data (true) or the universal missing-data floor (false/null).';
comment on column public.vehicles.reliability_has_data is
  'Whether reliability_score reflects a real reliability_rating (true) or the universal missing-data floor (false/null).';
comment on column public.vehicles.tech_features_has_data is
  'Whether tech_features_score reflects a real tech_score (true) or the universal missing-data floor (false/null).';
comment on column public.vehicles.price_value_has_data is
  'Whether price_value_score reflects a real true_starting_price (true) or the universal missing-data floor (false/null).';
comment on column public.vehicles.resale_value_has_data is
  'Whether resale_value_score reflects a real resale_depreciation_pct (true) or the universal missing-data floor (false/null).';
comment on column public.vehicles.performance_has_data is
  'Whether performance_score reflects a real zero_to_60_sec (true) or the universal missing-data floor (false/null) -- matches the 2026-08-30 pipeline fix where a missing 0-60 floors the score regardless of the is_performance_trim flag.';
comment on column public.vehicles.towing_payload_has_data is
  'Whether towing_payload_score reflects real towing_capacity_lbs/payload_capacity_lbs data (true) or the universal missing-data floor (false/null).';
