-- Card/modal ranking-indicator redesign (approved 2026-09-02, see
-- data/matchmaker-full-indicator-list-plan-2026-09-02.md) needs a real
-- per-vehicle data point to display alongside each dimension's
-- Green/Yellow/Red/Gray indicator -- for Cargo Space on a Truck, that's
-- the vehicle's actual bed length ("X ft bed"), not the cargo_score
-- number itself.
--
-- bed_length_ft was never a stored column before this -- confirmed by
-- reading both this table's own definition (20260830120000_vehicles_dataset.sql)
-- and matchmaker_scoring_pipeline.py directly: the raw value has always
-- been a real, well-sourced input (93.7% Truck coverage, confirmed again
-- against the current scored CSV: 179/191), but it was only ever read by
-- the offline Python pipeline to COMPUTE cargo_score/cargo_has_data for
-- Trucks -- the raw figure itself was discarded after scoring, never
-- passed through to the app. This column is what makes it persist.
--
-- Nullable, same reasoning as every other column added to this
-- already-live table (towing_payload_score, the *_has_data columns) --
-- existing rows in already-promoted batches predate this and have
-- nothing to backfill from. No pipeline re-run needed for the next
-- import: the raw bed_length_ft values are already present in the
-- currently-committed scored CSV (data/matchmaker-vehicle-dataset-2026-v19-scored-hasdata.csv),
-- they just weren't mapped into an insert before now -- see the paired
-- import-route change in the same commit as this migration.
alter table public.vehicles
  add column bed_length_ft numeric;

comment on column public.vehicles.bed_length_ft is
  'Truck bed length in feet, sourced from the raw dataset -- used to compute cargo_score/cargo_has_data for Trucks (see matchmaker_scoring_pipeline.py) and, since 2026-09-02, also displayed directly as the Cargo Space dimension''s data point on Truck results cards ("X ft bed"). Null for every non-Truck body style and for the 12 real Ram Chassis Cab rows, which ship with no factory bed at all.';
