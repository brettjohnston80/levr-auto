-- qualifying_offers: no access for anon or authenticated (offer-entry plan, Appendix A).
--
-- APPLIED BY HAND by Brett in the Supabase SQL Editor on 2026-10-24 at about 9:58 pm CDT
-- (2026-10-25 02:58 UTC). This file records what ran; don't run it again (it is safe to, since
-- every statement is idempotent, but there's no need).
--
-- Brett's grant check:
--   before: anon had SELECT, REFERENCES, TRIGGER and TRUNCATE on qualifying_offers;
--           authenticated had full access.
--   after:  anon_can_read = false, customer_can_read = false,
--           server_can_read = true, server_can_write = true.
--
-- Why: a signed-in customer could use the public anon key and their own session to read every
-- column of their own offers, including agent-only notes, withdrawal_reason,
-- withdrawn_by_agent_id and logged_by_agent_id. The app never needed that access: every
-- customer page reads offers on the server through the service role.

-- qualifying_offers: no access for anon or authenticated (the app reads it only through
-- the service role). Closes direct reads of agent-only columns (notes, withdrawal_reason,
-- withdrawn_by_agent_id, logged_by_agent_id) by a signed-in customer.
begin;
drop policy if exists "Customers can view offers on their own searches" on public.qualifying_offers;
revoke select, insert, update, delete, truncate, references, trigger
  on public.qualifying_offers from anon, authenticated;
-- Existing table, so service_role keeps its grants regardless of the 2026-10-30 change.
-- Stated explicitly anyway so the end state is the same whenever this runs (a no-op today).
grant select, insert, update, delete on public.qualifying_offers to service_role;
commit;
