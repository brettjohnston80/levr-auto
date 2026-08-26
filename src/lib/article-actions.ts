"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduledPublishAt } from "@/lib/article-schedule";
import { generateArticleDraft } from "@/lib/article-generation";

export type ArticleActionResult = { ok: true } | { ok: false; error: string };

export interface ArticleEdits {
  content: string;
  captionX: string;
  captionFacebook: string;
  captionInstagram: string;
  captionLinkedin: string;
}

/**
 * Persists in-progress edits without changing status -- guarded to only
 * ever touch a row still in 'draft' (an agent's stale open tab can't
 * accidentally overwrite an already-approved article).
 */
export async function updateArticleDraft(articleId: string, edits: ArticleEdits): Promise<ArticleActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("articles")
    .update({
      content: edits.content,
      caption_x: edits.captionX,
      caption_facebook: edits.captionFacebook,
      caption_instagram: edits.captionInstagram,
      caption_linkedin: edits.captionLinkedin,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: `Failed to save: ${error.message}` };
  }
  if (!updated) {
    return { ok: false, error: "This article is no longer a draft -- reload the page." };
  }

  revalidatePath("/internal/articles");
  return { ok: true };
}

/**
 * Saves whatever's currently in the form AND transitions status in the
 * same write, so Approve can never publish stale saved content if the
 * agent forgot to hit Save first. published_at: if the article's scheduled
 * publish instant is still in the future, use that (stays correctly
 * invisible on the public site until then, same mechanism already proven
 * for the September MSRP article); if it's already passed (a late
 * approval), publish immediately rather than waiting for a date that's
 * already gone.
 *
 * status becomes 'approved', not 'published' -- see the Phase 2 plan for
 * why 'published' stays reserved for a later phase. getPublishedArticles()/
 * getPublishedArticleBySlug() already treat 'approved' as live.
 */
export async function approveArticle(articleId: string, edits: ArticleEdits): Promise<ArticleActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data: article, error: fetchError } = await admin
    .from("articles")
    .select("scheduled_month, status")
    .eq("id", articleId)
    .maybeSingle();

  if (fetchError || !article) {
    return { ok: false, error: "Article not found." };
  }
  if (article.status !== "draft") {
    return { ok: false, error: "This article is no longer a draft -- reload the page." };
  }

  const scheduled = scheduledPublishAt(article.scheduled_month);
  const now = new Date();
  const publishedAt = scheduled > now ? scheduled : now;

  const { data: updated, error: updateError } = await admin
    .from("articles")
    .update({
      status: "approved",
      approved_at: now.toISOString(),
      approved_by_agent_id: agent.id,
      published_at: publishedAt.toISOString(),
      content: edits.content,
      caption_x: edits.captionX,
      caption_facebook: edits.captionFacebook,
      caption_instagram: edits.captionInstagram,
      caption_linkedin: edits.captionLinkedin,
      updated_at: now.toISOString(),
    })
    .eq("id", articleId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: `Failed to approve: ${updateError.message}` };
  }
  if (!updated) {
    return { ok: false, error: "This article is no longer a draft -- reload the page." };
  }

  revalidatePath("/internal/articles");
  revalidatePath("/articles");
  revalidatePath("/sitemap.xml");
  return { ok: true };
}

/**
 * Discards the current draft + captions and generates a fresh one on
 * demand. Guarded to only fire on a row still 'draft' -- generateArticleDraft
 * always writes status='draft' regardless of the row's current status, so
 * without this check a stale Regenerate click could wrongly un-approve an
 * article an agent already approved in another tab.
 */
export async function regenerateArticleDraft(articleId: string): Promise<ArticleActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data: article } = await admin.from("articles").select("status").eq("id", articleId).maybeSingle();

  if (!article || article.status !== "draft") {
    return { ok: false, error: "This article is no longer a draft -- reload the page." };
  }

  const result = await generateArticleDraft(articleId);
  if (!result.ok) {
    return result;
  }

  revalidatePath("/internal/articles");
  return { ok: true };
}

/**
 * Uploads a manually-attached image for an article -- same upload pattern
 * as submitFinancingChoice/attachSocialPostImage, same social-post-images
 * bucket (public, no PII either way), namespaced under articles/ so the
 * two source types never collide in the bucket listing.
 */
export async function attachArticleImage(articleId: string, formData: FormData): Promise<ArticleActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please choose an image." };
  }

  const admin = createAdminClient();
  const path = `articles/${articleId}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await admin.storage
    .from("social-post-images")
    .upload(path, file, { contentType: file.type || undefined });

  if (uploadError) {
    return { ok: false, error: `Failed to upload image: ${uploadError.message}` };
  }

  const { error: updateError } = await admin
    .from("articles")
    .update({ image_storage_path: path, updated_at: new Date().toISOString() })
    .eq("id", articleId);

  if (updateError) {
    return { ok: false, error: `Uploaded but failed to save: ${updateError.message}` };
  }

  revalidatePath("/internal/articles");
  return { ok: true };
}
