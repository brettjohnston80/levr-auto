import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { scheduledPublishAt, REMINDER_THRESHOLDS_DAYS } from "@/lib/article-schedule";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The most urgent threshold (smallest days-before value) that's currently
 * due, or null if the article isn't within 5 days of its scheduled publish
 * instant yet. Once the scheduled instant has fully passed, every
 * threshold including 0 stays "due" forever -- combined with the
 * reminder_last_threshold_days guard below, this is exactly what makes an
 * overdue draft stop generating new reminders after day-of fires once,
 * without needing a separate "stop" condition.
 */
function mostUrgentDueThreshold(scheduledInstant: Date, now: Date): number | null {
  const msRemaining = scheduledInstant.getTime() - now.getTime();
  const due = REMINDER_THRESHOLDS_DAYS.filter((t) => msRemaining <= t * MS_PER_DAY);
  return due.length === 0 ? null : Math.min(...due);
}

export interface ArticleReminderSummary {
  remindersSent: string[];
  errors: { slug: string; error: string }[];
}

/**
 * Escalating "review this draft" nudges at 5/2/1/0 days before an
 * unapproved draft's scheduled publish date, sent to every active agent.
 * reminder_last_threshold_days is only advanced if every recipient's send
 * succeeds -- a partial failure leaves it untouched so the next day's run
 * retries the whole notification rather than silently treating an agent
 * who didn't get the email as notified.
 */
export async function sendArticleReminders(): Promise<ArticleReminderSummary> {
  const admin = createAdminClient();
  const summary: ArticleReminderSummary = { remindersSent: [], errors: [] };

  const { data: drafts, error: draftsError } = await admin
    .from("articles")
    .select("id, slug, title, scheduled_month, reminder_last_threshold_days")
    .eq("status", "draft");

  if (draftsError) {
    throw new Error(`Failed to load draft articles: ${draftsError.message}`);
  }
  if (!drafts || drafts.length === 0) return summary;

  const now = new Date();
  const due = drafts
    .map((article) => ({
      article,
      threshold: mostUrgentDueThreshold(scheduledPublishAt(article.scheduled_month), now),
    }))
    .filter(
      (
        entry
      ): entry is { article: (typeof drafts)[number]; threshold: number } =>
        entry.threshold !== null &&
        (entry.article.reminder_last_threshold_days === null ||
          entry.threshold < entry.article.reminder_last_threshold_days)
    );

  if (due.length === 0) return summary;

  const { data: agents } = await admin.from("agents").select("email, name").eq("active", true);
  if (!agents || agents.length === 0) {
    return { remindersSent: [], errors: due.map((d) => ({ slug: d.article.slug, error: "No active agents to notify" })) };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const internalArticlesUrl = `${siteUrl}/internal/articles`;

  for (const { article, threshold } of due) {
    const scheduled = scheduledPublishAt(article.scheduled_month);
    const dateLabel = scheduled.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Chicago",
    });

    const { subject, html } =
      threshold === 0
        ? {
            subject: `Today is the scheduled publish date: ${article.title}`,
            html:
              `<p>"${article.title}" was scheduled to go live today and still hasn't been approved. ` +
              `It won't publish on its own — review and approve as soon as you can: ` +
              `<a href="${internalArticlesUrl}">${internalArticlesUrl}</a>.</p>`,
          }
        : {
            subject: `${threshold} day${threshold === 1 ? "" : "s"} left to review: ${article.title}`,
            html:
              `<p>The draft for "${article.title}" is scheduled to go live ${dateLabel} and hasn't been ` +
              `approved yet. Review it at <a href="${internalArticlesUrl}">${internalArticlesUrl}</a>.</p>`,
          };

    let allSent = true;
    for (const agent of agents) {
      try {
        await sendEmail({ to: agent.email, toName: agent.name, subject, html });
      } catch (err) {
        allSent = false;
        summary.errors.push({
          slug: article.slug,
          error: `Send to ${agent.email} failed: ${err instanceof Error ? err.message : "unknown error"}`,
        });
      }
    }

    if (!allSent) continue;

    const { error: updateError } = await admin
      .from("articles")
      .update({ reminder_last_threshold_days: threshold, reminder_last_sent_at: now.toISOString() })
      .eq("id", article.id);

    if (updateError) {
      summary.errors.push({
        slug: article.slug,
        error: `Emails sent but failed to record reminder_last_threshold_days: ${updateError.message}`,
      });
      continue;
    }

    summary.remindersSent.push(article.slug);
  }

  return summary;
}
