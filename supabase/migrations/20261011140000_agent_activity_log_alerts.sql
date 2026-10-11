-- Agent dashboard Phase 1, Step 2: activity types (lookup), agent activity log,
-- agent alerts, and log_agent_activity().
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (section 5, and section 10 Step 2).
--
-- What this does:
--   * agent_activity_types: the fixed list of activity codes (Q7). Adding a type = one insert.
--   * agent_activity_log: one row per agent action. Nothing writes it yet; the Phase 1
--     code (deployed after the tester round) and later steps' functions will.
--   * agent_alerts: alert records for leads or admins (audience), e.g. assignment fallbacks
--     and activity-write failures. One open ASSIGNMENT alert per search; every
--     activity-write failure is recorded.
--   * log_agent_activity(): never raises. A failed activity insert becomes an
--     activity_log_failed alert, so the caller's action still succeeds (Q8).
--
-- RLS on, no policies (service role only). Execute on the function is revoked from
-- anon and authenticated. No deployed code reads or writes these tables.

create table public.agent_activity_types (
  code text primary key,
  label text not null,
  category text not null check (category in ('offer', 'deal', 'messages', 'search', 'refund', 'dealer', 'team', 'content')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.agent_activity_types enable row level security;

insert into public.agent_activity_types (code, label, category) values
  ('offer_logged', 'Logged an offer', 'offer'),
  ('offer_addon_added', 'Added an add-on', 'offer'),
  ('addon_removal_resolved', 'Resolved an add-on removal', 'offer'),
  ('offer_vehicle_marked_sold', 'Marked a vehicle sold', 'offer'),
  ('delivery_estimate_set', 'Set a delivery estimate', 'offer'),
  ('offer_released', 'Released an accepted offer', 'deal'),
  ('availability_confirmed', 'Confirmed availability', 'deal'),
  ('deposit_confirmed', 'Confirmed a deposit', 'deal'),
  ('signing_status_checked', 'Checked signing status', 'deal'),
  ('search_marked_purchased', 'Marked a search purchased', 'deal'),
  ('purchase_reverted', 'Reverted a purchase', 'deal'),
  ('search_finalized_by_agent', 'Finalized a search', 'search'),
  ('undecided_search_finalized', 'Chose a vehicle for an undecided search', 'search'),
  ('inventory_refreshed', 'Refreshed inventory', 'search'),
  ('search_switched', 'Switched a search', 'search'),
  ('extension_bypass_granted', 'Granted an extension bypass', 'search'),
  ('search_cancelled_by_agent', 'Cancelled a search', 'search'),
  ('call_request_resolved', 'Resolved a call request', 'search'),
  ('search_reassigned', 'Reassigned a search', 'team'),
  ('activity_reviewed', 'Marked customer activity reviewed', 'messages'),
  ('message_sent', 'Sent a message', 'messages'),
  ('notification_flag_resolved', 'Resolved a notification flag', 'messages'),
  ('refund_processed', 'Processed a refund', 'refund'),
  ('dealer_contact_logged', 'Logged a dealer contact', 'dealer'),
  ('dealer_follow_up_closed', 'Closed a dealer follow-up', 'dealer'),
  ('dealer_alias_confirmed', 'Confirmed a dealer identity', 'dealer'),
  ('dealer_alias_merged', 'Merged a dealer identity', 'dealer'),
  ('salesperson_added', 'Added a salesperson', 'dealer'),
  ('salesperson_updated', 'Updated a salesperson', 'dealer'),
  ('salesperson_removed', 'Removed a salesperson', 'dealer'),
  ('away_requested', 'Requested time away', 'team'),
  ('away_decided', 'Decided a time-away request', 'team'),
  ('away_set', 'Set time away', 'team'),
  ('away_cancelled', 'Cancelled time away', 'team'),
  ('agent_added', 'Added an agent', 'team'),
  ('agent_role_changed', 'Changed a role', 'team'),
  ('agent_rotation_changed', 'Changed rotation', 'team'),
  ('agent_deactivated', 'Deactivated an agent', 'team'),
  ('agent_reactivated', 'Reactivated an agent', 'team'),
  ('alert_resolved', 'Resolved an alert', 'team'),
  ('article_saved', 'Saved an article draft', 'content'),
  ('article_approved', 'Approved an article', 'content'),
  ('article_regenerated', 'Regenerated an article', 'content'),
  ('article_image_attached', 'Attached an article image', 'content'),
  ('social_post_saved', 'Saved a social post', 'content'),
  ('social_post_approved', 'Approved a social post', 'content'),
  ('social_post_regenerated', 'Regenerated a social post', 'content'),
  ('social_post_image_attached', 'Attached a social image', 'content'),
  ('platform_marked_posted', 'Marked a post published', 'content');

create table public.agent_activity_log (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id),
  action text not null references public.agent_activity_types (code),
  search_id uuid references public.customer_searches (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  qualifying_offer_id uuid references public.qualifying_offers (id) on delete set null,
  dealer_alias_id uuid references public.dealer_aliases (id) on delete set null,
  refund_id uuid references public.refunds (id) on delete set null,
  dealer_contact_id uuid, -- FK added in step 6 (dealer outreach log)
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index agent_activity_log_search_idx on public.agent_activity_log (search_id, created_at desc, id);
create index agent_activity_log_agent_idx on public.agent_activity_log (agent_id, created_at desc, id);
create index agent_activity_log_customer_idx on public.agent_activity_log (customer_id, created_at desc, id);
create index agent_activity_log_action_idx on public.agent_activity_log (action, created_at desc, id);
alter table public.agent_activity_log enable row level security;

create table public.agent_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'assignment_lead_fallback', 'assignment_no_lead', 'assignment_failed', 'activity_log_failed', 'other')),
  audience text not null default 'leads' check (audience in ('leads', 'admins')), -- who the app emails (N6)
  search_id uuid references public.customer_searches (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_agent_id uuid references public.agents (id)
);
create index agent_alerts_open_idx on public.agent_alerts (created_at desc, id) where resolved_at is null;
-- One open assignment alert per search, so the hourly retry never piles up duplicates.
-- Activity-write failures are deliberately not limited: each one is recorded.
create unique index agent_alerts_one_open_assignment_idx on public.agent_alerts (search_id, kind)
  where resolved_at is null and search_id is not null
    and kind in ('assignment_lead_fallback', 'assignment_no_lead');
alter table public.agent_alerts enable row level security;

-- Never raises: a failed activity insert becomes an alert, so the caller's action still succeeds (Q8).
create function public.log_agent_activity(
  p_agent_id uuid,
  p_action text,
  p_search_id uuid default null,
  p_customer_id uuid default null,
  p_qualifying_offer_id uuid default null,
  p_dealer_alias_id uuid default null,
  p_refund_id uuid default null,
  p_dealer_contact_id uuid default null,
  p_details jsonb default '{}'::jsonb
) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  begin
    insert into public.agent_activity_log (agent_id, action, search_id, customer_id, qualifying_offer_id,
                                           dealer_alias_id, refund_id, dealer_contact_id, details)
    values (p_agent_id, p_action, p_search_id, p_customer_id, p_qualifying_offer_id,
            p_dealer_alias_id, p_refund_id, p_dealer_contact_id, coalesce(p_details, '{}'::jsonb))
    returning id into v_id;
  exception when others then
    begin
      insert into public.agent_alerts (kind, search_id, agent_id, details)
      values ('activity_log_failed', p_search_id, p_agent_id,
              jsonb_build_object('error', sqlerrm, 'action', p_action, 'details', p_details));
    exception when others then
      raise warning 'agent activity and alert both failed: %', sqlerrm;
    end;
  end;
  return v_id;
end;
$$;

revoke execute on function public.log_agent_activity(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.log_agent_activity(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, jsonb) to service_role;
