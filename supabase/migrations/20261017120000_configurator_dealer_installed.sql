-- Configurator options: dealer-installed flag (Brett, 2026-10-17; proposal
-- docs/plans/dealer-installed-options-2026-10-16.md).
--
-- true = the item is installed by the dealer (or port), not the factory:
-- GM's "LPO" items, and every option in a package GM marks dealer-installed.
-- Set only by the configurator import's tested rule; false for everything
-- else, including every row imported before this column existed (live
-- batches pick it up when re-imported). Other makes get an explicit marker
-- from a later Cowork pass; nothing is inferred from words like "accessory".
--
-- configurator_options keeps its existing lock: RLS on, no policies, so only
-- the service role reads or writes it. This column adds no policy or grant.

alter table public.configurator_options
  add column dealer_installed boolean not null default false;

comment on column public.configurator_options.dealer_installed is
  'true = installed by the dealer/port, not the factory (GM LPO items and GM '
  'dealer-installed packages, set by the import rule). Shown as a '
  '"Dealer-installed" tag to agents and customers. Default false.';
