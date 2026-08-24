-- Real notification-sending system. Scope decided 2026-08-24. Customers can
-- already set notify_by_email/notify_by_text/notify_by_agent_callback and
-- communication_frequency in account settings (20260819140000_notification_channels.sql,
-- 20260811110000_communication_preferences.sql) -- nothing has read them
-- until now. This is only for NEW discretionary notifications (a new offer,
-- an offer response, a deal-progress milestone, a purchase); the existing
-- always-on emails (Day-60 reminders, auto-renew confirmations, resume
-- reminders) stay exactly as they are, ignoring preferences entirely.

-- ---------------------------------------------------------------------------
-- notification_events
-- ---------------------------------------------------------------------------
-- Not a passive audit trail like cancellation_log/agent_bypass_log -- this
-- table actively drives dispatch. One row per notify-worthy event,
-- regardless of the customer's frequency preference, rather than two
-- divergent code paths for real-time vs. digest: logNotificationEvent
-- always inserts a row here; it additionally sends immediately only when
-- communication_frequency = 'real_time'. The daily digest cron later picks
-- up whatever's still digest_sent_at IS NULL for daily_digest customers --
-- an event's own digest_sent_at is the complete tracking mechanism, no
-- separate "last digest sent" state needed on customers.
create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  customer_search_id uuid not null references public.customer_searches (id) on delete cascade,

  event_type text not null
    check (event_type in ('offer_logged', 'offer_response_recorded', 'deal_progress_update', 'search_purchased')),
  -- Event-specific details for composing copy later (dealer name, price,
  -- which deal-progress milestone, accept/decline) -- flexible payload
  -- rather than many nullable event-type-specific columns, same convention
  -- as listings.raw_data/qualifying_offers's use of jsonb elsewhere.
  event_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  -- Set only on a successful send, same "set on success" idiom as
  -- deadline_reminder_sent_for/resume_reminder_sent_for -- never set for a
  -- daily_digest customer's events, which go out via digest_sent_at instead.
  real_time_sent_at timestamptz,
  -- Set once this event has been included in a successfully-sent digest
  -- email. Null forever for a real_time customer's own events -- the
  -- digest cron only ever selects daily_digest customers' rows.
  digest_sent_at timestamptz,

  -- notify_by_agent_callback isn't a customer-facing send -- it means "an
  -- agent should call this customer." Set at event-creation time,
  -- unconditional of communication_frequency (a callback task shouldn't
  -- wait for tomorrow's digest). Surfaces on /internal/outreach.
  agent_callback_requested_at timestamptz,
  -- notify_by_text has no real SMS-send capability yet. If a customer has
  -- ONLY text checked (no email, no callback), nothing is actually
  -- deliverable -- flagged here rather than silently dropped, surfaced on
  -- the same /internal/outreach section, visually distinct from a real
  -- callback request (this is "nothing reached them," not "they asked for
  -- a call").
  flagged_no_deliverable_channel boolean not null default false,
  -- Shared resolution marker for either agent-facing reason above (a
  -- requested callback or a flagged undeliverable channel) -- both show up
  -- in the same queue and get dismissed/handled the same way by an agent,
  -- so one column covers both rather than two near-identical ones.
  flag_resolved_at timestamptz
);

comment on table public.notification_events is
  'Drives the real notification-sending system -- every notify-worthy '
  'event (new offer, offer response, deal-progress milestone, purchase) '
  'logs one row here regardless of the customer''s communication_frequency. '
  'real_time_sent_at / digest_sent_at track actual customer-facing '
  'delivery; agent_callback_requested_at / flagged_no_deliverable_channel / '
  'flag_resolved_at track the agent-facing side, surfaced on '
  '/internal/outreach.';

create index notification_events_customer_id_idx on public.notification_events (customer_id);

-- Digest cron candidate lookup.
create index notification_events_digest_pending_idx
  on public.notification_events (customer_id)
  where digest_sent_at is null;

-- /internal/outreach callback-queue lookup -- covers both agent-facing
-- reasons, unresolved.
create index notification_events_unresolved_flag_idx
  on public.notification_events (created_at)
  where flag_resolved_at is null and (agent_callback_requested_at is not null or flagged_no_deliverable_channel);

alter table public.notification_events enable row level security;
-- No policies. Service role only, same convention as every other table in
-- this codebase.
