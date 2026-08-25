import type { Metadata } from "next";
import Link from "next/link";
import { excerptFromMarkdown, getPublishedArticles } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Articles — LEVR Auto",
  description: "Straight answers on car buying, pricing, and negotiation from the LEVR Auto team.",
};

function formatPublishedDate(publishedAt: string): string {
  return new Date(publishedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ArticlesPage() {
  const articles = await getPublishedArticles();

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Articles</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Straight answers on car buying, pricing, and negotiation — no dealer spin.
        </p>

        {articles.length === 0 ? (
          <p className="mt-10 text-sm text-zinc-500">
            Nothing published yet — check back soon.
          </p>
        ) : (
          <div className="mt-10 divide-y divide-white/10 border-t border-white/10">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/articles/${article.slug}`}
                className="group block py-8 first:pt-0"
              >
                <p className="text-xs text-zinc-500">{formatPublishedDate(article.publishedAt)}</p>
                <h2 className="mt-2 text-xl font-semibold text-white transition-colors group-hover:text-emerald-400">
                  {article.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {excerptFromMarkdown(article.content)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
