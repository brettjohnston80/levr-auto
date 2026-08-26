# Daily Social Content System — Plan

Written to a file per the same convention established for the Articles Phase 2 plan (long plans get corrupted mid-transit in chat). Nothing abbreviated below.

Four structural questions were already resolved by Brett before this was drafted:
- **Article captions and weekly theme posts stay in two separate sources**, combined only at the posting-worklist read step — no duplication, `/internal/articles`' existing Approve flow is untouched.
- **Per-platform "mark as posted" tracking is built now** — 4 nullable `posted_*_at` columns on both tables, buttons on the worklist, `status` auto-advances to `'published'` once every applicable platform is marked.
- **Weekly batch generates Sunday evening**, using the just-completed Mon–Sun week's real data, posting through the upcoming week.
- **No escalating-reminder system this pass** — flagged as skipped by explicit choice, not an oversight.

---

## Investigation notes (real conventions confirmed before proposing schema)

- **Testimonial source, confirmed real:** `post_deal_surveys.levr_overall_rating` / `levr_overall_comment` (LEVRating Phase B) — the column's own comment literally says "doubles as a future testimonial source." Joined to `customer_searches` for make/model context via `post_deal_surveys.customer_search_id`.
- **`purchase_status_log` investigated, not needed.** It's just an audit trail of the `marked_purchased`/`reverted` actions. `customer_searches.purchased_at` (set by `markSearchPurchased`, cleared by `revertPurchasedSearch`) already gives the exact, current purchase moment directly — a plain `search_status = 'purchased'` filter is simpler and equally correct. Not joining a table just because it was mentioned as a candidate.
- **Deal data, confirmed real:** `qualifying_offers.offer_price_cents` / `msrp_cents` (with the generated `is_below_msrp` column) via `customer_searches.purchased_qualifying_offer_id` → `qualifying_offers.id`. The query below never selects customer name, email, or zip at all — the privacy requirement is structurally enforced by the query shape, not just a formatting choice downstream.
- **Storage buckets are created via migration SQL** in this codebase (confirmed in `20260811120000_deal_progress.sql`: `insert into storage.buckets (id, name, public) values (...) on conflict (id) do nothing`), not the dashboard — same approach for the new image bucket below.
- **File upload pattern, confirmed real** (`deal-progress-actions.ts`): `admin.storage.from(bucket).upload(path, file, { contentType })`, path shaped `${id}/${uuid}-${filename}`. Reused as-is for image attachment.
- **Forced-tool caption pattern, confirmed real**: `offer-parsing-actions.ts` / `article-generation.ts`'s `generate_social_captions` tool. Reused directly — I'm extracting the tool schema into a shared module (`src/lib/caption-tool.ts`) rather than redefining it, since both article generation and this new system need the identical shape.
- **Cleanup-call pattern, confirmed necessary** (found and fixed during Articles Phase 2 verification): a web-search-grounded generation call can leave a leading meta-commentary sentence in its "final" answer. The *existing* articles cleanup prompt is already Brett-approved with wording scoped specifically to "a freshly-drafted blog article's body text" — I'm **not** reusing or rewording it. This system needs its own analogous cleanup prompt (for "a freshly-drafted research summary," used ahead of the 3 research-dependent themes below), presented fresh for review, so no already-approved wording is silently touched.

---

## Schema

### `social_posts` (new table)

