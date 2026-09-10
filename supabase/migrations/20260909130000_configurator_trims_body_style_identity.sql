-- Corrective follow-up to 20260909120000_configurator_datasets.sql.
--
-- configurator_trims' unique constraint omitted body_style, which is
-- genuinely part of a trim's identity in the source data -- not a
-- descriptive extra, the same reasoning already applied to drivetrain and
-- fuel_type in the original migration.
--
-- Found by the first real import, which failed on the constraint. Two
-- groups collide without body_style, and both are real, distinct vehicles
-- with different colors, seating, features and packages:
--
--   Toyota Corolla SE  2027 FWD Gas -- sedan AND hatchback
--   Toyota Corolla XSE 2027 FWD Gas -- sedan AND hatchback
--
-- Deduping or dropping either row would have silently discarded a real
-- vehicle a customer can buy, so the constraint is corrected instead.

alter table public.configurator_trims
  drop constraint configurator_trims_batch_id_make_model_trim_model_year_driv_key;

alter table public.configurator_trims
  add constraint configurator_trims_identity_key
  unique (batch_id, make, model, trim, model_year, drivetrain, fuel_type, body_style);

comment on table public.configurator_trims is
  'One row per configurator CSV row. drivetrain/fuel_type/body_style are '
  'part of the identity, not decoration -- the same trim name can describe '
  'several real builds with different option sets (e.g. Corolla SE 2027 '
  'exists as both a sedan and a hatchback, with different colors, seating '
  'and features).';
