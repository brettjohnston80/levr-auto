# Articles System — Phase 2 Plan (auto-draft generation, review/approval, reminders)

Written to a file because the plan kept getting corrupted mid-line in chat (same issue as long SQL migrations). Full plan below, nothing abbreviated.

Two open questions from the original plan message are already resolved by Brett:
- **Approve action sets `status = 'approved'`** (not `'published'` directly) — confirmed. `getPublishedArticles()`/`getPublishedArticleBySlug()` will be updated to treat `status IN ('approved', 'published')` + `published_at <= now()` as live. `'published'` stays reserved for a future phase (e.g. once social auto-posting is done).
- **Add a "Regenerate" action** on `/internal/articles` — confirmed, build it, confirm-gated since it discards unsaved edits.

---

## Investigation notes (existing conventions reused, not reinvented)

- **Anthropic client**: `getAnthropic()` in `src/lib/anthropic.ts` — reused as-is. SDK (`@anthropic-ai/sdk ^0.117.1`) supports `web_search_20250305` as a server tool the model can call autonomously mid-turn (Anthropic executes it inline, no client-side loop needed).
- **Forced-tool pattern**: `offer-parsing-actions.ts` already establishes the "forced `tool_choice` for structured output" idiom — reused for captions, but *not* for the article body itself, since forcing a custom tool_choice would block the model from calling `web_search` first. That call runs with `tool_choice` left at its default (auto), and we extract the model's final plain-text answer.
- **"Sent-once" idiom**: `deadline_reminder_sent_for` / `resume_reminder_sent_for` (`day60-extension.ts`) compare a stored timestamp against a *single, possibly-changing* target value. The reminder system here needs four *ordered, fixed* thresholds against one fixed target (the scheduled publish date doesn't move) — a different shape, so the idiom is adapted rather than reused verbatim (see schema below).
- **Agent auth / page shape**: `requireAgent()` + a `force-dynamic` server component, same as `/internal/dealerships`.
- **Email**: `sendEmail()` in `src/lib/email.ts` is fully generic — reused as-is. No prior precedent exists anywhere in this codebase for emailing an *agent* (every existing "agent notification" is an in-app queue on `/internal/outreach`) — this is genuinely new. Sends to every row in `agents` with `active = true`, not hardcoded to Brett, since the table's already built for more than one agent.
- **Textarea styling**: `rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white`, consistent everywhere it's used in this codebase.
- **No jsonb precedent for fixed-shape data** — `offer_addons`, `deal_progress`, `dealer_aliases` all use flat columns. Captions get 4 flat text columns here too, not a JSON blob.

## Real ambiguity found during planning (for context — already resolved above)

"Match the tone of the two already-published articles" — only *one* article is actually published today (MSRP vs. Invoice Price); "Top 10 New Cars of 2027" is still `not_started`, no content in the DB. Rather than hardcode a count, the generation prompt pulls *whatever's currently published* (newest-first, capped at 3) as style references — right now that's 1 article, growing automatically as more publish. Flagging in case Brett has Top 10's manually-researched text somewhere to seed instead.

---

## Schema (new migration, additive only — no Phase 1 columns touched)

```sql
alter table public.articles
  add column caption_x text,
  add column caption_facebook text,
  add column caption_instagram text,
  add column caption_linkedin text,
  add column reminder_last_threshold_days smallint
    check (reminder_last_threshold_days in (5, 2, 1, 0)),
  add column reminder_last_sent_at timestamptz;
```

- Four flat caption columns, not a JSON blob — matches how every fixed-shape record in this codebase is stored.
- `reminder_last_threshold_days` is the "sent-once" tracker, adapted for an *ordered* series instead of the existing idiom's single-value comparison: it stores the most urgent threshold (5/2/1/0 days-before) already notified. Each cron run computes the most-urgent-currently-due threshold and only sends if it's more urgent (numerically smaller) than what's stored — naturally escalates, naturally no-ops on repeat runs, and naturally catches up (sends the single most-urgent threshold, not a backlog) if a run was ever missed. Doesn't need to be reset by Regenerate — the target date never moves, only the content does.
- `updated_at` (already on the table, never written to by anyone since Phase 1) starts actually getting set on every write from here on.

---

## Scheduling math (`src/lib/article-schedule.ts`, new file)

One function everything shares — the due-check, Approve, and reminders all need "first-of-month 00:01 America/Chicago as a real UTC instant," and Phase 1 only ever hand-computed that once, for one known date (September 2026). This is a standard DST-correct zoned-time conversion (no hardcoded offset): construct a naive UTC guess for the wall-clock time, format that guess back through the target timezone to see what wall time it actually represents there, and correct by the difference.

```ts
import "server-only";

/**
 * Converts "first of month, 00:01 America/Chicago" into the real UTC
 * instant it represents, correctly across DST -- no hardcoded offset.
 * Standard technique: build a naive UTC timestamp using the wall-clock
 * numbers directly, then ask Intl what wall-clock time that instant
 * actually renders as in the target zone, and correct by the difference
 * between what we wanted and what we got.
 */
export function scheduledPublishAt(scheduledMonth: string): Date {
  const [year, month, day] = scheduledMonth.split("-").map(Number);

  // Step 1: naive guess -- treat 00:01 on the 1st as if it were already UTC.
  const naiveUTC = Date.UTC(year, month - 1, day, 0, 1, 0);

  // Step 2: ask what wall-clock time that naive guess actually is in
  // America/Chicago.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(naiveUTC)).map((part) => [part.type, part.value])
  ) as Record<string, string>;

  const renderedAsUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  // Step 3: the difference between what we wanted (naiveUTC, interpreted as
  // wall-clock numbers) and what we actually got back (renderedAsUTC) is
  // exactly the correction needed -- add it back to the naive guess.
  const correction = naiveUTC - renderedAsUTC;
  return new Date(naiveUTC + correction);
}

/** Escalating reminder checkpoints, in days before the scheduled publish instant. */
export const REMINDER_THRESHOLDS_DAYS = [5, 2, 1, 0] as const;

/** How far ahead of a scheduled month the draft-generation cron starts trying. */
export const DRAFT_GENERATION_LEAD_DAYS = 7;
```

Verified by hand: `scheduledPublishAt("2026-09-01")` produces `2026-09-01T05:01:00.000Z` — matching the CDT (UTC-5) offset already confirmed correct for that date in Phase 1.

---

## 1. Draft generation

`src/lib/article-generation.ts`:

- `generateDueArticleDrafts()` (cron entry point): finds every `status = 'not_started'` row where `scheduledPublishAt(scheduled_month).getTime() - Date.now() <= DRAFT_GENERATION_LEAD_DAYS * 86400000` — an *at-least* check (same catch-up-tolerant idiom as the Day-30/Day-60 jobs), so a missed run or a repeated failure just gets retried the next day, indefinitely, even past the scheduled date if generation kept failing. Calls `generateArticleDraft` for each due row, continuing past individual failures (same "continue past failures" convention as `runBatchSync` in `marketcheck-scheduler.ts`).

- `generateArticleDraft(articleId)` (singular, shared by the cron and the agent-triggered Regenerate action): two Claude calls, one DB write.

### Call 1 — article body, web search enabled, no forced tool

```ts
const styleRefs = (await getPublishedArticles()).slice(0, 3);

const message = await getAnthropic().messages.create({
  model: "claude-sonnet-5",
  max_tokens: 8000,
  system: buildGenerationSystemPrompt(styleRefs),
  tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
  messages: [{ role: "user", content: `Title: "${title}"\nTopic: "${topic}"` }],
});
// final text block(s), concatenated = the article's markdown content
```

**Full system prompt, for Brett's review before this ships:**

```
You are writing a blog article for LEVR Auto's public website (levrauto.com/articles). LEVR Auto is a nationwide car-buying negotiation service: a customer picks one exact new-vehicle make and model, pays a flat $699 fee, and LEVR sources matching dealer inventory nationwide and negotiates on their behalf. Offers land in the customer's dashboard for them to accept or decline — no obligation. LEVR's guarantee: if it can't bring the customer at least one real offer below MSRP within 30 days, the $699 is refunded automatically. LEVR takes no commission or markup and never processes the vehicle payment itself. Use these facts about LEVR exactly as given if you reference the business — do not search the web for information about LEVR Auto itself, and do not invent details about how it works beyond what's stated here.

You have a web_search tool. Use it to find current, accurate, real information for the article's actual subject matter — pricing data, rankings, dates, statistics, dealer practices, whatever the topic requires. Never state a specific number, ranking, date, or statistic you haven't actually found via search; if you can't verify something, write around it rather than guessing.

Style: match the tone of LEVR Auto's other published articles, provided below as reference. Plain, direct, no hype-filled marketing language, no fabricated quotes or testimonials. Explain the actual mechanics of whatever the topic is the way a knowledgeable friend would, not a sales pitch. It's fine, and expected, to end with a short, natural tie back to LEVR's own pitch where it's relevant to the topic — but don't force it into every paragraph.

Formatting: respond with the article body only, in Markdown. Do not include the title as a heading (it's rendered separately) — start directly with the opening paragraph. Use "## " for section headers where they help the piece (2 to 4 sections is typical), and never use a single "#". Avoid bullet lists and bold text except where they genuinely aid readability — the reference articles below use almost none. Aim for roughly 500–900 words.

Reference articles (match this voice):

[—— up to 3 most-recently-published articles, title + full content, injected here at generation time ——]
```

### Call 2 — captions, forced tool, no web search

```ts
const CAPTIONS_TOOL: Anthropic.Tool = {
  name: "generate_social_captions",
  description:
    "Generate one social media caption per platform announcing a new LEVR Auto blog article.",
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

**Full system prompt, for Brett's review before this ships:**

```
You write social media captions announcing a new LEVR Auto blog article, one caption per platform: X, Facebook, Instagram, and LinkedIn. Each caption must include the article's URL exactly as given, written as plain text (not a markdown link). Match each platform's real conventions: X — short and punchy, well under 280 characters including the URL, 0–2 hashtags at most. Facebook — conversational, 1–3 short sentences, can pose a question or hook. Instagram — similar to Facebook but can lean more casual, 2–4 relevant hashtags at the end. LinkedIn — more professional, can be a bit longer, frame around the practical takeaway. None should sound like generic marketing copy — write like a real person sharing something genuinely useful, matching LEVR Auto's plain, direct voice. No hype, no exclamation-point stacking. Always respond by calling the generate_social_captions tool.
```

Called with the article's title, topic, full markdown content, and its real URL (`${NEXT_PUBLIC_SITE_URL}/articles/${slug}`, same fallback-to-localhost convention used everywhere else in this codebase) as user content, and `tool_choice: { type: "tool", name: "generate_social_captions" }`.

- One DB write on success: `status = 'draft'`, `content`, all 4 captions, `updated_at = now()`.
- On any failure (either call, or an empty/truncated response): logged, row untouched, naturally retried next day per the at-least-due check.

---

## 2. Captions

Confirmed: generated in the same pass, stored alongside the draft, reviewed and approved together — not generated or approved separately.

---

## 3. `/internal/articles`

- `src/lib/article-queue.ts`: `getDraftArticles()` — `status = 'draft'`, ordered by `scheduled_month`.
- `src/app/internal/articles/page.tsx` — `requireAgent()`-gated, `force-dynamic`, same shell as `/internal/dealerships`.
- `src/components/article-review-form.tsx` — one per article: a plain `<textarea>` for content (large, ~20 rows), four smaller textareas for the captions, a computed "days until scheduled publish" / "OVERDUE" badge, and three actions:
  - **Save** → `updateArticleDraft(id, { content, captions })` — persists edits, stays `'draft'`.
  - **Approve** → `approveArticle(id, { content, captions })` — persists whatever's currently in the form *and* transitions status in the same write (never approves stale saved content if Brett forgot to hit Save first).
  - **Regenerate** (confirm-gated: "This discards the current draft and captions — regenerate?") → `regenerateArticleDraft(id)`, an agent-gated wrapper around `generateArticleDraft`.

---

## 4. Approve action

```ts
const scheduled = scheduledPublishAt(article.scheduled_month);
const publishedAt = scheduled > new Date() ? scheduled : new Date();
// Write: status = 'approved', approved_at = now(), approved_by_agent_id = agent.id,
// published_at = publishedAt, content/captions = whatever's in the form, updated_at = now()
```

Plus the display-query change confirmed above: `getPublishedArticles()`/`getPublishedArticleBySlug()` change their filter from `status = 'published'` to `status IN ('approved', 'published')`.

---

## 5. Reminders

`src/lib/article-reminders.ts`, `sendArticleReminders()`:

- Fetches `status = 'draft'` rows, computes `daysRemaining = scheduledPublishAt(scheduled_month) - now()` in application code (same "fetch small set, compute in JS" convention as `inventory-count.ts`/`day60-extension.ts` — PostgREST can't filter on this expression either).
- `mostUrgentDue = min(t in [5,2,1,0] where daysRemaining <= t)`; sends only if `reminder_last_threshold_days` is null or greater (less urgent) than `mostUrgentDue`.
- Recipients: every `agents` row with `active = true`.
- Email copy (escalating by threshold — this is an internal ops email, not customer-facing, so it isn't gated by the customer-copy sign-off rule, but included here for visibility):
  - **5 / 2 / 1 days out** — Subject: `"{{daysRemaining}} day(s) left to review: {{title}}"`. Body: `"The draft for \"{{title}}\" is scheduled to go live {{date}} and hasn't been approved yet. Review it at {{internalArticlesUrl}}."`
  - **0 (day-of)** — Subject: `"Today is the scheduled publish date: {{title}}"`. Body: `"\"{{title}}\" was scheduled to go live today and still hasn't been approved. It won't publish on its own — review and approve as soon as you can: {{internalArticlesUrl}}."`
- After threshold `0` fires, nothing further — confirmed: an unapproved overdue article just shows an "OVERDUE" badge on `/internal/articles` forever, no auto-publish, ever.

---

## Crons (`vercel.json`, next two open UTC hour slots)

```json
{ "path": "/api/cron/generate-article-draft", "schedule": "0 14 * * *" },
{ "path": "/api/cron/article-reminder", "schedule": "0 15 * * *" }
```

Both daily, both the standard `Authorization: Bearer $CRON_SECRET` GET route, same pattern as every other cron in this project.

---

## File layout summary

- `supabase/migrations/<ts>_article_review_system.sql` — the 6 new columns above.
- `src/lib/article-schedule.ts` — `scheduledPublishAt()`, `REMINDER_THRESHOLDS_DAYS`, `DRAFT_GENERATION_LEAD_DAYS`.
- `src/lib/article-generation.ts` — `generateDueArticleDrafts()`, `generateArticleDraft(articleId)`.
- `src/lib/article-queue.ts` — `getDraftArticles()`.
- `src/lib/article-reminders.ts` — `sendArticleReminders()`.
- `src/lib/article-actions.ts` — `"use server"`: `updateArticleDraft`, `approveArticle`, `regenerateArticleDraft` (all agent-gated via `getAuthorizedAgent()`).
- `src/app/api/cron/generate-article-draft/route.ts`, `src/app/api/cron/article-reminder/route.ts`.
- `src/app/internal/articles/page.tsx`, `src/components/article-review-form.tsx`.
- `src/lib/articles.ts` — `getPublishedArticles()`/`getPublishedArticleBySlug()` filter updated to `status IN ('approved', 'published')`.
- `vercel.json` — the two new cron entries.

---

## What's still open before coding starts

Just the two system prompts above — Brett wants to review the exact wording before this ships, since it's the app generating real content with no one watching until review.
