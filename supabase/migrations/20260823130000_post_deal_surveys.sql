-- LEVRating Phase B: the post-deal survey. Scope decided 2026-08-23.

-- ---------------------------------------------------------------------------
-- customer_searches.purchased_qualifying_offer_id
-- ---------------------------------------------------------------------------
-- Real gap found during planning: markSearchPurchased(searchId, offerId)
-- takes offerId explicitly (its own comment explains why -- more than one
-- offer could theoretically be independently customer_accepted on the same
-- search, so guessing "the accepted offer" would be ambiguous), but that
-- offerId was never stored anywhere -- not on customer_searches, not on
-- purchase_status_log (search_id only). With no durable pointer, "which
-- offer was actually purchased" was unanswerable after the fact, which the
-- survey's dealership-resolution path needs. Set alongside purchased_at in
-- markSearchPurchased, cleared alongside it in revertPurchasedSearch --
-- mirrors that existing null-out behavior exactly.
alter table public.customer_searches
  add column purchased_qualifying_offer_id uuid references public.qualifying_offers (id);

comment on column public.customer_searches.purchased_qualifying_offer_id is
  'The specific qualifying_offers row that was actually purchased, set '
  'together with purchased_at. Was previously unrecorded anywhere -- see '
  'this migration''s header comment.';

-- ---------------------------------------------------------------------------
-- post_deal_surveys
-- ---------------------------------------------------------------------------
-- One row per purchased search, created by the daily cron 2+ days after
-- purchased_at, not by the customer -- this is what makes the /account
-- prompt card and the email link point at the same survey instance, and
-- the unique constraint on customer_search_id is the cron's own "already
-- sent" guard.
--
-- dealer_alias_id (never dealership_id) is the resolution target,
-- resolved once at row-creation time and never nullable -- the resolution
-- chain (purchased_qualifying_offer_id -> qualifying_offers.listing_id ->
-- listings.mc_dealer_id -> dealer_aliases, or a fresh dealer_aliases row
-- created on the fly for an off-lot offer with no listing_id) always
-- lands on a real dealer_aliases row, confirmed or not. Which dealership a
-- response counts toward is deliberately NOT stored here -- it's computed
-- live via dealer_alias_id -> dealer_aliases.dealership_id at read time,
-- same convention as Phase A's listing counts, so a response tied to an
-- alias confirmed after submission automatically starts counting toward
-- that dealership with no backfill needed.
--
-- All rating/comment columns are nullable at the DB level -- the row is
-- created empty by the cron and filled in only at submission, enforced by
-- the submit Server Action, not a DB not-null constraint. submitted_at
-- null means unsubmitted; once set, the response is locked (no editing
-- after), enforced the same way by the same Server Action's write guard.
create table public.post_deal_surveys (
  id uuid primary key default gen_random_uuid(),
  customer_search_id uuid not null unique references public.customer_searches (id) on delete cascade,
  qualifying_offer_id uuid not null references public.qualifying_offers (id),
  dealer_alias_id uuid not null references public.dealer_aliases (id),

  sent_at timestamptz not null default now(),
  submitted_at timestamptz,

  -- Dealership experience -- structured scoring only, no free text.
  dealership_availability_rating smallint
    check (dealership_availability_rating is null or dealership_availability_rating between 1 and 5),
  dealership_responsiveness_rating smallint
    check (dealership_responsiveness_rating is null or dealership_responsiveness_rating between 1 and 5),
  dealership_transparency_rating smallint
    check (dealership_transparency_rating is null or dealership_transparency_rating between 1 and 5),
  dealership_finance_pressure_rating smallint
    check (dealership_finance_pressure_rating is null or dealership_finance_pressure_rating between 1 and 5),
  dealership_professionalism_rating smallint
    check (dealership_professionalism_rating is null or dealership_professionalism_rating between 1 and 5),

  -- Agent feedback -- internal only, feeds performance review, never
  -- customer-facing.
  agent_recommend boolean,
  agent_comment text,

  -- LEVR Auto overall -- internal, doubles as a future testimonial source.
  levr_overall_rating smallint
    check (levr_overall_rating is null or levr_overall_rating between 1 and 5),
  levr_overall_comment text,

  created_at timestamptz not null default now()
);

comment on table public.post_deal_surveys is
  'One row per purchased search, created by the daily post-deal-survey '
  'cron (2+ days after purchased_at), not by the customer. dealer_alias_id '
  'is always resolvable and never null -- see this migration''s header '
  'comment for the full resolution chain and why dealership_id is '
  'deliberately not stored here.';

create index post_deal_surveys_dealer_alias_id_idx on public.post_deal_surveys (dealer_alias_id);

alter table public.post_deal_surveys enable row level security;
-- No policies. Service role only, same convention as every other table in
-- this codebase -- the customer-facing submission goes through a Server
-- Action with an explicit ownership check, not RLS.