```sql
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),

  theme text not null check (theme in (
    'spotlight_monday', 'ask_around_tuesday', 'customer_testimonial',
    'throwback_thursday', 'deal_of_the_week', 'news_recap_saturday', 'sunday_question'
  )),
  -- Monday of the week this post belongs to (America/Chicago), e.g. '2026-09-07'.
  -- Rows are only ever created once real content exists for that
  -- theme/week -- customer_testimonial/deal_of_the_week are simply never
  -- inserted for a week with no qualifying real data, rather than modeled
  -- as a phantom 'skipped' row.
  week_start date not null,

  status text not null default 'draft' check (status in ('draft', 'approved', 'published')),

  caption_x text,
  caption_facebook text,
  caption_instagram text,
  -- Always null for news_recap_saturday/sunday_question -- there is no
  -- LinkedIn weekend slot at all (see socialPostScheduledAt below), so
  -- these two themes never persist a LinkedIn caption even though the
  -- captions call is asked to generate one anyway (simpler than a second
  -- tool schema -- the weekend-theme value is just discarded at write time).
  caption_linkedin text,

  -- Set only when the agent manually attaches an image during review --
  -- no automated image sourcing this pass, per Brett's explicit scope cut.
  image_storage_path text,

  -- Provenance + natural dedup guard: which real row this post's content
  -- came from. Only one of these is ever set, matching the row's theme.
  -- Dedup is actually structural, not enforced by these columns -- each
  -- week's data query is scoped to that week's exact 7-day window, so the
  -- same source row can never be selected across two different weeks.
  -- These exist for review-page context ("this came from search X") and
  -- as a debugging trail, not as an uniqueness guard.
  source_post_deal_survey_id uuid references public.post_deal_surveys (id),
  source_customer_search_id uuid references public.customer_searches (id),

  approved_at timestamptz,
  approved_by_agent_id uuid references public.agents (id),

  -- Per-platform manual posting tracking -- confirmed in scope this pass.
  -- Once every platform applicable to this row's theme has a value here,
  -- status auto-advances to 'published' in the same write.
  posted_x_at timestamptz,
  posted_facebook_at timestamptz,
  posted_instagram_at timestamptz,
  posted_linkedin_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (theme, week_start)
);

alter table public.social_posts enable row level security;
-- No policies. Service-role only, same convention as every other table.
```

### `articles` extension (same migration file, same feature)

```sql
alter table public.articles
  add column image_storage_path text,
  add column posted_x_at timestamptz,
  add column posted_facebook_at timestamptz,
  add column posted_instagram_at timestamptz,
  add column posted_linkedin_at timestamptz;
```

Closes a real gap flagged (not silently left) at the end of Articles Phase 2: `articles.status = 'published'` was reserved for "once social auto-posting is done" but nothing could ever set it. This build is that mechanism — once every applicable platform's `posted_*_at` is set on an `'approved'` article, status advances to `'published'`.

### New Storage bucket

```sql
insert into storage.buckets (id, name, public)
values ('social-post-images', 'social-post-images', true)
on conflict (id) do nothing;
```

**Public, not private — a deliberate divergence from the `documents` bucket's convention, with a stated reason:** these images carry no customer PII and are pre-destined for public posting anyway, so a stable public URL is directly useful for the manual copy-paste workflow, unlike a rotating signed URL. Flagging this explicitly since it's a real precedent break, not an oversight.

---

## Real queries

### Customer Testimonial

```sql
select
  s.id as survey_id,
  s.levr_overall_rating,
  s.levr_overall_comment,
  cs.make,
  cs.model
from post_deal_surveys s
join customer_searches cs on cs.id = s.customer_search_id
where s.submitted_at is not null
  and s.submitted_at >= :week_data_start   -- the just-completed Monday, America/Chicago
  and s.submitted_at <  :week_data_end     -- the just-completed Sunday's end
  and s.levr_overall_comment is not null
  and length(trim(s.levr_overall_comment)) > 0
  and s.levr_overall_rating >= 4
order by s.levr_overall_rating desc, s.submitted_at desc
limit 1;
```

**`levr_overall_rating >= 4` is a real, necessary filter I'm adding, not in the original ask — flagging prominently rather than burying it.** Without it, a genuinely low or lukewarm rating's comment could get featured as if it were a glowing testimonial. Only 4–5 star responses are eligible. If zero qualifying rows exist for the week, the theme is skipped entirely (no row created), per spec.

Selection among multiple candidates in the same week: highest rating first, most recent as tiebreaker — a reasonable default, flagged for override if you'd rather do something else (e.g. random, or always the most recent regardless of rating tier above the floor).

### Deal of the Week

```sql
select
  cs.id as search_id,
  cs.make,
  cs.model,
  cs.trim,
  cs.purchased_at,
  qo.offer_price_cents,
  qo.msrp_cents,
  (qo.msrp_cents - qo.offer_price_cents) as discount_cents
from customer_searches cs
join qualifying_offers qo on qo.id = cs.purchased_qualifying_offer_id
where cs.search_status = 'purchased'
  and cs.purchased_at >= :week_data_start
  and cs.purchased_at <  :week_data_end
  and qo.is_below_msrp = true
order by discount_cents desc
limit 1;
```

