-- Day-60 paused-state policy, Pass 2 (see CLAUDE.md "Pricing Pivot
-- Tracking" Step 4). Supports the new resume-window reminder cron --
-- application code only otherwise, no other schema needed this pass.
alter table public.customer_searches
  add column resume_reminder_sent_for timestamptz;

comment on column public.customer_searches.resume_reminder_sent_for is
  'The exact paused_at value the 7-day-before-resume-window-closes reminder '
  'was last sent for -- not a boolean. Mirrors deadline_reminder_sent_for''s '
  'design (20260814160000_day60_extension_flow.sql) exactly: compared by '
  'value against the current paused_at, not treated as a one-shot flag, so '
  'it is self-correcting if a search is ever paused a second time after a '
  'later resume -- the new paused_at naturally stops matching the stored '
  'value, letting a fresh reminder go out for the new pause.';
