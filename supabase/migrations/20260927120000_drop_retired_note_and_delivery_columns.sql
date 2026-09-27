-- Post-deploy cleanup (2026-09-27) -- DRAFT, NOT RUN. Brett reviews and runs
-- it in the Supabase SQL Editor for project couiovhducwytlckfgvo.
--
-- ⚠ RUN THIS FILE AS ONE TRANSACTION (it is wrapped in begin/commit).
--
-- Drops columns the live code (3e59c50, deployed 2026-09-26) no longer reads
-- or writes:
--   * qualifying_offers.customer_note, customer_note_updated_at and the
--     qualifying_offers_customer_note_length constraint -- replaced by
--     offer message threads (offer_messages).
--   * deal_progress.delivery_method -- replaced by
--     qualifying_offers.handoff_method.
--
-- Supabase Free has no automatic backups and a dropped column can't be
-- restored, so this:
--   1. re-runs both idempotent copies (catches anything written by the old
--      code between the earlier migrations and the deploy),
--   2. snapshots every non-null value into a small backup table first,
--   3. refuses to drop anything (raises, rolling the whole transaction back)
--      if any value still isn't carried over.
-- Production counts checked 2026-09-27, before writing this: 1 note (review
-- account, already in its thread) and 2 delivery_method rows (tester5,
-- tester7, both already matching handoff_method).

begin;

-- 1a. Notes -> first customer message (same statement as 20260926120000).
insert into public.offer_messages (qualifying_offer_id, author_type, author_customer_id, body, created_at)
select o.id, 'customer', s.customer_id, o.customer_note,
       coalesce(o.customer_note_updated_at, o.customer_activity_at, now())
from public.qualifying_offers o
join public.customer_searches s on s.id = o.customer_search_id
where o.customer_note is not null
  and btrim(o.customer_note) <> ''
  and not exists (
    select 1 from public.offer_messages m
    where m.qualifying_offer_id = o.id
      and m.author_type = 'customer'
      and m.body = o.customer_note
  );

update public.qualifying_offers o
set last_message_at = m.latest
from (
  select qualifying_offer_id, max(created_at) as latest
  from public.offer_messages
  group by qualifying_offer_id
) m
where m.qualifying_offer_id = o.id
  and (o.last_message_at is null or o.last_message_at < m.latest);

-- 1b. delivery_method -> handoff_method (same statement as 20260926130000).
update public.qualifying_offers o
set handoff_method = dp.delivery_method,
    handoff_method_set_at = coalesce(dp.updated_at, now())
from public.deal_progress dp
where dp.qualifying_offer_id = o.id
  and dp.delivery_method is not null
  and o.handoff_method is null;

-- 2. Snapshot of every value about to be dropped. Keep it until Brett is
--    satisfied, then: drop table public._backup_20260927_retired_columns;
create table public._backup_20260927_retired_columns (
  source text not null,          -- 'qualifying_offers' or 'deal_progress'
  row_id uuid not null,          -- qualifying_offers.id / deal_progress.qualifying_offer_id
  customer_note text,
  customer_note_updated_at timestamptz,
  delivery_method text,
  backed_up_at timestamptz not null default now()
);
alter table public._backup_20260927_retired_columns enable row level security;

insert into public._backup_20260927_retired_columns (source, row_id, customer_note, customer_note_updated_at)
select 'qualifying_offers', id, customer_note, customer_note_updated_at
from public.qualifying_offers
where customer_note is not null or customer_note_updated_at is not null;

insert into public._backup_20260927_retired_columns (source, row_id, delivery_method)
select 'deal_progress', qualifying_offer_id, delivery_method
from public.deal_progress
where delivery_method is not null;

-- 3. Safety check: abort (rolls back everything above) if anything would be lost.
do $$
declare
  v_uncopied_notes int;
  v_uncopied_delivery int;
begin
  select count(*) into v_uncopied_notes
  from public.qualifying_offers o
  where o.customer_note is not null
    and btrim(o.customer_note) <> ''
    and not exists (
      select 1 from public.offer_messages m
      where m.qualifying_offer_id = o.id and m.author_type = 'customer' and m.body = o.customer_note
    );

  select count(*) into v_uncopied_delivery
  from public.deal_progress dp
  join public.qualifying_offers o on o.id = dp.qualifying_offer_id
  -- Only an EMPTY handoff_method means the answer would be lost. A different
  -- value is a newer choice the customer made on the new column, so it wins.
  where dp.delivery_method is not null
    and o.handoff_method is null;

  if v_uncopied_notes > 0 or v_uncopied_delivery > 0 then
    raise exception 'Aborting cleanup: % note(s) not in a thread, % delivery_method row(s) with no handoff_method',
      v_uncopied_notes, v_uncopied_delivery;
  end if;
end $$;

-- 4. The drops.
alter table public.qualifying_offers drop constraint if exists qualifying_offers_customer_note_length;
alter table public.qualifying_offers drop column customer_note;
alter table public.qualifying_offers drop column customer_note_updated_at;
alter table public.deal_progress drop column delivery_method;

commit;
