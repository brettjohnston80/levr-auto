import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PublishedArticle {
  slug: string;
  title: string;
  content: string;
  publishedAt: string;
}

/**
 * The only real publish gate: status IN ('approved', 'published') AND
 * published_at <= now(), both checked server-side here -- never trusted
 * from a client query or from status alone, since a row can be live-status
 * with a published_at still in the future (that's how a scheduled article
 * stays invisible until its exact go-live moment). Same convention as every
 * other RLS-locked table in this app -- reads go through the admin client
 * with an explicit filter, not a client-facing read policy.
 *
 * 'approved' is included (not just 'published') per the Phase 2 design:
 * Approve sets status='approved' and that's as far as the review workflow
 * takes it -- 'published' is reserved for a later phase (e.g. once social
 * auto-posting is done), so an approved-and-due article needs to show up
 * here or it would never go live at all.
 */
export async function getPublishedArticles(): Promise<PublishedArticle[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("articles")
    .select("slug, title, content, published_at")
    .in("status", ["approved", "published"])
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (error || !data) return [];

  return data
    .filter((row): row is typeof row & { content: string; published_at: string } => Boolean(row.content && row.published_at))
    .map((row) => ({
      slug: row.slug,
      title: row.title,
      content: row.content,
      publishedAt: row.published_at,
    }));
}

export async function getPublishedArticleBySlug(slug: string): Promise<PublishedArticle | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("articles")
    .select("slug, title, content, published_at")
    .eq("slug", slug)
    .in("status", ["approved", "published"])
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data || !data.content || !data.published_at) return null;

  return {
    slug: data.slug,
    title: data.title,
    content: data.content,
    publishedAt: data.published_at,
  };
}

/**
 * Plain-text teaser for the listing page -- strips markdown syntax (headers,
 * bold/italic markers) rather than rendering it, and takes the first
 * paragraph only, truncated to a sentence-ish boundary.
 */
export function excerptFromMarkdown(content: string, maxLength = 200): string {
  const firstParagraph = content.split(/\n\s*\n/)[0] ?? "";
  const plain = firstParagraph
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`]/g, "")
    .trim();

  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trimEnd()}…`;
}
