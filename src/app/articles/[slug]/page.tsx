import type { Metadata } from "next";
import type { ComponentPropsWithoutRef } from "react";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getPublishedArticleBySlug } from "@/lib/articles";

// Styled to match /privacy's existing prose conventions (max-w-3xl,
// text-zinc-400 body copy, mt-10 h2s) -- there's no card-based long-form
// content pattern anywhere in this codebase, /privacy's plain prose shell
// is the closest match. react-markdown renders straight to real React
// elements (no dangerouslySetInnerHTML anywhere in this app).
const markdownComponents = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h2 className="mt-10 text-lg font-semibold text-white" {...props} />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2 className="mt-10 text-lg font-semibold text-white" {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mt-8 text-base font-semibold text-white" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-zinc-400 sm:text-base" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-400 sm:text-base" {...props} />
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => (
    <a className="text-emerald-400 underline hover:text-emerald-300" {...props} />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-zinc-300" {...props} />
  ),
};

function formatPublishedDate(publishedAt: string): string {
  return new Date(publishedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);

  if (!article) return {};

  return {
    title: `${article.title} — LEVR Auto`,
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <section className="bg-zinc-950 py-24">
      <article className="mx-auto max-w-3xl px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-3 text-sm text-zinc-500">{formatPublishedDate(article.publishedAt)}</p>

        <div className="mt-8">
          <ReactMarkdown components={markdownComponents}>{article.content}</ReactMarkdown>
        </div>
      </article>
    </section>
  );
}
