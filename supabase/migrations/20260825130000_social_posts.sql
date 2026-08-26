-- Daily social content system: weekly-themed posts (7 days/themes), plus
-- the posting infrastructure shared with articles (image attachment,
-- per-platform "mark posted" tracking). Plan reviewed and approved
-- 2026-08-25 -- see social-posts-plan.md for full design.

-- ---------------------------------------------------------------------------
-- social_posts
-- ---------------------------------------------------------------------------
-- One row per theme per week. Rows are only ever created once real content
-- exists -- customer_testimonial/deal_of_the_week are simply never inserted
-- for a week with no qualifying real data (no phantom 'skipped' row).
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),

  theme text not null check (theme in (
    'spotlight_monday', 'ask_around_tuesday', 'customer_testimonial',
    'throwback_thursday', 'deal_of_the_week', 'news_recap_saturday', 'sunday_question'
  )),
  -- Monday of the week this post belongs to (America/Chicago), e.g. '2026-09-07'.
  week_start date not null,

  status text not null default 'draft' check (status in ('draft', 'approved', 'published')),

  caption_x text,
  caption_facebook text,
  caption_instagram text,
  -- Always null for news_recap_saturday/sunday_question -- no LinkedIn
  -- weekend slot exists at all (see social-schedule.ts's
  -- applicablePlatforms) -- the captions call is asked to generate one
  -- anyway (simpler than a second tool schema), it's just discarded at
  -- write time for those two themes.
  caption_linkedin text,

  -- Set only when an agent manually attaches an image during review -- no
  -- automated image sourcing this pass.
  image_storage_path text,

  -- Provenance, not a uniqueness guard -- dedup is structural (each week's
  -- data query is scoped to that week's exact 7-day window, so the same
  -- source row can never be selected across two different weeks). Used for
  -- review-page context and so Regenerate can re-run only the captions
  -- call against the same already-selected source, never the selection
  -- query itself.
  source_post_deal_survey_id uuid references public.post_deal_surveys (id),
  source_customer_search_id uuid references public.customer_searches (id),

  approved_at timestamptz,
  approved_by_agent_id uuid references public.agents (id),

  -- Per-platform manual posting tracking. Once every platform applicable
  -- to this row's theme (see applicablePlatforms -- 3 for the two weekend
  -- themes, 4 otherwise) has a value here, status advances to 'published'
  -- in the same write. A weekend-theme row's posted_linkedin_at stays null
  -- forever by design -- the publish-advance check must test against
  -- applicablePlatforms(theme), never a blind "all 4 non-null" check, or a
  -- weekend post could never reach 'published'.
  posted_x_at timestamptz,
  posted_facebook_at timestamptz,
  posted_instagram_at timestamptz,
  posted_linkedin_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (theme, week_start)
);

comment on table public.social_posts is
  'One row per theme per week in the 7-day social rhythm. Combined with '
  'articles'' own caption columns only at the posting-worklist read step '
  '(getPostingWorklist) -- articles keep their existing, separate Approve '
  'flow untouched.';

alter table public.social_posts enable row level security;
-- No policies. Service-role only, same convention as every other table.

-- ---------------------------------------------------------------------------
-- articles: image attachment + per-platform posting tracking
-- ---------------------------------------------------------------------------
-- Closes a real gap flagged at the end of Articles Phase 2: status =
-- 'published' was reserved for "once social auto-posting is done" but
-- nothing could ever set it. This is that mechanism -- articles have no
-- day-of-week restriction, so all 4 platforms are always applicable (unlike
-- social_posts' two weekend themes).
alter table public.articles
  add column image_storage_path text,
  add column posted_x_at timestamptz,
  add column posted_facebook_at timestamptz,
  add column posted_instagram_at timestamptz,
  add column posted_linkedin_at timestamptz;

-- ---------------------------------------------------------------------------
-- Storage bucket for manually-attached post images
-- ---------------------------------------------------------------------------
-- Public, not private -- a deliberate divergence from the `documents`
-- bucket's convention (approved 2026-08-25). These images carry no customer
-- PII and are pre-destined for public posting anyway, so a stable public
-- URL is directly useful for the manual copy-paste workflow, unlike a
-- rotating signed URL.
insert into storage.buckets (id, name, public)
values ('social-post-images', 'social-post-images', true)
on conflict (id) do nothing;
