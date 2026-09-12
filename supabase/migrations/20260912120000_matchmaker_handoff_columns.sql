-- "Choose this car" checkout handoff, step 2 of 5: carry the Matchmaker's
-- own numbers onto the search a customer creates from a results card.
--
-- Today a customer who works through /matchmaker, finds a vehicle they like
-- and clicks through to intake arrives with nothing but make and model. The
-- price estimate and model year they were just looking at are lost at the
-- boundary, so nothing downstream -- the customer's own /account view, or
-- the agent picking the search up in /internal/outreach -- can tell which
-- specific vehicle the customer had in mind, or even which model year.
-- These two columns carry that context across.
--
-- DISPLAY AND REFERENCE ONLY. NEVER READ BY PRICING, PAYMENT OR GUARANTEE
-- LOGIC. This is the single most important thing to know about these
-- columns, so it is stated before anything else:
--
--   * The fee is FLAT_PRICE ($699, src/lib/vehicle-data.ts), built inline
--     into every Checkout Session via price_data. matchmaker_price_cents
--     must never influence what a customer is charged.
--   * The guarantee is assessed against the DEALER's MSRP on a real
--     qualifying offer (evaluateOfferGuaranteeContribution, guarantee.ts),
--     never against a researched estimate. Wiring this column into that
--     path would mean resolving a real customer's money against a number
--     no dealer ever quoted.
--
-- Both nullable with NO DEFAULT, and that is deliberate rather than lazy.
-- Most searches will legitimately never have these: a customer who types a
-- make/model straight into intake, an undecided "not sure yet" search whose
-- make/model an agent fills in later, and every row created by
-- switch_customer_search all have no Matchmaker vehicle behind them. NULL
-- is the honest representation of "this search did not come from a
-- Matchmaker card". A default would fabricate a price and a model year for
-- every one of them.
--
-- No backfill, for the same reason: these are for future writes only, and
-- there is no way to reconstruct which Matchmaker vehicle an existing
-- search came from -- that information never existed.

alter table public.customer_searches
  add column matchmaker_price_cents integer,
  add column matchmaker_model_year smallint;

comment on column public.customer_searches.matchmaker_price_cents is
  'The Matchmaker''s own researched price ESTIMATE for the vehicle the '
  'customer clicked through from, in integer cents (matching every other '
  '*_cents column in this schema). Display/reference only -- it is not a '
  'quote, not an offer, and nobody has committed to it. NEVER read by '
  'pricing, payment or guarantee logic: the fee is a flat $699 built inline '
  'per Checkout Session, and the guarantee resolves against a real dealer''s '
  'MSRP. NULL for any search that did not originate from a Matchmaker '
  'results card, which is most of them.';

comment on column public.customer_searches.matchmaker_model_year is
  'Model year of the Matchmaker vehicle the customer clicked through from. '
  'smallint to match vehicles.model_year and configurator_trims.model_year, '
  'the two researched datasets this value actually comes from -- note '
  'listings.year is integer, but that column is MarketCheck inventory data '
  'and is not the source here. '
  'Display/reference only, and specifically NOT a filter: /finalize''s trim '
  'picker derives its own years from real synced listings (buildTrimOptions, '
  'finalize-trims.ts, which splits trim options by model year as of '
  '2026-09-09) and must keep doing so. A customer who browsed a 2026 card '
  'is still free to finalize a 2027 once they see real inventory, so this '
  'column must never be used to constrain what they are offered. NULL for '
  'any search that did not originate from a Matchmaker results card.';
