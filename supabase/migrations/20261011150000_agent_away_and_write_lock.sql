-- Agent dashboard Phase 1, Step 3: away periods, plus the second lock on agent tables.
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (sections 1.4 and 3, and section 10 Step 3).
--
-- What this does:
--   * agent_away_periods: time-away requests and approvals (Q16). Away is a status signal
--     only: it never changes assignment. Rows are written later by the away functions (Step 9).
--   * agent_is_away(): reads approved periods covering a moment; used only for lead-view flags.
--   * Second lock: revokes INSERT/UPDATE/DELETE/TRUNCATE from anon and authenticated on
--     agents and every Phase 1 table so far. RLS (no policies) already blocks them; this
--     makes customers blocked twice, and covers TRUNCATE, which RLS never applies to.
--     SELECT stays granted (RLS returns nothing), so nothing that relies on it breaks.
--
-- Checked first: no deployed code writes to agents or any Phase 1 table with a customer
-- or anon login (all agents references in src/ are service-role reads). No customer or
-- tester data is touched.

create table public.agent_away_periods (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 500),
  status text not null check (status in ('requested', 'approved', 'rejected', 'cancelled')),
  requested_by_agent_id uuid not null references public.agents (id),
  decided_by_agent_id uuid references public.agents (id),
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  cancelled_by_agent_id uuid references public.agents (id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_away_periods_window check (ends_at > starts_at),
  -- requested: not decided yet. approved/rejected: decided. cancelled: may or may not have been
  -- decided first (an approved period can be cancelled), but always records who cancelled it.
  constraint agent_away_periods_status_shape check (
    (status = 'requested' and decided_by_agent_id is null and decided_at is null
       and cancelled_by_agent_id is null and cancelled_at is null)
    or (status in ('approved', 'rejected') and decided_by_agent_id is not null and decided_at is not null
       and cancelled_by_agent_id is null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_by_agent_id is not null and cancelled_at is not null))
);
create index agent_away_periods_agent_idx on public.agent_away_periods (agent_id, starts_at desc, id);
create index agent_away_periods_pending_idx on public.agent_away_periods (created_at, id) where status = 'requested';
alter table public.agent_away_periods enable row level security;

-- Status signal only: used for lead-view flags, never for assignment.
create function public.agent_is_away(p_agent_id uuid, p_at timestamptz default now()) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.agent_away_periods
    where agent_id = p_agent_id and status = 'approved' and starts_at <= p_at and ends_at > p_at
  );
$$;

revoke execute on function public.agent_is_away(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.agent_is_away(uuid, timestamptz) to service_role;

-- Second lock (2026-10-11): RLS with no policies already blocks these, but Supabase's default
-- grants still give anon/authenticated INSERT/UPDATE/DELETE/TRUNCATE on every public table.
-- TRUNCATE is not covered by RLS at all. Revoke the writes so a mistaken future policy can't open them.
-- SELECT stays granted (RLS with no policies returns nothing) so nothing that relies on it breaks.
revoke insert, update, delete, truncate on public.agents,
  public.agent_activity_types, public.agent_activity_log, public.agent_alerts, public.agent_away_periods
  from anon, authenticated;
