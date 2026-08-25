-- Real fix, caught during Phase 1 verification (2026-08-25): the September
-- 2026 row was seeded with status='approved', but getPublishedArticles()/
-- getPublishedArticleBySlug() (src/lib/articles.ts) only ever show
-- status='published' AND published_at <= now(). Nothing in Phase 1 promotes
-- a row from approved -> published (that's the not-yet-built review/
-- approval page) -- so as originally seeded, this article would never go
-- live, even after its scheduled published_at. published_at is meant to be
-- the sole real time-gate (see the articles table comment: "same pattern as
-- delivered_at/finalized_at"), so this flips status to 'published' now --
-- published_at, unchanged, is what keeps it correctly invisible until
-- 2026-09-01 05:01 UTC.
update public.articles
set status = 'published'
where slug = 'msrp-vs-invoice-price';
