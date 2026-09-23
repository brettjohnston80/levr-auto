-- Adds a real vehicle identity to a dealer offer, for the redesigned offer
-- card (real photo + trim/color, replacing the current plain-text price-only
-- card on /account).
--
-- Why this is needed: qualifying_offers today carries dealer_name/
-- offer_price_cents/msrp_cents and an OPTIONAL listing_id -- nothing else
-- describing the vehicle itself. When an offer IS tied to a real synced
-- listing (agent picked one from the "pre-fill from a known listing"
-- dropdown in LogOfferForm), listings.trim/listings.color already give us
-- a real, verified vehicle description for free -- no new column needed
-- for that path. But most real dealer offers today are NOT listing-backed
-- (MarketCheck sync only covers a handful of make/models, and offers
-- routinely come from a freeform phone call or a parsed email/PDF reply
-- with no VIN in it at all -- confirmed via offer-parsing-actions.ts's own
-- tool schema, which extracts dealer_name/price/addons but never a vehicle
-- trim or color). For that majority case there is currently NO way to know
-- what color/trim the customer is even being offered, so there is nothing
-- honest to show as a "real vehicle photo" today.
--
-- These two columns are the same denormalized-snapshot pattern already
-- used throughout this schema (package_name/package_contents on
-- search_option_selections, msrp_cents itself on this very table) --
-- agent-entered at offer-log time (optionally pre-filled from a selected
-- listing, same as dealer_name/offer_price_cents/msrp_cents already are),
-- never live-joined against a listing that could later change. Both
-- nullable: an agent who doesn't know the exact color/trim yet (common on
-- a still-in-negotiation offer) leaves them blank, and the offer card
-- falls back to a generic silhouette placeholder -- same "never show a
-- fabricated real photo" discipline already established for Matchmaker's
-- VehicleDetailModal and the Toyota/Honda configurator color-photo gap.
--
-- Deliberately NOT a foreign key or a join-at-read-time computation: an
-- offer's vehicle identity is a fact about what the DEALER offered at that
-- moment, not a live pointer that should silently change if inventory
-- data is corrected or re-synced later.

alter table public.qualifying_offers
  add column vehicle_trim text,
  add column vehicle_exterior_color text;

comment on column public.qualifying_offers.vehicle_trim is
  'Denormalized snapshot of the trim being offered, agent-entered at log time '
  '(pre-filled from listings.trim when logged against a known listing). Never '
  'live-joined -- see migration header for why.';

comment on column public.qualifying_offers.vehicle_exterior_color is
  'Denormalized snapshot of the exterior color being offered, agent-entered at '
  'log time (pre-filled from listings.color when logged against a known '
  'listing). Feeds the offer card''s photo resolution (real listing color -> '
  'Toyota/Honda configurator stock photo for that color, when available -> '
  'generic silhouette placeholder). Never live-joined -- see migration header '
  'for why.';
