-- Offer add-ons: the amount must be positive (Brett, 2026-10-17).
--
-- The app already refuses an add-on of $0 or less (logOfferAddon,
-- logQualifyingOffer) and the AI offer parser drops such lines; this puts
-- the same rule in the database, so a negative add-on can never be stored
-- by any other path. 0 rows violate it (checked 2026-10-17: the table is
-- empty).

alter table public.offer_addons
  add constraint offer_addons_amount_positive check (amount_cents > 0);
