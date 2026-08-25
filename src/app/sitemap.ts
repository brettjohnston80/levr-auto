import type { MetadataRoute } from "next";
import { getPublishedArticles } from "@/lib/articles";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Only the real public routes that exist today -- everything else is
// auth-gated (/account, /internal/*, /finalize/*) or has no standalone
// public value (/auth/*, /payment/*, /forgot-password).
const ROUTES = ["/", "/faq", "/matchmaker", "/login", "/signup", "/terms", "/privacy", "/articles"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));

  // Same publish gate as the /articles pages themselves (status='published'
  // AND published_at <= now()) -- a scheduled-but-not-yet-live article never
  // appears here either.
  const articles = await getPublishedArticles();
  const articleRoutes = articles.map((article) => ({
    url: `${SITE_URL}/articles/${article.slug}`,
    lastModified: new Date(article.publishedAt),
  }));

  return [...staticRoutes, ...articleRoutes];
}
