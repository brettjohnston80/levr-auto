-- Articles system, Phase 1: real schema + the seed data for the full
-- 12-month blog calendar (levr-auto-blog-calendar-2026.md), plus the
-- already-written September piece. Later phases (auto-drafting, an
-- agent review/approval UI, social auto-posting) are not part of this
-- migration -- this is schema + seed only.
--
-- Same RLS convention as every other table in this project: enabled, no
-- policies, service-role only. The public /articles pages read through
-- createAdminClient() with an explicit status='published' AND
-- published_at <= now() filter done server-side -- never a client-facing
-- read policy, and never trusted from a stored flag alone.
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  topic text not null,
  content text,
  status text not null default 'not_started'
    check (status in ('not_started', 'draft', 'approved', 'published')),
  scheduled_month date not null,
  published_at timestamptz,
  approved_at timestamptz,
  approved_by_agent_id uuid references public.agents (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.articles is
  'One row per planned/published blog article. published_at is the real '
  'publish gate (status=''published'' alone is not enough -- a row can be '
  'published-and-scheduled-in-the-future) -- same pattern as every other '
  'timestamp-gated feature in this app (delivered_at, finalized_at, etc).';

alter table public.articles enable row level security;

-- ---------------------------------------------------------------------------
-- Seed: the full 13-entry calendar from levr-auto-blog-calendar-2026.md.
--
-- September 2026's slot is the already-written "MSRP vs. Invoice Price"
-- piece (approved, scheduled to actually go live) -- this bumped "Top 10
-- New Cars of 2027" out of that slot per Brett's request; it's re-seeded
-- here as its own 13th row at September 2027 instead. The calendar doc
-- itself is updated in this same pass to match.
--
-- approved_by_agent_id resolves Brett's real agent row by email rather
-- than a hardcoded uuid, since no prior migration seeds agent-attributed
-- data and a wrong hardcoded id would silently create a dangling
-- reference if it didn't match this environment's actual agents.id.
insert into public.articles
  (slug, title, topic, content, status, scheduled_month, published_at, approved_at, approved_by_agent_id)
values
  (
    'msrp-vs-invoice-price',
    'MSRP vs. Invoice Price: What the Numbers Actually Mean',
    'MSRP vs. Invoice Price',
    $md$If you've spent any time researching how to buy a car, you've run into two numbers that get thrown around constantly: MSRP and invoice price. Dealers, forums, and "insider tips" articles all treat these as the key to a good deal. They're useful — but not in the way most people think.

## MSRP is the number that actually matters.

MSRP stands for Manufacturer's Suggested Retail Price — the sticker price the automaker recommends, printed right on the window sticker (officially called the Monroney label, and federally required on every new car). It's not just a suggestion pulled from thin air — it reflects the specific trim, options, and packages on that exact vehicle, which is why two of the "same" car on the same lot can have different MSRPs down to the dollar.

What makes MSRP genuinely useful, unlike almost every other number in car buying, is that it's public, fixed, and verifiable. It's printed on the car itself. It doesn't change based on who's asking or how good a negotiator they are. That makes it a real, honest baseline you can compare against — which is exactly why it's the number worth anchoring to.

It's also not a reflection of what the car is actually worth in the moment. Popular, high-demand vehicles sometimes sell above MSRP; slower-moving models often sell well below it. Where a specific car actually lands depends on real-time supply, demand, and how motivated a given dealer is to move it — which is exactly the kind of thing that's hard to know from the outside, and exactly what real negotiation is for.

## Invoice price sounds more useful than it actually is.

Invoice price is supposed to represent what the dealer paid the manufacturer for the car — and for years, "buy at invoice" was treated as the ultimate win. The catch: it's not actually what the dealer paid. Manufacturers pay dealers back through holdback, dealer cash, and volume incentives that never show up on that invoice number, which means a dealer can still profit meaningfully on a car sold "at invoice." It's a real number, just not the honest floor it's often made out to be.

## This is exactly why LEVR Auto's guarantee is built on MSRP, not invoice.

It's the one number in this whole process that's public, consistent, and impossible to quietly move — which makes it the right foundation for a real promise. If we can't bring you at least one real offer below MSRP, you get your $699 back. No guessing at holdback, no chasing a number that was never the real floor to begin with — just a fixed, honest baseline, and real work to beat it.$md$,
    'approved',
    date '2026-09-01',
    timestamptz '2026-09-01 05:01:00+00',
    now(),
    (select id from public.agents where email = 'bjohnston@levrauto.com' limit 1)
  ),
  (
    'how-dealer-markups-actually-work',
    'How Dealer Markups Actually Work — And How to Avoid Them',
    'How Dealer Markups Actually Work — And How to Avoid Them',
    null, 'not_started', date '2026-10-01', null, null, null
  ),
  (
    'holiday-car-buying-deals',
    'Holiday Car-Buying Deals: Worth Waiting For?',
    'Holiday Car-Buying Deals: Worth Waiting For?',
    null, 'not_started', date '2026-11-01', null, null, null
  ),
  (
    'end-of-model-year-deals',
    'End-of-Model-Year Deals: What''s Real and What''s Marketing',
    'End-of-Model-Year Deals: What''s Real and What''s Marketing',
    null, 'not_started', date '2026-12-01', null, null, null
  ),
  (
    'best-time-of-year-to-buy-a-new-car',
    'Best Time of Year (or Month) to Buy a New Car',
    'Best Time of Year (or Month) to Buy a New Car',
    null, 'not_started', date '2027-01-01', null, null, null
  ),
  (
    'tax-refund-season-car-buying',
    'Tax-Refund Season: Smart Ways to Use It Toward a Car',
    'Tax-Refund Season: Smart Ways to Use It Toward a Car',
    null, 'not_started', date '2027-02-01', null, null, null
  ),
  (
    'ev-prices-over-the-last-10-years',
    'EV Prices Over the Last 10 Years: What the Data Actually Shows',
    'EV Prices Over the Last 10 Years: What the Data Actually Shows',
    null, 'not_started', date '2027-03-01', null, null, null
  ),
  (
    'dealer-tactics-to-watch-for',
    '7 Dealer Tactics to Watch For When Buying New',
    '7 Dealer Tactics to Watch For When Buying New',
    null, 'not_started', date '2027-04-01', null, null, null
  ),
  (
    'best-3-row-suvs-of-2027',
    'Best 3-Row SUVs of 2027',
    'Best 3-Row SUVs of 2027',
    null, 'not_started', date '2027-05-01', null, null, null
  ),
  (
    'home-ev-charging-101',
    'Home EV Charging 101',
    'Home EV Charging 101',
    null, 'not_started', date '2027-06-01', null, null, null
  ),
  (
    'what-to-bring-to-a-test-drive',
    'What to Bring to a Test Drive: A Real Checklist',
    'What to Bring to a Test Drive: A Real Checklist',
    null, 'not_started', date '2027-07-01', null, null, null
  ),
  (
    'best-budget-new-cars-of-2027',
    'Best Budget New Cars of 2027',
    'Best Budget New Cars of 2027',
    null, 'not_started', date '2027-08-01', null, null, null
  ),
  (
    'top-10-new-cars-of-2027',
    'Top 10 New Cars of 2027',
    'Top 10 New Cars of 2027',
    null, 'not_started', date '2027-09-01', null, null, null
  );
