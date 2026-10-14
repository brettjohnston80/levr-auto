-- Agent dashboard Phase 1, Step 16: a call request the CUSTOMER closes by switching or cancelling
-- on their own. Plan: docs/plans/agent-dashboard-phase1-code-plan.md (Chunk 6; Brett 2026-10-14).
--
-- When a customer switches or cancels on their own while a switch or cancellation call request is
-- open, the app resolves it automatically with outcome 'switched' / 'cancelled' and NO agent named,
-- and writes an activity row noting the customer did it. Two rules blocked that:
--
-- 1. The resolution "shape" checks on customer_searches required a resolving agent whenever a
--    call was resolved. They now allow no agent ONLY for the automatic outcome of that call type
--    ('switched' for a switch call, 'cancelled' for a cancellation call). Every manual outcome
--    still needs its agent, and the three columns are still all set or all empty.
--
-- 2. agent_activity_log.agent_id was NOT NULL. It becomes nullable, with a check that only one
--    new activity type, 'call_request_resolved_by_customer', may have no agent. Every other
--    activity row still needs its agent. log_agent_activity() needs no change (it passes the
--    agent through; the check is what decides).
--
-- No customer-facing change. Run in the SQL Editor; nothing in src/ on main uses it yet.

begin;

-- 1. Resolution shape ---------------------------------------------------------------------------
alter table public.customer_searches
  drop constraint customer_searches_switch_call_resolution_shape,
  drop constraint customer_searches_cancellation_call_resolution_shape;

alter table public.customer_searches
  add constraint customer_searches_switch_call_resolution_shape check (
    (switch_call_resolved_at is null and switch_call_resolved_by_agent_id is null and switch_call_outcome is null)
    or (switch_call_resolved_at is not null and switch_call_outcome is not null
        and (switch_call_resolved_by_agent_id is not null or switch_call_outcome = 'switched'))),
  add constraint customer_searches_cancellation_call_resolution_shape check (
    (cancellation_call_resolved_at is null and cancellation_call_resolved_by_agent_id is null and cancellation_call_outcome is null)
    or (cancellation_call_resolved_at is not null and cancellation_call_outcome is not null
        and (cancellation_call_resolved_by_agent_id is not null or cancellation_call_outcome = 'cancelled')));

-- 2. Activity rows the customer caused ----------------------------------------------------------
insert into public.agent_activity_types (code, label, category)
values ('call_request_resolved_by_customer', 'Call request closed: the customer switched or cancelled', 'search');

alter table public.agent_activity_log alter column agent_id drop not null;
alter table public.agent_activity_log add constraint agent_activity_log_agent_required check (
  agent_id is not null or action = 'call_request_resolved_by_customer');

commit;
