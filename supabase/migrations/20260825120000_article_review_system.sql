-- Articles system, Phase 2: auto-draft generation, review/approval, and
-- reminder tracking. Additive only -- no Phase 1 columns touched.
--
-- Four flat caption columns, not a jsonb blob -- matches how every other
-- fixed-shape record in this codebase is stored (offer_addons, deal_progress,
-- dealer_aliases all use flat columns, jsonb here is reserved for genuinely
-- schema-less external data like listings.raw_data/notification_events.event_data).
alter table public.articles
  add column caption_x text,
  add column caption_facebook text,
  add column caption_instagram text,
  add column caption_linkedin text;

comment on column public.articles.caption_x is
  'Generated in the same pass as content, reviewed/approved together -- '
  'never generated or approved separately.';

-- reminder_last_threshold_days: the "sent-once" idiom adapted for an
-- *ordered* series against one *fixed* target (the scheduled publish
-- instant, which never moves), unlike deadline_reminder_sent_for/
-- resume_reminder_sent_for, which compare a stored timestamp against a
-- single, possibly-changing target value. Stores the most urgent threshold
-- (5/2/1/0 days-before) already notified -- a cron run only sends if the
-- currently-due threshold is more urgent (numerically smaller) than what's
-- stored here, which naturally escalates, no-ops on repeat runs, and
-- catches up (sends only the single most-urgent threshold, never a
-- backlog) if a run was ever missed. Never reset by Regenerate -- the
-- target date doesn't change, only the content does.
alter table public.articles
  add column reminder_last_threshold_days smallint
    check (reminder_last_threshold_days in (5, 2, 1, 0)),
  add column reminder_last_sent_at timestamptz;

comment on column public.articles.reminder_last_threshold_days is
  'Most urgent escalating reminder threshold (days before scheduled '
  'publish) already sent for this draft. Null = no reminder sent yet. '
  'Compared by ordering, not equality -- see src/lib/article-reminders.ts.';
