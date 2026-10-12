-- Agent dashboard Phase 1, Step 10: backfill. CHANGES REAL ROWS. Run the preview first.
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (section 6, and section 10 Step 10).
--
-- One transaction. Uses the documented flag route (levr.agent_admin / levr.assignment, both
-- transaction-local and switched off before commit); no trigger is dropped.
-- Every part skips test accounts via is_test_customer() (@levrauto-test.invalid,
-- @levrauto.invalid): tester1-11, the review account and the verification account are never
-- touched. Nothing here sends email: emails are only sent by app code, and no trigger on these
-- tables calls out.
--
--   10a. Link each agent to their login (auth_user_id, by case-insensitive email).
--        Brett: role admin, kept in rotation until other agents exist.
--   10b. Assign every paid, not-yet-assigned, non-test search to Brett (method 'backfill'),
--        with assigned_at = paid_at, and a search_assignments history row each.
--   10c. last_customer_message_at on offers and general threads, from offer_messages (exact).
--   10d. dealer_alias_id on offers that link a listing, from the listing's dealer identity.
--   10e. Activity history rebuilt ONLY from rows that already record the agent (Q9: nothing
--        inferred), each marked details.backfilled = true with its source table and id.

begin;
select set_config('levr.agent_admin', 'on', true);
select set_config('levr.assignment', 'on', true);

-- 10a ---------------------------------------------------------------------------------------
update public.agents a set auth_user_id = u.id
from auth.users u
where lower(u.email) = lower(a.email) and a.auth_user_id is null;

update public.agents set role = 'admin', in_rotation = true
where lower(email) = 'bjohnston@levrauto.com';

-- 10b ---------------------------------------------------------------------------------------
with brett as (select id from public.agents where lower(email) = 'bjohnston@levrauto.com'),
targets as (
  select s.id, coalesce(s.paid_at, s.created_at) as at
  from public.customer_searches s
  where s.paid_at is not null and s.assigned_agent_id is null
    and not public.is_test_customer(s.customer_id)
),
upd as (
  update public.customer_searches s set assigned_agent_id = (select id from brett), assigned_at = t.at
  from targets t where s.id = t.id
  returning s.id
)
insert into public.search_assignments (search_id, agent_id, method, reason)
select id, (select id from brett), 'backfill', 'Phase 1 backfill: sole agent' from upd;

-- 10c ---------------------------------------------------------------------------------------
update public.qualifying_offers o set last_customer_message_at = m.latest
from (select qualifying_offer_id, max(created_at) as latest from public.offer_messages
      where author_type = 'customer' and qualifying_offer_id is not null group by qualifying_offer_id) m,
     public.customer_searches s
where m.qualifying_offer_id = o.id and s.id = o.customer_search_id
  and not public.is_test_customer(s.customer_id);

update public.general_threads g set last_customer_message_at = m.latest
from (select customer_id, max(created_at) as latest from public.offer_messages
      where author_type = 'customer' and qualifying_offer_id is null group by customer_id) m
where m.customer_id = g.customer_id
  and not public.is_test_customer(g.customer_id);

-- 10d ---------------------------------------------------------------------------------------
update public.qualifying_offers o set dealer_alias_id = da.id
from public.listings l, public.dealer_aliases da, public.customer_searches s
where o.listing_id = l.id and o.dealer_alias_id is null
  and da.dealer_name = l.dealer_name
  and da.dealer_city_key = coalesce(l.dealer_city, '')
  and da.dealer_state_key = coalesce(l.dealer_state, '')
  and s.id = o.customer_search_id
  and not public.is_test_customer(s.customer_id);

-- 10e ---------------------------------------------------------------------------------------
insert into public.agent_activity_log (agent_id, action, search_id, customer_id, created_at, details)
select p.agent_id,
       case p.action when 'marked_purchased' then 'search_marked_purchased' else 'purchase_reverted' end,
       p.search_id, s.customer_id, p.created_at,
       jsonb_build_object('backfilled', true, 'source', 'purchase_status_log', 'source_id', p.id, 'reason', p.reason)
from public.purchase_status_log p join public.customer_searches s on s.id = p.search_id
where not public.is_test_customer(s.customer_id);

