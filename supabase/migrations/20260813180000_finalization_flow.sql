-- Add awaiting_finalization search_status + finalized_at/call_requested_at
-- columns to customer_searches -- the pending pivot's Steps 4-6 (see
-- LEVR-Auto-Business-Plan-and-Roadmap.md "Full flow, resolved Aug 12, 2026").
--
-- Payment now creates a lighter row (make/model/zip only) that starts at
-- 'awaiting_finalization' rather than 'pending_refinement'. The customer (or
-- an agent, on a call) then finalizes trim/color/options as an explicit
-- action, which is what actually starts the 24h self-edit window -- not
-- payment. finalized_at is that explicit-action timestamp; solidified_at
-- (already existed) keeps its existing meaning: the window has closed and
-- search_status has moved to 'searching'.
--
-- call_requested_at tracks the "request a call" choice on the finalize
-- screen -- manual for now (surfaces in /internal/outreach), a real calendar
-- integration is deliberately deferred (see roadmap "Call scheduling" note).

alter table public.customer_searches
  drop constraint customer_searches_search_status_check;

alter table public.customer_searches
  add constraint customer_searches_search_status_check
  check (search_status in (
    'awaiting_finalization', 'pending_refinement', 'searching', 'paused', 'closed', 'switched'
  ));

alter table public.customer_searches
  alter column search_status set default 'awaiting_finalization';

alter table public.customer_searches
  add column finalized_at timestamptz;

alter table public.customer_searches
  add column call_requested_at timestamptz;

comment on column public.customer_searches.finalized_at is
  'When the customer (self-service) or an agent (on a call) explicitly '
  'finalized trim/color/options for this search. Anchors the 24h self-edit '
  'window -- not paid_at. Distinct from solidified_at, which is when that '
  'window closes and search_status moves to searching.';

comment on column public.customer_searches.call_requested_at is
  'Set when a customer chooses the call-finalization path on /finalize. '
  'Manual process for now -- surfaces in /internal/outreach for an agent to '
  'follow up. No real calendar/scheduling integration yet (deliberately '
  'deferred, see roadmap).';
