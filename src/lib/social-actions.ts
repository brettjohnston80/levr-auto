"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { regenerateSocialPostContent } from "@/lib/social-generation";
import { markPlatformPosted as markPlatformPostedShared, type PostingSourceType } from "@/lib/social-posting";
import type { Platform } from "@/lib/social-schedule";

export type SocialActionResult = { ok: true } | { ok: false; error: string };

export interface SocialPostEdits {
  captionX: string;
  captionFacebook: string;
  captionInstagram: string;
  captionLinkedin: string | null;
}

/** Persists in-progress edits without changing status -- guarded to only ever touch a still-'draft' row. */
export async function updateSocialPostDraft(postId: string, edits: SocialPostEdits): Promise<SocialActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("social_posts")
    .update({
      caption_x: edits.captionX,
      caption_facebook: edits.captionFacebook,
      caption_instagram: edits.captionInstagram,
      caption_linkedin: edits.captionLinkedin,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: `Failed to save: ${error.message}` };
  }
  if (!updated) {
    return { ok: false, error: "This post is no longer a draft -- reload the page." };
  }

  revalidatePath("/internal/social");
  return { ok: true };
}

/**
 * Saves whatever's currently in the form AND transitions status in the
 * same write, so Approve can never publish stale saved content -- same
 * pattern as approveArticle.
 */
export async function approveSocialPost(postId: string, edits: SocialPostEdits): Promise<SocialActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: updated, error } = await admin
    .from("social_posts")
    .update({
      status: "approved",
      approved_at: now,
      approved_by_agent_id: agent.id,
      caption_x: edits.captionX,
      caption_facebook: edits.captionFacebook,
      caption_instagram: edits.captionInstagram,
      caption_linkedin: edits.captionLinkedin,
      updated_at: now,
    })
    .eq("id", postId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: `Failed to approve: ${error.message}` };
  }
  if (!updated) {
    return { ok: false, error: "This post is no longer a draft -- reload the page." };
  }

  revalidatePath("/internal/social");
  return { ok: true };
}

/**
 * Discards the current captions and generates fresh ones on demand.
 * Guarded to only fire on a row still 'draft'. For customer_testimonial/
 * deal_of_the_week this re-runs only the captions call against the
 * already-selected real source row (see regenerateSocialPostContent's own
 * doc comment) -- it can never surface a different testimonial or deal.
 */
export async function regenerateSocialPost(postId: string): Promise<SocialActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data: post } = await admin.from("social_posts").select("status").eq("id", postId).maybeSingle();

  if (!post || post.status !== "draft") {
    return { ok: false, error: "This post is no longer a draft -- reload the page." };
  }

  const result = await regenerateSocialPostContent(postId);
  if (!result.ok) {
    return result;
  }

  revalidatePath("/internal/social");
  return { ok: true };
}

/** Uploads a manually-attached image for a social post -- same upload pattern as submitFinancingChoice. */
export async function attachSocialPostImage(postId: string, formData: FormData): Promise<SocialActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please choose an image." };
  }

  const admin = createAdminClient();
  const path = `social-posts/${postId}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await admin.storage
    .from("social-post-images")
    .upload(path, file, { contentType: file.type || undefined });

  if (uploadError) {
    return { ok: false, error: `Failed to upload image: ${uploadError.message}` };
  }

  const { error: updateError } = await admin
    .from("social_posts")
    .update({ image_storage_path: path, updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (updateError) {
    return { ok: false, error: `Uploaded but failed to save: ${updateError.message}` };
  }

  revalidatePath("/internal/social");
  return { ok: true };
}

/** Shared worklist action -- marks one platform posted for either a social_post or an article. */
export async function markPlatformPosted(
  sourceType: PostingSourceType,
  sourceId: string,
  platform: Platform
): Promise<SocialActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const result = await markPlatformPostedShared(sourceType, sourceId, platform);
  if (!result.ok) {
    return result;
  }

  revalidatePath("/internal/social");
  return { ok: true };
}
