import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduledPublishAt } from "@/lib/article-schedule";

export interface DraftArticle {
  id: string;
  slug: string;
  title: string;
  topic: string;
  content: string;
  captionX: string;
  captionFacebook: string;
  captionInstagram: string;
  captionLinkedin: string;
  scheduledMonth: string;
  scheduledPublishAt: string;
  reminderLastThresholdDays: number | null;
  reminderLastSentAt: string | null;
  imageUrl: string | null;
  updatedAt: string;
}

/** For /internal/articles -- every article currently awaiting agent review. */
export async function getDraftArticles(): Promise<DraftArticle[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("articles")
    .select(
      "id, slug, title, topic, content, caption_x, caption_facebook, caption_instagram, caption_linkedin, scheduled_month, reminder_last_threshold_days, reminder_last_sent_at, image_storage_path, updated_at"
    )
    .eq("status", "draft")
    .order("scheduled_month", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    topic: row.topic,
    content: row.content ?? "",
    captionX: row.caption_x ?? "",
    captionFacebook: row.caption_facebook ?? "",
    captionInstagram: row.caption_instagram ?? "",
    captionLinkedin: row.caption_linkedin ?? "",
    scheduledMonth: row.scheduled_month,
    scheduledPublishAt: scheduledPublishAt(row.scheduled_month).toISOString(),
    reminderLastThresholdDays: row.reminder_last_threshold_days,
    reminderLastSentAt: row.reminder_last_sent_at,
    imageUrl: row.image_storage_path
      ? admin.storage.from("social-post-images").getPublicUrl(row.image_storage_path).data.publicUrl
      : null,
    updatedAt: row.updated_at,
  }));
}
