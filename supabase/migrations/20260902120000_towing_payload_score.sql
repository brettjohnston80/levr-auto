-- Adds the Towing & Payload dimension, replacing Resale Value as the
-- rankable "what matters most" priority for Truck/SUV/Cargo Van only
-- (decided 2026-09-02). Resale Value stays computed for every vehicle
-- regardless of body style -- which 9 dimensions get OFFERED per vehicle
-- type is a UI-layer decision (matchmaker-data.ts), not a data-layer one.
--
-- Deliberately NULLABLE, not "not null" like the other 8 score columns --
-- flagged explicitly, not silently decided either way. The vehicles table
-- already has 1,601 live rows (the currently-promoted batch) computed by
-- the pre-towing-payload pipeline; those rows genuinely have no value for
-- a dimension that didn't exist yet when they were scored. A straight
-- "not null" add would fail against that existing data unless a value
-- were fabricated or backfilled from a formula not yet fully confirmed
-- against the real pipeline. Every batch imported by the updated
-- pipeline (data/matchmaker_scoring_pipeline.py) will populate this for
-- every row in practice, same as the other 9 -- just not enforced as a
-- hard DB constraint against historical data that predates it.
alter table public.vehicles
  add column towing_payload_score numeric(5, 2);

comment on column public.vehicles.towing_payload_score is
  'Equal-weight average of towing_capacity_lbs and payload_capacity_lbs, '
  'using whichever is available -- computed for every vehicle regardless '
  'of body style, but only offered as a rankable "what matters most" '
  'priority in the UI for Truck/SUV/Cargo Van (see matchmaker-data.ts). '
  'Null on rows from batches imported before this column existed.';