Never selects customer name, email, or zip — structurally impossible to leak, not just a downstream formatting discipline. Selection among multiple real deals in the same week: biggest real discount below MSRP, a reasonable default flagged for override. If zero qualifying rows exist, the theme is skipped entirely, per spec.

---

## Scheduling

**Refactor, not duplication:** the DST-correct zoned-time conversion `article-schedule.ts` built for Phase 2 (naive-UTC-guess → format through `Intl` in `America/Chicago` → correct by the difference) gets pulled out into a shared `src/lib/timezone.ts`, exporting `chicagoTimeToUtc(dateStr, hour, minute)`. `article-schedule.ts`'s `scheduledPublishAt` becomes a one-line call into it (`chicagoTimeToUtc(scheduledMonth, 0, 1)`), and the new `social-schedule.ts` reuses the exact same verified logic instead of a second copy.

```ts
// src/lib/social-schedule.ts
export type Theme =
  | "spotlight_monday" | "ask_around_tuesday" | "customer_testimonial"
  | "throwback_thursday" | "deal_of_the_week" | "news_recap_saturday" | "sunday_question";

export type Platform = "x" | "linkedin" | "facebook" | "instagram";

const THEME_DAY_OFFSET: Record<Theme, number> = {
  spotlight_monday: 0, ask_around_tuesday: 1, customer_testimonial: 2,
  throwback_thursday: 3, deal_of_the_week: 4, news_recap_saturday: 5, sunday_question: 6,
};

const PLATFORM_TIME: Record<Platform, { hour: number; minute: number }> = {
  x: { hour: 8, minute: 30 },
  linkedin: { hour: 9, minute: 0 },
  facebook: { hour: 10, minute: 0 },
  instagram: { hour: 11, minute: 30 },
};

/** Every platform actually scheduled for a given theme -- LinkedIn is absent for the two weekend themes. */
export function applicablePlatforms(theme: Theme): Platform[] {
  const weekend = theme === "news_recap_saturday" || theme === "sunday_question";
  return weekend ? ["x", "facebook", "instagram"] : ["x", "linkedin", "facebook", "instagram"];
}

/** Real UTC instant for one platform's post, or null if that platform doesn't post this theme's day. */
export function socialPostScheduledAt(weekStart: string, theme: Theme, platform: Platform): Date | null {
  if (!applicablePlatforms(theme).includes(platform)) return null;
  const dateStr = addDaysToDateString(weekStart, THEME_DAY_OFFSET[theme]);
  const { hour, minute } = PLATFORM_TIME[platform];
  return chicagoTimeToUtc(dateStr, hour, minute);
}

/** The Monday (America/Chicago) of the week containing `date`. */
export function weekStartFor(date: Date): string { /* ... */ }
```

---

## Generation pipeline

`src/lib/social-generation.ts`, one orchestrator: `generateWeeklySocialBatch(weekStart: string)`.

