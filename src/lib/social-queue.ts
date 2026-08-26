import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicablePlatforms, socialPostScheduledAt, type Platform, type Theme } from "@/lib/social-schedule";

export interface DraftSocialPost {
  id: string;
  theme: Theme;
  weekStart: string;
  captionX: string;
  captionFacebook: string;
  captionInstagram: string;
  captionLinkedin: string | null;
  imageUrl: string | null;
  applicablePlatforms: Platform[];
  updatedAt: string;
}

function publicImageUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;
  const admin = createAdminClient();
  return admin.storage.from("social-post-images").getPublicUrl(storagePath).data.publicUrl;
}

/** For /internal/social -- every social_posts row currently awaiting agent review, any week. */
export async function getDraftSocialPosts(): Promise<DraftSocialPost[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("social_posts")
    .select(
      "id, theme, week_start, caption_x, caption_facebook, caption_instagram, caption_linkedin, image_storage_path, updated_at"
    )
    .eq("status", "draft")
    .order("week_start", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    theme: row.theme as Theme,
    weekStart: row.week_start,
    captionX: row.caption_x ?? "",
    captionFacebook: row.caption_facebook ?? "",
    captionInstagram: row.caption_instagram ?? "",
    captionLinkedin: row.caption_linkedin,
    imageUrl: publicImageUrl(row.image_storage_path),
    applicablePlatforms: applicablePlatforms(row.theme as Theme),
    updatedAt: row.updated_at,
  }));
}

export interface WorklistItem {
  sourceType: "social_post" | "article";
  sourceId: string;
  platform: Platform;
  scheduledAt: string;
  label: string;
  captionText: string;
  imageUrl: string | null;
}

const ALL_PLATFORMS: Platform[] = ["x", "linkedin", "facebook", "instagram"];

function captionFor(platform: Platform, row: { x: string; facebook: string; instagram: string; linkedin: string | null }): string {
  switch (platform) {
    case "x":
      return row.x;
    case "facebook":
      return row.facebook;
    case "instagram":
      return row.instagram;
    case "linkedin":
      return row.linkedin ?? "";
  }
}

/**
 * The manual copy-paste worklist -- approved (or already-partially-posted)
 * content whose scheduled time has arrived, one entry per still-unposted
 * platform. Combines social_posts and articles at this read step only;
 * neither table nor either review flow is touched or duplicated.
 */
export async function getPostingWorklist(): Promise<WorklistItem[]> {
  const admin = createAdminClient();
  const now = new Date();
  const items: WorklistItem[] = [];

  const { data: posts } = await admin
    .from("social_posts")
    .select(
      "id, theme, week_start, caption_x, caption_facebook, caption_instagram, caption_linkedin, image_storage_path, posted_x_at, posted_facebook_at, posted_instagram_at, posted_linkedin_at"
    )
    .in("status", ["approved", "published"]);

  for (const post of posts ?? []) {
    const theme = post.theme as Theme;
    const imageUrl = publicImageUrl(post.image_storage_path);
    const postedAt: Record<Platform, string | null> = {
      x: post.posted_x_at,
      facebook: post.posted_facebook_at,
      instagram: post.posted_instagram_at,
      linkedin: post.posted_linkedin_at,
    };

    for (const platform of applicablePlatforms(theme)) {
      if (postedAt[platform]) continue;
      const scheduledAt = socialPostScheduledAt(post.week_start, theme, platform);
      if (!scheduledAt || scheduledAt > now) continue;

      items.push({
        sourceType: "social_post",
        sourceId: post.id,
        platform,
        scheduledAt: scheduledAt.toISOString(),
        label: theme,
        captionText: captionFor(platform, {
          x: post.caption_x ?? "",
          facebook: post.caption_facebook ?? "",
          instagram: post.caption_instagram ?? "",
          linkedin: post.caption_linkedin,
        }),
        imageUrl,
      });
    }
  }

  const { data: articles } = await admin
    .from("articles")
    .select(
      "id, title, published_at, caption_x, caption_facebook, caption_instagram, caption_linkedin, image_storage_path, posted_x_at, posted_facebook_at, posted_instagram_at, posted_linkedin_at"
    )
    .in("status", ["approved", "published"])
    .lte("published_at", now.toISOString());

  for (const article of articles ?? []) {
    const imageUrl = publicImageUrl(article.image_storage_path);
    const postedAt: Record<Platform, string | null> = {
      x: article.posted_x_at,
      facebook: article.posted_facebook_at,
      instagram: article.posted_instagram_at,
      linkedin: article.posted_linkedin_at,
    };

    for (const platform of ALL_PLATFORMS) {
      if (postedAt[platform]) continue;

      items.push({
        sourceType: "article",
        sourceId: article.id,
        platform,
        scheduledAt: article.published_at as string,
        label: article.title,
        captionText: captionFor(platform, {
          x: article.caption_x ?? "",
          facebook: article.caption_facebook ?? "",
          instagram: article.caption_instagram ?? "",
          linkedin: article.caption_linkedin,
        }),
        imageUrl,
      });
    }
  }

  items.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return items;
}