insert into public.agent_activity_log (agent_id, action, search_id, customer_id, created_at, details)
select b.agent_id,
       case b.fee_type when 'switch' then 'search_switched' else 'extension_bypass_granted' end,
       b.search_id, s.customer_id, b.created_at,
       jsonb_build_object('backfilled', true, 'source', 'agent_bypass_log', 'source_id', b.id,
                          'reason_category', b.reason_category)
from public.agent_bypass_log b join public.customer_searches s on s.id = b.search_id
where not public.is_test_customer(s.customer_id);

insert into public.agent_activity_log (agent_id, action, search_id, customer_id, created_at, details)
select c.agent_id, 'search_cancelled_by_agent', c.search_id, s.customer_id, c.created_at,
       jsonb_build_object('backfilled', true, 'source', 'cancellation_log', 'source_id', c.id,
                          'reason_category', c.reason_category)
from public.cancellation_log c join public.customer_searches s on s.id = c.search_id
where c.agent_id is not null and not public.is_test_customer(s.customer_id);

insert into public.agent_activity_log (agent_id, action, search_id, customer_id, refund_id, created_at, details)
select r.agent_id, 'refund_processed', p.search_id, p.customer_id, r.id, r.created_at,
       jsonb_build_object('backfilled', true, 'source', 'refunds', 'source_id', r.id,
                          'amount_cents', r.amount_cents, 'reason', r.reason)
from public.refunds r join public.payments p on p.id = r.payment_id
where not public.is_test_customer(p.customer_id);

insert into public.agent_activity_log (agent_id, action, search_id, customer_id, qualifying_offer_id, created_at, details)
select m.author_agent_id, 'message_sent', o.customer_search_id, coalesce(s.customer_id, m.customer_id),
       m.qualifying_offer_id, m.created_at,
       jsonb_build_object('backfilled', true, 'source', 'offer_messages', 'source_id', m.id,
                          'thread', case when m.qualifying_offer_id is null then 'general' else 'offer' end)
from public.offer_messages m
left join public.qualifying_offers o on o.id = m.qualifying_offer_id
left join public.customer_searches s on s.id = o.customer_search_id
where m.author_type = 'agent' and m.author_agent_id is not null
  and not public.is_test_customer(coalesce(s.customer_id, m.customer_id));

insert into public.agent_activity_log (agent_id, action, search_id, customer_id, qualifying_offer_id, created_at, details)
select o.withdrawn_by_agent_id, 'offer_released', o.customer_search_id, s.customer_id, o.id, o.withdrawn_at,
       jsonb_build_object('backfilled', true, 'source', 'qualifying_offers', 'source_id', o.id,
                          'reason', o.withdrawal_reason)
from public.qualifying_offers o join public.customer_searches s on s.id = o.customer_search_id
where o.withdrawn_by_agent_id is not null and not public.is_test_customer(s.customer_id);

insert into public.agent_activity_log (agent_id, action, dealer_alias_id, created_at, details)
select confirmed_by_agent_id, 'dealer_alias_confirmed', id, coalesce(confirmed_at, now()),
       jsonb_build_object('backfilled', true, 'source', 'dealer_aliases', 'source_id', id)
from public.dealer_aliases where confirmed_by_agent_id is not null;

insert into public.agent_activity_log (agent_id, action, created_at, details)
select added_by_agent_id, 'salesperson_added', created_at,
       jsonb_build_object('backfilled', true, 'source', 'dealership_salespeople', 'source_id', id,
                          'dealership_id', dealership_id)
from public.dealership_salespeople where added_by_agent_id is not null;

insert into public.agent_activity_log (agent_id, action, created_at, details)
select approved_by_agent_id, 'article_approved', coalesce(approved_at, now()),
       jsonb_build_object('backfilled', true, 'source', 'articles', 'source_id', id, 'slug', slug)
from public.articles where approved_by_agent_id is not null;

insert into public.agent_activity_log (agent_id, action, created_at, details)
select approved_by_agent_id, 'social_post_approved', coalesce(approved_at, now()),
       jsonb_build_object('backfilled', true, 'source', 'social_posts', 'source_id', id, 'theme', theme)
from public.social_posts where approved_by_agent_id is not null;

select set_config('levr.agent_admin', 'off', true);
select set_config('levr.assignment', 'off', true);
commit;