No "due" filter needed here (unlike articles' month-ahead pre-seeding) — this cron only ever targets one deterministic week per run (the upcoming Mon–Sun, computed from `weekStartFor(now)`), so there's nothing to search for across multiple candidate rows the way `generateDueArticleDrafts` has to. Idempotent via `on conflict (theme, week_start) do nothing` at the DB level, matching the "insert-if-new" convention already used elsewhere (`ensureDealerAliasesForListings`).

Per theme:

- **`customer_testimonial` / `deal_of_the_week`** — run the real query above. No row found → skip entirely (no insert). Row found → one forced-tool captions call, given the real data as context.
- **`spotlight_monday` / `throwback_thursday` / `news_recap_saturday`** — research call (`web_search_20250305`, `tool_choice` auto) → cleanup call (new prompt, forced tool) → captions call (forced tool, given the cleaned research as context).
- **`ask_around_tuesday` / `sunday_question`** — straight to the captions call, no research needed, system prompt alone carries the theme.

All captions calls share one tool schema (`src/lib/caption-tool.ts`, extracted from `article-generation.ts`, not redefined):

```ts
export const CAPTIONS_TOOL: Anthropic.Tool = {
  name: "generate_social_captions",
  description: "Generate one social media caption per platform.",
  input_schema: {
    type: "object",
    properties: {
      x_caption: { type: "string" },
      facebook_caption: { type: "string" },
      instagram_caption: { type: "string" },
      linkedin_caption: { type: "string" },
    },
    required: ["x_caption", "facebook_caption", "instagram_caption", "linkedin_caption"],
  },
};
```

Always requests all 4; for `news_recap_saturday`/`sunday_question` the returned `linkedin_caption` is simply discarded at write time rather than persisted, matching the "no LinkedIn weekend slot" schedule.

### System prompts, all for Brett's review before this ships

**New cleanup prompt** (analogous to the approved articles one, reworded for research text specifically — not a reuse of the approved wording):

> You clean up a freshly-drafted research summary. The draft may contain a leading meta-commentary sentence or two before the real content starts (e.g., a stray remark like "I found some good material" or "Here's what I found"), left over from an earlier drafting step. Remove only that kind of leading commentary — do not rewrite, shorten, rephrase, or otherwise change anything about the actual research content itself. If there's no such leading commentary, return the text completely unchanged. Always respond by calling the clean_research_text tool.

(Tool: `clean_research_text`, one field, `cleaned_content: string` — same shape as the articles cleanup tool, new name to avoid ambiguity between the two.)

**Spotlight Monday — research prompt:**

> You are researching one specific new vehicle for a "Spotlight Monday" social media feature for LEVR Auto, a nationwide car-buying negotiation service. Pick one specific, currently-available new vehicle (a real make, model, and model year) that's genuinely interesting this week — something newly redesigned, unusually popular, a strong value pick, or otherwise worth spotlighting. Use the web_search tool to find real, current, accurate facts: starting MSRP, key specs (powertrain, range or MPG, standout features), and what makes it stand out. Write a short research summary (3–5 sentences) covering the vehicle and the real facts you found — this is raw material for a social caption, not the caption itself. Never state a specific number or spec you haven't actually found via search.

**Spotlight Monday — captions prompt:**

> You write social media captions for LEVR Auto's "Spotlight Monday" feature, highlighting one specific new vehicle's real specs and appeal. You'll be given a short research summary about the vehicle to work from. Write one caption per platform: X, Facebook, Instagram, and LinkedIn (LinkedIn may be discarded if this falls on a weekend, but generate it anyway). Ground every specific fact (price, specs) only in what's given to you in the research summary — never invent or add a number that isn't there. Match LEVR Auto's plain, direct voice — no hype-filled marketing language. Platform conventions: X — short and punchy, well under 280 characters, 0–2 hashtags. Facebook — conversational, 1–3 short sentences. Instagram — similar to Facebook but more casual, 2–4 relevant hashtags. LinkedIn — more professional, can be a bit longer. None should sound like generic marketing copy. Always respond by calling the generate_social_captions tool.

**Ask-Around Tuesday — captions prompt** (no research call):

> You write social media captions for LEVR Auto's "Ask-Around Tuesday" feature — a genuine engagement question about cars or car-buying, meant to get real people commenting with their own opinions (favorite road trip car, most annoying dealership experience, dream car, etc.). Write one caption per platform: X, Facebook, Instagram, and LinkedIn. Each should ask essentially the same underlying question, phrased naturally for that platform's voice and length. Keep it light, genuinely curious, and easy to answer in one line — not a survey, not a sales pitch. Match LEVR Auto's plain, direct voice. Platform conventions: X — short and punchy, well under 280 characters. Facebook — conversational, inviting. Instagram — casual, 1–3 relevant hashtags. LinkedIn — can lean slightly more toward a professional/industry angle (e.g. car-buying experiences) while still being a real question. Always respond by calling the generate_social_captions tool.

**Customer Testimonial — captions prompt** (no research call, real data as context):

> You write social media captions for LEVR Auto's "Customer Testimonial" feature, sharing a real customer's rating and comment about their experience with LEVR Auto. You'll be given the real star rating, the real comment text, and the vehicle make/model they bought — use only what's given, never invent additional details, and never include the customer's name or any identifying details (none will be given to you). Write one caption per platform: X, Facebook, Instagram, and LinkedIn, each featuring the real comment (quoted or lightly paraphrased, never altering its meaning) with light framing around it. Match LEVR Auto's plain, direct voice — let the real testimonial carry the weight, don't oversell it. Platform conventions: X — short and punchy, well under 280 characters. Facebook — conversational, can include a bit more of the quote. Instagram — similar tone, 2–3 relevant hashtags. LinkedIn — slightly more professional framing. Always respond by calling the generate_social_captions tool.

**Throwback Thursday — research prompt:**

> You are researching a "Throwback Thursday" automotive history fact for LEVR Auto's social media, ideally tied to this week's actual date (an "on this day in automotive history" angle) if a genuinely interesting one exists, or otherwise any real, verifiable automotive history story worth sharing. Use the web_search tool to find a real, accurate historical fact or story — a landmark car launch, a notable automotive milestone, an interesting bit of industry history. Write a short research summary (3–5 sentences) covering what you found and why it's interesting — this is raw material for a social caption, not the caption itself. Never state a specific date, name, or fact you haven't actually verified via search.

**Throwback Thursday — captions prompt:**

> You write social media captions for LEVR Auto's "Throwback Thursday" feature, sharing a real piece of automotive history. You'll be given a short research summary to work from. Write one caption per platform: X, Facebook, Instagram, and LinkedIn. Ground every specific fact (dates, names, details) only in what's given to you in the research summary — never invent or add a detail that isn't there. Match LEVR Auto's plain, direct voice — genuinely interesting, not a dry trivia recitation. Platform conventions: X — short and punchy, well under 280 characters, can use a #tbt-style hashtag. Facebook — conversational, a bit more storytelling room. Instagram — similar tone, 2–4 relevant hashtags. LinkedIn — can frame around the industry/business angle of the history. Always respond by calling the generate_social_captions tool.

**Deal of the Week — captions prompt** (no research call, real data as context):

> You write social media captions for LEVR Auto's "Deal of the Week" feature, announcing a real deal LEVR closed for a customer this week. You'll be given the real vehicle make/model, the real MSRP, and the real discount amount below MSRP — use only these facts, never invent additional details, and never include any customer name, location, or identifying detail (none will be given to you, and none should ever be implied). Write one caption per platform: X, Facebook, Instagram, and LinkedIn, each highlighting the real discount as proof of LEVR's negotiation work. Match LEVR Auto's plain, direct voice — no hype, let the real number speak for itself. Platform conventions: X — short and punchy, well under 280 characters. Facebook — conversational, can restate the discount clearly. Instagram — similar tone, 2–4 relevant hashtags. LinkedIn — can frame around the practical value/proof-of-results angle. Always respond by calling the generate_social_captions tool.

**News Recap Saturday — research prompt:**

> You are researching the single most interesting real automotive news story from the past 7 days for LEVR Auto's "News Recap Saturday" social media feature. Use the web_search tool to find real, current automotive industry news — new model announcements, pricing changes, industry trends, recalls, or other genuinely newsworthy stories from the past week. Pick the one story most relevant and interesting to someone shopping for a new car. Write a short research summary (3–5 sentences) covering the story and the real facts you found — this is raw material for a social caption, not the caption itself. Never state a specific number, date, or fact you haven't actually found via search.

**News Recap Saturday — captions prompt:**

> You write social media captions for LEVR Auto's "News Recap Saturday" feature, sharing the most interesting real automotive news story from the past week. You'll be given a short research summary to work from. Write one caption per platform: X, Facebook, Instagram, and LinkedIn. Ground every specific fact only in what's given to you in the research summary — never invent or add a detail that isn't there. Match LEVR Auto's plain, direct voice. Platform conventions: X — short and punchy, well under 280 characters, news-headline energy. Facebook — conversational, a bit more context. Instagram — similar tone, 2–4 relevant hashtags. LinkedIn — can frame around the industry/business implications. Always respond by calling the generate_social_captions tool.

**Sunday Question — captions prompt** (no research call):

> You write social media captions for LEVR Auto's "Sunday Question" feature — a light, personal engagement prompt, less car-specific than Ask-Around Tuesday and more about weekend/lifestyle vibes with a car-adjacent angle (best road trip destination, car you learned to drive in, weekend errands playlist, etc.). Write one caption per platform: X, Facebook, Instagram, and LinkedIn (LinkedIn may be discarded since this falls on a weekend, but generate it anyway). Keep it genuinely light and easy to answer in one line. Match LEVR Auto's plain, direct voice — friendly, not salesy, no need to mention LEVR's service directly. Platform conventions: X — short and punchy, well under 280 characters. Facebook — warm, conversational. Instagram — casual, 1–3 relevant hashtags. LinkedIn — tone doesn't matter much since it won't actually post, just keep it consistent. Always respond by calling the generate_social_captions tool.

---

## Review page — `/internal/social`

Same shell/shape as `/internal/articles` (`requireAgent()`, `force-dynamic`). Two sections:

1. **This week's drafts** — every `status = 'draft'` `social_posts` row for the upcoming `week_start`, one card per theme (up to 7, fewer if Testimonial/Deal-of-the-Week were skipped). Each card: 4 caption textareas (3 for weekend themes — no LinkedIn field shown at all, not just disabled), a new **image attach field** (file input → uploads to `social-post-images` via a Server Action mirroring `submitFinancingChoice`'s upload pattern, shows a preview once attached), and the same three actions as articles: **Save**, **Approve**, **Regenerate** (confirm-gated, re-runs that theme's specific pipeline — research+cleanup+captions, or straight-to-captions, or the real-data query, depending on theme).
2. **`/internal/articles` also gets the same new image-attach field added** to its existing review form, per the explicit "every post (including articles) gets an image" requirement — no other change to that page's already-working Save/Approve/Regenerate logic.

---

## Posting worklist

Folded into the same `/internal/social` page as a third, read-only-except-for-the-mark-posted-buttons section — a live copy-paste worklist, not a separate page, since "approved and due" is naturally a subset of the same weekly view.

`getPostingWorklist()` combines two sources into one flat list of individual platform-posts, each due (`scheduledAt <= now()`) and not yet posted on that specific platform:

- From `social_posts` at `status IN ('approved', 'published')`: one entry per platform in `applicablePlatforms(theme)` where that platform's `posted_*_at` is still null and `socialPostScheduledAt(week_start, theme, platform) <= now()`.
- From `articles` at `status IN ('approved', 'published')` with `published_at <= now()`: one entry per platform (all 4 always applicable) where that platform's `posted_*_at` is still null.

Each worklist item shows: platform, the real caption text (copy-friendly), the attached image (if any — a public URL resolved directly from `image_storage_path`, no signed-URL machinery needed since the bucket is public), and a **"Mark posted"** button (`markPlatformPosted(sourceType, id, platform)`) that sets that one `posted_*_at` column; once every applicable platform for that row has a value, `status` advances to `'published'` in the same write.

---

## File layout summary

- `supabase/migrations/20260825130000_social_posts.sql` — the new table, the `articles` extension, the new bucket.
- `src/lib/timezone.ts` — `chicagoTimeToUtc()`, extracted from `article-schedule.ts`.
- `src/lib/article-schedule.ts` — `scheduledPublishAt()` becomes a thin wrapper over `chicagoTimeToUtc`, otherwise unchanged.
- `src/lib/social-schedule.ts` — `socialPostScheduledAt()`, `applicablePlatforms()`, `weekStartFor()`.
- `src/lib/caption-tool.ts` — `CAPTIONS_TOOL`, extracted from `article-generation.ts`, imported by both.
- `src/lib/social-generation.ts` — `generateWeeklySocialBatch(weekStart)`, the 7 theme handlers, the new cleanup call.
- `src/lib/social-queue.ts` — `getDraftSocialPosts(weekStart)`, `getPostingWorklist()`.
- `src/lib/social-actions.ts` — `"use server"`: `updateSocialPostDraft`, `approveSocialPost`, `regenerateSocialPost`, `attachSocialPostImage`, `markPlatformPosted` — all agent-gated.
- `src/lib/article-actions.ts` — gains `attachArticleImage`, and `markPlatformPosted` is shared/reused for the `articles` source type too.
- `src/app/api/cron/generate-social-batch/route.ts` — Sunday evening, next open UTC hour slot.
- `src/app/internal/social/page.tsx`, `src/components/social-post-review-form.tsx`.
- `src/components/article-review-form.tsx` — gains the image-attach field.

## Flagged defaults, not yet confirmed line-by-line

- Testimonial minimum rating (4–5 stars only) and tie-break (highest rating, then most recent).
- Deal-of-the-Week selection among multiple real candidates (biggest discount below MSRP).
- Image bucket is public (reasoning above).
- Cron time for `generate-social-batch` — proposing Sunday 22:00 UTC (~5–6pm Central depending on DST), next open slot after articles' two crons; open to a different hour.
