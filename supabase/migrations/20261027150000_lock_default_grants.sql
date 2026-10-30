-- Lock down default anon/authenticated grants (two-locks rule).
-- APPLIED by Brett in the SQL Editor, 2026-10-27. Don't run it again.
-- Results: before check matched the starting state (29 tables with default anon/authenticated
-- grants; the customer_searches insert policy and the three broken read policies present).
-- After check: anon SELECT only on zip_coordinates; authenticated SELECT only on zip_coordinates,
-- customers and customer_searches; service_role S,I,U,D everywhere (dealer_link_attempts S,I,D
-- and dealer_offer_requests S,I,U as designed); no policies left on offer_addons, documents,
-- deal_progress; the insert policy gone. Rolled-back test: exactly the four expected rows.
-- Leftover, folded into the next migration (OE-5b): anon and authenticated still hold
-- REFERENCES and TRIGGER on the Phase 1 tables, offer_fees and offer_vehicle_options.
-- Source: docs/sql/grants-lockdown/ (audit, after check, rolled-back test).
begin;

-- Customer read policies nothing uses (all three already fail with 42501, because they read
-- qualifying_offers, which is locked since 2026-10-25).
drop policy if exists "Customers can view add-ons on their own offers" on public.offer_addons;
drop policy if exists "Customers can view documents on their own offers" on public.documents;
drop policy if exists "Customers can view deal progress on their own offers" on public.deal_progress;
-- Customer insert policy nothing uses (every search insert goes through the service role,
-- src/lib/unpaid-search.ts); today it lets a signed-in customer insert an unpaid search directly.
drop policy if exists "Customers can create their own pending searches" on public.customer_searches;

-- 1. Server-only tables: no access for anon or authenticated.
revoke all on public.admin_action_log from anon, authenticated;
grant select, insert, update, delete on public.admin_action_log to service_role;
revoke all on public.agent_bypass_log from anon, authenticated;
grant select, insert, update, delete on public.agent_bypass_log to service_role;
revoke all on public.articles from anon, authenticated;
grant select, insert, update, delete on public.articles to service_role;
revoke all on public.cancellation_log from anon, authenticated;
grant select, insert, update, delete on public.cancellation_log to service_role;
revoke all on public.configurator_batches from anon, authenticated;
grant select, insert, update, delete on public.configurator_batches to service_role;
revoke all on public.configurator_live_makes from anon, authenticated;
grant select, insert, update, delete on public.configurator_live_makes to service_role;
revoke all on public.configurator_options from anon, authenticated;
grant select, insert, update, delete on public.configurator_options to service_role;
revoke all on public.configurator_trims from anon, authenticated;
grant select, insert, update, delete on public.configurator_trims to service_role;
revoke all on public.deal_progress from anon, authenticated;
grant select, insert, update, delete on public.deal_progress to service_role;
revoke all on public.dealer_aliases from anon, authenticated;
grant select, insert, update, delete on public.dealer_aliases to service_role;
revoke all on public.dealership_salespeople from anon, authenticated;
grant select, insert, update, delete on public.dealership_salespeople to service_role;
revoke all on public.dealerships from anon, authenticated;
grant select, insert, update, delete on public.dealerships to service_role;
revoke all on public.documents from anon, authenticated;
grant select, insert, update, delete on public.documents to service_role;
revoke all on public.email_signups from anon, authenticated;
grant select, insert, update, delete on public.email_signups to service_role;
revoke all on public.general_threads from anon, authenticated;
grant select, insert, update, delete on public.general_threads to service_role;
revoke all on public.listings from anon, authenticated;
grant select, insert, update, delete on public.listings to service_role;
revoke all on public.notification_events from anon, authenticated;
grant select, insert, update, delete on public.notification_events to service_role;
revoke all on public.offer_addons from anon, authenticated;
grant select, insert, update, delete on public.offer_addons to service_role;
revoke all on public.offer_messages from anon, authenticated;
grant select, insert, update, delete on public.offer_messages to service_role;
revoke all on public.payments from anon, authenticated;
grant select, insert, update, delete on public.payments to service_role;
revoke all on public.post_deal_surveys from anon, authenticated;
grant select, insert, update, delete on public.post_deal_surveys to service_role;
revoke all on public.purchase_status_log from anon, authenticated;
grant select, insert, update, delete on public.purchase_status_log to service_role;
revoke all on public.refunds from anon, authenticated;
grant select, insert, update, delete on public.refunds to service_role;
revoke all on public.search_combination_preferences from anon, authenticated;
grant select, insert, update, delete on public.search_combination_preferences to service_role;
revoke all on public.search_option_selections from anon, authenticated;
grant select, insert, update, delete on public.search_option_selections to service_role;
revoke all on public.search_trim_preferences from anon, authenticated;
grant select, insert, update, delete on public.search_trim_preferences to service_role;
revoke all on public.social_posts from anon, authenticated;
grant select, insert, update, delete on public.social_posts to service_role;
revoke all on public.vehicle_dataset_batches from anon, authenticated;
grant select, insert, update, delete on public.vehicle_dataset_batches to service_role;
revoke all on public.vehicles from anon, authenticated;
grant select, insert, update, delete on public.vehicles to service_role;

-- 2. Customer reads their own row (RLS policies kept): SELECT only, signed-in only.
revoke all on public.customers from anon, authenticated;
grant select on public.customers to authenticated;
grant select, insert, update, delete on public.customers to service_role;
revoke all on public.customer_searches from anon, authenticated;
grant select on public.customer_searches to authenticated;
grant select, insert, update, delete on public.customer_searches to service_role;

-- 3. Public reference data: read-only for everyone.
revoke all on public.zip_coordinates from anon, authenticated;
grant select on public.zip_coordinates to anon, authenticated;
grant select, insert, update, delete on public.zip_coordinates to service_role;
commit;
