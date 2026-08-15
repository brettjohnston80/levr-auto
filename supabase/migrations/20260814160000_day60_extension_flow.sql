-- Day-60 extension policy (see CLAUDE.md "Pricing Pivot Tracking" Step 4).
-- This pass adds schema only -- the extension payment flow and dashboard UI
-- are separate follow-up passes.
--
-- No qualifying_offers.status soft-exclusion is applied anywhere that reads
-- these columns (the reminder/pause crons, the stale-paused queue) --
-- deliberately. That field could have the same "legal but never actually
-- written to the value you'd want to check" problem search_status's
-- paused/closed values had before this pass gave 'paused' its first real
-- writer -- checking it would be false confidence, not real protection,
-- without the same exhaustive write-site audit search_status got.
alter table public.customer_searches
  add column search_deadline_at timestamptz,
  add column paused_at timestamptz,
  add column deadline_reminder_sent_for timestamptz,
  add column last_extension_session_id text;

comment on column public.customer_searches.search_deadline_at is
  'Day-60 (then rolling +30/extension) guarantee-search deadline. NULL means '
  'the default -- solidified_at + 60 days -- computed at query time, not '
  'backfilled, so existing rows need no data migration. Set explicitly the '
  'first time a customer pays for an extension (the computed default + 30 '
  'days), incremented by 30 days on each subsequent extension.';

comment on column public.customer_searches.paused_at is
  'Set when the day60-pause-overdue-searches cron pauses a search past its '
  'deadline with no extension (search_status -> paused). Anchors the 7-day '
  'self-service resume window. Cleared back to null on resume, same as other '
  '"nullable timestamp is the state" columns in this schema (vehicle_sold_at, '
  'deposit_confirmed_at, etc.).';

comment on column public.customer_searches.deadline_reminder_sent_for is
  'The exact search_deadline_at (or, if null, the computed solidified_at + '
  '60 days default) value the 7-day-before reminder was last sent for -- not '
  'a boolean/timestamp of "was a reminder ever sent." Compared against the '
  'CURRENT effective deadline so a reminder already sent for an old deadline '
  'does not suppress a fresh reminder once the customer extends and a new '
  'deadline approaches. Self-correcting: an extension does not need to '
  'explicitly clear this field, since the new deadline value naturally stops '
  'matching it.';

comment on column public.customer_searches.last_extension_session_id is
  'Stripe Checkout Session id of the most recently processed extension_fee '
  'payment. Idempotency guard for the (not-yet-built) extension webhook '
  'branch -- unlike paid_at, search_deadline_at is expected to change '
  'repeatedly over a search''s life, so a one-shot IS NULL guard does not '
  'work here. The webhook branch will guard its update with '
  '.neq("last_extension_session_id", session.id) so a Stripe retry carrying '
  'the same session id is a no-op, matching the "guard the write with a '
  'condition that becomes false after the first success" pattern used '
  'elsewhere in this schema (paid_at, call_requested_at, free_switch_used_at).';
