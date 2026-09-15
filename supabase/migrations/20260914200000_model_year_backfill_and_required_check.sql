-- Model-year redesign, Step 6 of 6: backfill the last year-less searches,
-- then add the database backstop that makes "a search with a vehicle has a
-- committed model year" hold at the storage layer (2026-09-14).
--
-- REVIEWED BY CLAUDE, RUN BY BRETT in the Supabase SQL Editor -- standard
-- workflow. Written as ONE transaction on purpose: if the pre-flight check
-- below finds anything unexpected, nothing is written at all.
--
-- ---------------------------------------------------------------------------
-- ⚠ WHEN TO RUN THIS -- ALL THREE MUST BE TRUE
-- ---------------------------------------------------------------------------
-- 1. Commits e614e38 and bc20f3a are LIVE IN PRODUCTION (not just pushed).
--    Every write path that sets a vehicle now also sets model_year: intake,
--    updateSearchVehicle, all three switch paths, finalizeUndecidedSearch,
--    finalizeSearchByAgent, and the tester seed route. A constraint that
--    lands before that code would reject writes the old code still makes.
--
-- 2. AT LEAST 24 HOURS HAVE PASSED SINCE e614e38 WENT LIVE. A $100 switch
--    Checkout Session created BEFORE that deploy carries no new_model_year
--    in its metadata, and the Stripe webhook deliberately completes such a
--    switch with a NULL year (payment has already been taken, so refusing is
--    not an option). Once this constraint exists, that same webhook insert
--    would FAIL -- the customer paid $100 and the switch would not happen.
--    Stripe Checkout Sessions expire 24 hours after creation by default, so
--    waiting 24h past the deploy guarantees no such session can still be
--    completed.
--
-- 3. The pre-flight SELECT below (run it on its own first) returns exactly
--    the 6 tester Camry rows listed, and nothing else.
--
-- ---------------------------------------------------------------------------
-- PRE-FLIGHT -- run this alone first and check the result
-- ---------------------------------------------------------------------------
--   select id, make, model, model_year, search_status
--   from public.customer_searches
--   where make is not null and model_year is null;
--
-- Expected (verified 2026-09-14): exactly these 6 rows, all Toyota Camry, all
-- on @levrauto-test.invalid tester accounts (tester1, 3, 4, 5, 6, 7):
--   707704e1-b036-4774-a31b-3477d97e51f2  awaiting_finalization
--   18d3d340-a118-4f2f-8eca-185376bdb55d  searching
--   580a05d8-98d7-48a4-86ed-1de3ac1da0b9  searching
--   3b66853a-b5d7-4fcb-95c9-241f8431ce4b  searching
--   2c2b4091-dbe1-4f15-8837-e1cc70db722e  paused
--   338c7619-5544-49e2-b0f5-710c30d8aaa3  purchased
-- If anything else appears, STOP: a real search reached the database
-- without a year after the redesign shipped, and that needs investigating,
-- not backfilling.

begin;

-- ---------------------------------------------------------------------------
-- 1. Backfill
-- ---------------------------------------------------------------------------
-- 2026 is not a guess: the live researched dataset offers Toyota Camry in
-- 2026 ONLY, and every synced Camry listing is 2026 (330 of 330). These are
-- pre-requirement tester rows, so there is no customer intent to preserve.
--
-- Targeted by id AND guarded by make/model/model_year, so this can only ever
-- touch the six rows named above, only while they are still year-less, and
-- is a harmless no-op if re-run.
update public.customer_searches
set model_year = 2026
where id in (
    '707704e1-b036-4774-a31b-3477d97e51f2',
    '18d3d340-a118-4f2f-8eca-185376bdb55d',
    '580a05d8-98d7-48a4-86ed-1de3ac1da0b9',
    '3b66853a-b5d7-4fcb-95c9-241f8431ce4b',
    '2c2b4091-dbe1-4f15-8837-e1cc70db722e',
    '338c7619-5544-49e2-b0f5-710c30d8aaa3'
  )
  and make = 'Toyota'
  and model = 'Camry'
  and model_year is null;

-- ---------------------------------------------------------------------------
-- 2. Refuse to continue if ANY year-less vehicle row remains
-- ---------------------------------------------------------------------------
-- Adding the constraint would fail on such a row anyway, but with a generic
-- error. This names the problem and rolls the backfill back with it, so a
-- partial state (backfilled but no constraint) can never be left behind.
do $$
declare
  remaining integer;
begin
  select count(*) into remaining
  from public.customer_searches
  where make is not null and model_year is null;

  if remaining > 0 then
    raise exception
      'Step 6 aborted: % customer_searches row(s) still have a make but no model_year. Resolve them before adding the constraint.',
      remaining;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. The database backstop
-- ---------------------------------------------------------------------------
-- Third layer of the same rule, mirroring the contact-channel pattern
-- (20260914160000): the client never offers a year-less vehicle, the server
-- refuses one on every path, and this catches the NEXT write path that
-- forgets -- which is exactly how year-less rows happened before.
--
-- "make is null" is allowed on purpose: an undecided search ("not sure yet"
-- intake) has no vehicle yet, so it legitimately has no year. The moment a
-- make is set, a year must be set with it.
alter table public.customer_searches
  add constraint customer_searches_model_year_required
  check (make is null or model_year is not null);

comment on constraint customer_searches_model_year_required on public.customer_searches is
  'A search with a vehicle must commit to a model year (model-year redesign, 2026-09-14). '
  'Undecided searches (make is null) are exempt until a vehicle is chosen. Backstop under '
  'client- and server-side enforcement on every write path; see CLAUDE.md "Model year is a '
  'required commitment". Consciously reverses the 2026-09-12 display-only year decision.';

commit;
