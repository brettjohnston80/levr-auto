import "server-only";
import { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";
import { RESUME_WINDOW_DAYS } from "./vehicle-data";

const DEFAULT_SEARCH_DAYS = 60;
const REMINDER_WINDOW_DAYS = 7;

export interface DeadlineInput {
  solidified_at: string;
  search_deadline_at: string | null;
}

export function addDays(iso: string, days: number): Date {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

/**
 * search_deadline_at is nullable -- null means "use the default," not "no
 * deadline." Computed here rather than filtered in the DB query itself:
 * PostgREST (what supabase-js talks to) can't filter on a coalesce/interval
 * expression, so both crons below fetch the (small, index-backed) set of
 * active searches and compute/filter in application code, same convention
 * as getOverdueFollowUpQueue's hours-overdue math and inventory-count.ts's
 * Haversine calculation.
 */
export function effectiveDeadline(row: DeadlineInput): Date {
  return row.search_deadline_at
    ? new Date(row.search_deadline_at)
    : addDays(row.solidified_at, DEFAULT_SEARCH_DAYS);
}

export interface Day60ReminderSummary {
  remindersSent: string[];
  errors: { searchId: string; error: string }[];
}

/**
 * Sends the "extend anytime for 30 more days" email to any active search
 * within 7 days of its (effective) deadline that hasn't already gotten a
 * reminder for THIS deadline value -- see deadline_reminder_sent_for's
 * column comment (20260814160000_day60_extension_flow.sql) for why it's
 * compared by value, not treated as a one-shot boolean.
 *
 * Deliberately no qualifying_offers.status exclusion (e.g. skipping
 * searches with an accepted offer) -- there's no reliable "already
 * purchased" signal in the schema today (see the roadmap doc's Customer
 * Journey step 8 discussion), so adding a soft check here would be false
 * confidence, not real protection.
 */
export async function sendDay60Reminders(): Promise<Day60ReminderSummary> {
  const supabase = createAdminClient();

  const { data: searches, error } = await supabase
    .from("customer_searches")
    .select("id, make, model, customer_id, solidified_at, search_deadline_at, deadline_reminder_sent_for")
    .eq("search_status", "searching")
    .not("solidified_at", "is", null);

  if (error) {
    throw new Error(`Failed to load searches for Day-60 reminder: ${error.message}`);
  }

  const now = Date.now();
  const windowEnd = now + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const due = (searches ?? []).filter((search) => {
    const deadline = effectiveDeadline(search).getTime();
    if (deadline <= now || deadline > windowEnd) return false;
    if (
      search.deadline_reminder_sent_for &&
      new Date(search.deadline_reminder_sent_for).getTime() === deadline
    ) {
      return false;
    }
    return true;
  });

  const summary: Day60ReminderSummary = { remindersSent: [], errors: [] };
  if (due.length === 0) return summary;

  const customerIds = [...new Set(due.map((s) => s.customer_id))];
  const { data: customers } = await supabase
    .from("customers")
    .select("id, email, full_name")
    .in("id", customerIds);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  for (const search of due) {
    const customer = customerById.get(search.customer_id);
    if (!customer?.email) {
      summary.errors.push({ searchId: search.id, error: "No customer email on file" });
      continue;
    }

    const deadline = effectiveDeadline(search);
    const deadlineLabel = deadline.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    // Same NEXT_PUBLIC_SITE_URL-with-localhost-fallback convention already
    // used in auth-actions.ts and payment-actions.ts, not a new one.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const accountUrl = `${siteUrl}/account`;

    try {
      await sendEmail({
        to: customer.email,
        toName: customer.full_name ?? undefined,
        subject: `Your search pauses on ${deadlineLabel} unless extended`,
        html:
          `<p>Your LEVR Auto search for a ${search.make} ${search.model} will stop on ${deadlineLabel} ` +
          `— we will be unable to continue searching for new offers unless you extend. Extending is easy: ` +
          `just <a href="${accountUrl}">log into your account</a> anytime before then, and we'll keep ` +
          `actively searching for 30 more days.</p>`,
      });
    } catch (err) {
      summary.errors.push({
        searchId: search.id,
        error: err instanceof Error ? err.message : "Send failed",
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from("customer_searches")
      .update({ deadline_reminder_sent_for: deadline.toISOString() })
      .eq("id", search.id);

    if (updateError) {
      summary.errors.push({
        searchId: search.id,
        error: `Email sent but failed to record deadline_reminder_sent_for: ${updateError.message}`,
      });
      continue;
    }

    summary.remindersSent.push(search.id);
  }

  return summary;
}

export interface Day60PauseSummary {
  paused: string[];
  errors: { searchId: string; error: string }[];
}

/**
 * Pauses any active search whose (effective) deadline has passed with no
 * extension -- hard cutoff, no grace period. Each update is individually
 * guarded by .eq("search_status", "searching") so a concurrent/retried run
 * can't double-process a row (same idempotency idiom as solidifySearch).
 */
export async function pauseOverdueSearches(): Promise<Day60PauseSummary> {
  const supabase = createAdminClient();

  const { data: searches, error } = await supabase
    .from("customer_searches")
    .select("id, solidified_at, search_deadline_at")
    .eq("search_status", "searching")
    .not("solidified_at", "is", null);

  if (error) {
    throw new Error(`Failed to load searches for Day-60 pause: ${error.message}`);
  }

  const now = Date.now();
  const overdue = (searches ?? []).filter((search) => effectiveDeadline(search).getTime() <= now);

  const summary: Day60PauseSummary = { paused: [], errors: [] };

  for (const search of overdue) {
    const { error: updateError } = await supabase
      .from("customer_searches")
      .update({ search_status: "paused", paused_at: new Date().toISOString() })
      .eq("id", search.id)
      .eq("search_status", "searching");

    if (updateError) {
      summary.errors.push({ searchId: search.id, error: updateError.message });
    } else {
      summary.paused.push(search.id);
    }
  }

  return summary;
}

export interface ResumeReminderSummary {
  remindersSent: string[];
  errors: { searchId: string; error: string }[];
}

/**
 * Sends the "your paused search will end soon" email to any paused search
 * within REMINDER_WINDOW_DAYS of its resume window (RESUME_WINDOW_DAYS
 * after paused_at) closing, mirroring sendDay60Reminders' exact pattern --
 * same email utility, same dedup approach. resume_reminder_sent_for stores
 * the paused_at value the reminder was last sent for, not a boolean (see
 * 20260816120000_resume_reminder_sent_for.sql's column comment) --
 * self-correcting if a search is ever paused a second time after a later
 * resume, since the new paused_at naturally stops matching the stored
 * value.
 */
export async function sendResumeReminders(): Promise<ResumeReminderSummary> {
  const supabase = createAdminClient();

  const { data: searches, error } = await supabase
    .from("customer_searches")
    .select("id, make, model, customer_id, paused_at, resume_reminder_sent_for")
    .eq("search_status", "paused")
    .not("paused_at", "is", null);

  if (error) {
    throw new Error(`Failed to load searches for resume reminder: ${error.message}`);
  }

  const now = Date.now();
  const windowEnd = now + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const due = (searches ?? []).filter((search) => {
    const pausedAt = search.paused_at as string;
    const resumeDeadline = addDays(pausedAt, RESUME_WINDOW_DAYS).getTime();
    if (resumeDeadline <= now || resumeDeadline > windowEnd) return false;
    if (
      search.resume_reminder_sent_for &&
      new Date(search.resume_reminder_sent_for).getTime() === new Date(pausedAt).getTime()
    ) {
      return false;
    }
    return true;
  });

  const summary: ResumeReminderSummary = { remindersSent: [], errors: [] };
  if (due.length === 0) return summary;

  const customerIds = [...new Set(due.map((s) => s.customer_id))];
  const { data: customers } = await supabase
    .from("customers")
    .select("id, email, full_name")
    .in("id", customerIds);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  for (const search of due) {
    const customer = customerById.get(search.customer_id);
    if (!customer?.email) {
      summary.errors.push({ searchId: search.id, error: "No customer email on file" });
      continue;
    }

    const pausedAt = search.paused_at as string;
    const resumeDeadline = addDays(pausedAt, RESUME_WINDOW_DAYS);
    const resumeDeadlineLabel = resumeDeadline.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    // Same NEXT_PUBLIC_SITE_URL-with-localhost-fallback convention already
    // used in auth-actions.ts, payment-actions.ts, and sendDay60Reminders
    // above, not a new one.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const accountUrl = `${siteUrl}/account`;

    try {
      await sendEmail({
        to: customer.email,
        toName: customer.full_name ?? undefined,
        subject: "Your paused search will end soon — extend now",
        html:
          `<p>Your LEVR Auto search for a ${search.make} ${search.model} is paused, and the window to resume ` +
          `it closes on ${resumeDeadlineLabel}. After that, you'll need to start a completely new search. ` +
          `Extending is easy: just <a href="${accountUrl}">log into your account</a> to pick up right where ` +
          `you left off.</p>`,
      });
    } catch (err) {
      summary.errors.push({
        searchId: search.id,
        error: err instanceof Error ? err.message : "Send failed",
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from("customer_searches")
      .update({ resume_reminder_sent_for: pausedAt })
      .eq("id", search.id);

    if (updateError) {
      summary.errors.push({
        searchId: search.id,
        error: `Email sent but failed to record resume_reminder_sent_for: ${updateError.message}`,
      });
      continue;
    }

    summary.remindersSent.push(search.id);
  }

  return summary;
}
