import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicablePlatforms, type Platform, type Theme } from "@/lib/social-schedule";

export type PostingSourceType = "social_post" | "article";

interface PostedAtColumns {
  posted_x_at: string | null;
  posted_facebook_at: string | null;
  posted_instagram_at: string | null;
  posted_linkedin_at: string | null;
}

const POSTED_COLUMN: Record<Platform, keyof PostedAtColumns> = {
  x: "posted_x_at",
  facebook: "posted_facebook_at",
  instagram: "posted_instagram_at",
  linkedin: "posted_linkedin_at",
};

const ALL_PLATFORMS: Platform[] = ["x", "linkedin", "facebook", "instagram"];

export type MarkPlatformPostedResult = { ok: true } | { ok: false; error: string };

/**
 * Shared by both articles and social_posts -- the one place that decides
 * "has everything applicable to this row been posted, so status should
 * advance to 'published'."
 *
 * Articles have no day-of-week restriction, so all 4 platforms are always
 * applicable. social_posts' applicability depends on theme (LinkedIn has
 * no weekend slot) -- this branches on sourceType and, for social_posts,
 * tests against applicablePlatforms(theme), never a blind "all 4 non-null"
 * check. Without that, a weekend-theme row's permanently-null
 * posted_linkedin_at would mean it could never reach 'published' at all.
 */
export async function markPlatformPosted(
  sourceType: PostingSourceType,
  id: string,
  platform: Platform
): Promise<MarkPlatformPostedResult> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  let status: string;
  let posted: PostedAtColumns;
  let applicable: Platform[];

  if (sourceType === "article") {
    const { data: row, error } = await admin
      .from("articles")
      .select("status, posted_x_at, posted_facebook_at, posted_instagram_at, posted_linkedin_at")
      .eq("id", id)
      .maybeSingle();

    if (error || !row) {
      return { ok: false, error: "Article not found." };
    }

    status = row.status;
    posted = {
      posted_x_at: row.posted_x_at,
      posted_facebook_at: row.posted_facebook_at,
      posted_instagram_at: row.posted_instagram_at,
      posted_linkedin_at: row.posted_linkedin_at,
    };
    applicable = ALL_PLATFORMS;
  } else {
    const { data: row, error } = await admin
      .from("social_posts")
      .select("status, theme, posted_x_at, posted_facebook_at, posted_instagram_at, posted_linkedin_at")
      .eq("id", id)
      .maybeSingle();

    if (error || !row) {
      return { ok: false, error: "Post not found." };
    }

    status = row.status;
    posted = {
      posted_x_at: row.posted_x_at,
      posted_facebook_at: row.posted_facebook_at,
      posted_instagram_at: row.posted_instagram_at,
      posted_linkedin_at: row.posted_linkedin_at,
    };
    applicable = applicablePlatforms(row.theme as Theme);
  }

  if (status !== "approved" && status !== "published") {
    return { ok: false, error: "This post hasn't been approved yet." };
  }
  if (!applicable.includes(platform)) {
    return { ok: false, error: `${platform} doesn't apply to this post.` };
  }

  const merged: PostedAtColumns = { ...posted, [POSTED_COLUMN[platform]]: now };
  const allApplicablePosted = applicable.every((p) => merged[POSTED_COLUMN[p]] !== null);

  const updates: Record<string, unknown> = {
    [POSTED_COLUMN[platform]]: now,
    updated_at: now,
  };
  if (allApplicablePosted) {
    updates.status = "published";
  }

  const table = sourceType === "article" ? "articles" : "social_posts";
  const { error: updateError } = await admin.from(table).update(updates).eq("id", id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}
