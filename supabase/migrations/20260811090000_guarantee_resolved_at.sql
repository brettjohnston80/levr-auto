-- Dedicated timestamp for when guarantee_status actually resolved (met or
-- refunded), set only by the Day-30 assessment job. customer_searches.
-- updated_at is a general-purpose "last touched" column shared by every
-- write path on the row (including an unrelated later switch-make/model
-- request), so it drifts away from the true resolution moment the instant
-- anything else updates the row. This column can't drift, because nothing
-- but the resolution itself ever sets it.
alter table public.customer_searches
  add column guarantee_resolved_at timestamptz;

comment on column public.customer_searches.guarantee_resolved_at is
  'Set once, at the moment guarantee_status transitions from pending to '
  'met/refunded (src/lib/guarantee-assessment.ts). Never updated again after.';
