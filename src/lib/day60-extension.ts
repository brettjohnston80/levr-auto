import "server-only";
import { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";
import { getStripe } from "./stripe";
import { EXTENSION_FEE, RESUME_WINDOW_DAYS } from "./vehicle-data";

const DEFAULT_SEARCH_DAYS = 60;
export const REMINDER_WINDOW_DAYS = 7;

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
    .select(
      "id, make, model, customer_id, solidified_at, search_deadline_at, deadline_reminder_sent_for, auto_renew_enabled"
    )
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
    const daysRemaining = Math.ceil((deadline.getTime() - now) / (24 * 60 * 60 * 1000));
    // Same NEXT_PUBLIC_SITE_URL-with-localhost-fallback convention already
    // used in auth-actions.ts and payment-actions.ts, not a new one.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const accountUrl = `${siteUrl}/account`;

    // auto_renew_enabled branches this reminder's copy entirely (spec,
    // 2026-08-17) -- same trigger/window as the manual-extend reminder
    // above, just telling the customer the charge is already handled
    // instead of asking them to act.
    const { subject, html } = search.auto_renew_enabled
      ? {
          subject: `Your card will be charged $100 in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} to keep your search active`,
          html:
            `<p>Your LEVR Auto search for a ${search.make} ${search.model} has auto-renew turned on — ` +
            `we'll automatically charge your card $100 on ${deadlineLabel} to keep searching for 30 more days. ` +
            `Don't want this? Turn off auto-renew anytime before then from your ` +
            `<a href="${accountUrl}">account</a>.</p>`,
        }
      : {
          subject: `Your search pauses on ${deadlineLabel} unless extended`,
          html:
            `<p>Your LEVR Auto search for a ${search.make} ${search.model} will stop on ${deadlineLabel} ` +
            `— we will be unable to continue searching for new offers unless you extend. Extending is easy: ` +
            `just <a href="${accountUrl}">log into your account</a> anytime before then, and we'll keep ` +
            `actively searching for 30 more days.</p>`,
        };

    try {
      await sendEmail({
        to: customer.email,
        toName: customer.full_name ?? undefined,
        subject,
        html,
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
  autoRenewed: string[];
  errors: { searchId: string; error: string }[];
}

type AutoRenewCandidate = DeadlineInput & { id: string; customer_id: string };

/**
 * Attempts one off-session $100 charge for a search whose deadline just
 * passed and has auto_renew_enabled -- the trigger point decided 2026-08-16:
 * reuse this cron rather than a new parallel one, attempt the charge before
 * deciding to pause. Returns true only on a genuinely completed charge +
 * DB update; any failure (missing payment method, card declined, DB error)
 * returns false and the caller falls straight into the normal pause flow --
 * no special retry logic, per the approved spec.
 */
async function attemptAutoRenewCharge(
  supabase: ReturnType<typeof createAdminClient>,
  search: AutoRenewCandidate
): Promise<boolean> {
  const { data: customer } = await supabase
    .from("customers")
    .select("email, full_name, stripe_customer_id, stripe_default_payment_method_id")
    .eq("id", search.customer_id)
    .maybeSingle();

  if (!customer?.stripe_customer_id || !customer?.stripe_default_payment_method_id) {
    console.error(`Day-60 auto-renew: search ${search.id} has auto_renew_enabled but no saved payment method`);
    return false;
  }

  const currentDeadline = effectiveDeadline(search);
  const newDeadline = addDays(currentDeadline.toISOString(), 30);

  // Idempotency key is tied to the deadline value being extended, not the
  // current timestamp -- a retried cron run within the same overdue window
  // reuses the same key, so Stripe itself refuses to double-charge even
  // before the DB-level guard below runs. Same "condition that becomes
  // false after first success" idiom as last_extension_session_id
  // elsewhere, applied to an external side effect this time.
  const idempotencyKey = `auto_renew_${search.id}_${currentDeadline.toISOString()}`;

  let paymentIntent;
  try {
    paymentIntent = await getStripe().paymentIntents.create(
      {
        amount: EXTENSION_FEE * 100,
        currency: "usd",
        customer: customer.stripe_customer_id,
        payment_method: customer.stripe_default_payment_method_id,
        off_session: true,
        confirm: true,
        metadata: {
          type: "extension_fee_auto_renew",
          search_id: search.id,
        },
      },
      { idempotencyKey }
    );
  } catch (err) {
    console.error(
      `Day-60 auto-renew: charge failed for search ${search.id}:`,
      err instanceof Error ? err.message : err
    );
    return false;
  }

  if (paymentIntent.status !== "succeeded") {
    console.error(
      `Day-60 auto-renew: payment_intent ${paymentIntent.id} for search ${search.id} did not succeed (status: ${paymentIntent.status})`
    );
    return false;
  }

  // Same OR-guard idiom as the webhook's extension_fee branch: prevents a
  // second write if this function is ever invoked twice for the same
  // successful charge (e.g. an overlapping cron run), without breaking on
  // last_extension_session_id starting NULL.
  const { data: updated, error: updateError } = await supabase
    .from("customer_searches")
    .update({
      search_deadline_at: newDeadline.toISOString(),
      last_extension_session_id: paymentIntent.id,
    })
    .eq("id", search.id)
    .or(`last_extension_session_id.is.null,last_extension_session_id.neq.${paymentIntent.id}`)
    .select("id");

  if (updateError) {
    console.error(
      `Day-60 auto-renew: DB update failed for search ${search.id} after a successful charge (${paymentIntent.id}):`,
      updateError.message
    );
    return false;
  }

  if (!updated || updated.length === 0) {
    console.log(
      `Day-60 auto-renew: search ${search.id} already processed for payment_intent ${paymentIntent.id} -- idempotent retry`
    );
    return true;
  }

  if (customer.email) {
    const newDeadlineLabel = newDeadline.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    try {
      await sendEmail({
        to: customer.email,
        toName: customer.full_name ?? undefined,
        subject: "Your LEVR Auto search was automatically extended",
        html:
          `<p>Your search was about to pause, so we automatically charged the $100 extension fee to the ` +
          `card on file and kept things going for 30 more days. Your search will now run through ` +
          `${newDeadlineLabel}.</p>` +
          `<p>You can turn off automatic extensions anytime from your <a href="${siteUrl}/account">account page</a>.</p>`,
      });
    } catch (err) {
      console.error(
        `Day-60 auto-renew: charged and extended search ${search.id} but confirmation email failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(
    `Day-60 auto-renew: charged ${paymentIntent.id} and extended search ${search.id} to ${newDeadline.toISOString()}`
  );
  return true;
}

/**
 * Pauses any active search whose (effective) deadline has passed with no
 * extension -- hard cutoff, no grace period. Each update is individually
 * guarded by .eq("search_status", "searching") so a concurrent/retried run
 * can't double-process a row (same idempotency idiom as solidifySearch).
 *
 * A search with auto_renew_enabled gets one off-session charge attempt
 * first (attemptAutoRenewCharge) -- success skips the pause entirely and
 * extends normally, any failure falls straight into the pause flow below.
 */
export async function pauseOverdueSearches(): Promise<Day60PauseSummary> {
  const supabase = createAdminClient();

  const { data: searches, error } = await supabase
    .from("customer_searches")
    .select("id, customer_id, solidified_at, search_deadline_at, auto_renew_enabled")
    .eq("search_status", "searching")
    .not("solidified_at", "is", null);

  if (error) {
    throw new Error(`Failed to load searches for Day-60 pause: ${error.message}`);
  }

  const now = Date.now();
  const overdue = (searches ?? []).filter((search) => effectiveDeadline(search).getTime() <= now);

  const summary: Day60PauseSummary = { paused: [], autoRenewed: [], errors: [] };

  for (const search of overdue) {
    if (search.auto_renew_enabled) {
      const renewed = await attemptAutoRenewCharge(supabase, search);
      if (renewed) {
        summary.autoRenewed.push(search.id);
        continue;
      }
    }

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
