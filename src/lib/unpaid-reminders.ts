import "server-only";

import { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";
import { isTestEmail } from "./test-accounts";
import { customerHasPaidSearch } from "./unpaid-search";
import { unpaidReminderUnsubscribeToken } from "./unsubscribe-token";
import { FLAT_PRICE } from "./vehicle-data";

// "Finish your search" reminders for a saved, unpaid search (sign-up-to-
// payment fix, approved 2026-09-30; docs/plans/signup-to-payment-plan.md).
// Hourly. At most two per search: 24h and 72h after the unpaid search was
// saved (created_at), stopping on payment.
//
// Sends NOTHING while REMINDER_MAILING_ADDRESS is unset (CAN-SPAM needs a
// real postal address in the footer; no test or made-up address may go in
// real email) or while UNSUBSCRIBE_SECRET is unset (every email needs a
// working one-click unsubscribe). It logs and returns instead.
//
// Who gets one: the customer's latest unpaid search only (one per customer;
// older duplicates are ignored), created after UNPAID_REMINDERS_CUTOFF (no
// backlog from before the feature), customer has no paid search, email
// confirmed, not a test address, not unsubscribed. Payment and unsubscribe
// are re-checked immediately before each send, and a send is stamped only
// after it succeeds.
//
// Timeliness windows (not in the plan's wording, a safety choice): reminder 1
// only while the search is 24-72h old, reminder 2 only while it's 72h-7 days
// old. So whenever the reminders are switched on (the mailing address set),
// nobody gets a stale "your search is saved" email about something from weeks
// ago, and a search caught late gets one reminder, not two an hour apart.

/** Deploy cutoff (2026-10-01): unpaid searches saved before this never get reminders. */
export const UNPAID_REMINDERS_CUTOFF = "2026-10-01T04:00:00Z";

const HOUR = 3_600_000;
const R1_FROM = 24 * HOUR;
const R2_FROM = 72 * HOUR;
const R2_UNTIL = 7 * 24 * HOUR;

type Which = 1 | 2;

interface Candidate {
  id: string;
  customer_id: string;
  make: string | null;
  model: string | null;
  model_year: number | null;
  created_at: string;
  unpaid_reminder_1_sent_at: string | null;
  unpaid_reminder_2_sent_at: string | null;
}

export interface UnpaidReminderSummary {
  skipped?: string;
  sent: { searchId: string; reminder: Which }[];
  errors: string[];
}

/** Which reminder (if any) a search is due for at `now`. */
export function dueReminder(row: Pick<Candidate, "created_at" | "unpaid_reminder_1_sent_at" | "unpaid_reminder_2_sent_at">, now: number): Which | null {
  const age = now - new Date(row.created_at).getTime();
  if (row.unpaid_reminder_2_sent_at) return null;
  if (age >= R2_FROM) {
    if (age >= R2_UNTIL) return null;
    // A late reminder 1 (sent near the 72h mark) must not be followed by
    // reminder 2 minutes later.
    if (row.unpaid_reminder_1_sent_at && now - new Date(row.unpaid_reminder_1_sent_at).getTime() < R1_FROM) return null;
    return 2;
  }
  if (age >= R1_FROM && !row.unpaid_reminder_1_sent_at) return 1;
  return null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Approved copy (2026-09-30). Undecided searches say "your LEVR Auto search". */
export function buildUnpaidReminder(
  which: Which,
  search: { make: string | null; model: string | null; modelYear: number | null },
  links: { review: string; unsubscribe: string },
  mailingAddress: string,
): { subject: string; html: string } {
  const decided = Boolean(search.make && search.model);
  const makeModel = decided ? `${search.make} ${search.model}` : "";
  const vehicle = decided ? [search.modelYear, search.make, search.model].filter(Boolean).join(" ") : "";
  let subject: string;
  let body: string;
  if (which === 1) {
    subject = decided ? `Your ${makeModel} search is saved` : "Your LEVR Auto search is saved";
    body = decided
      ? `You started a LEVR Auto search for a ${vehicle} but haven't paid yet. Your choices are saved — pick up where you left off and pay the flat $${FLAT_PRICE} fee to start your search.`
      : `You started your LEVR Auto search but haven't paid yet. Your choices are saved — pick up where you left off and pay the flat $${FLAT_PRICE} fee to start your search.`;
  } else {
    subject = decided ? `Still want help buying your ${makeModel}?` : "Still want help with your LEVR Auto search?";
    body = `${decided ? `Your ${vehicle} search` : "Your LEVR Auto search"} is still saved. Once you pay the flat $${FLAT_PRICE} fee, your LEVR agent starts negotiating with dealers nationwide — and if we don't bring you at least one real offer below Total SRP within 30 days of your search going live, you get your $${FLAT_PRICE} back.`;
  }
  const html =
    `<p>${escapeHtml(body)}</p>` +
    `<p><a href="${links.review}" style="display:inline-block;padding:12px 24px;background:#10b981;color:#09090b;border-radius:9999px;font-weight:600;text-decoration:none">Finish your search</a></p>` +
    `<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">` +
    `<p style="font-size:12px;color:#71717a">You're getting this because you started a search at levrauto.com. <a href="${links.unsubscribe}" style="color:#71717a">Unsubscribe from these reminders</a></p>` +
    `<p style="font-size:12px;color:#71717a">LEVR Holdings LLC · ${escapeHtml(mailingAddress)}</p>`;
  return { subject, html };
}

export async function sendUnpaidReminders(
  options: { onlyCustomerIds?: string[]; now?: Date; allowTestAddressesForVerification?: boolean } = {},
): Promise<UnpaidReminderSummary> {
  const summary: UnpaidReminderSummary = { sent: [], errors: [] };
  const mailingAddress = process.env.REMINDER_MAILING_ADDRESS?.trim();
  if (!mailingAddress) {
    console.log("[unpaid-reminders] REMINDER_MAILING_ADDRESS is not set; sending nothing.");
    return { ...summary, skipped: "REMINDER_MAILING_ADDRESS is not set" };
  }
  if (!process.env.UNSUBSCRIBE_SECRET) {
    console.log("[unpaid-reminders] UNSUBSCRIBE_SECRET is not set; sending nothing.");
    return { ...summary, skipped: "UNSUBSCRIBE_SECRET is not set" };
  }
  // Test addresses are suppressed by sendEmail anyway; this only lets a
  // scoped verification run exercise the path end to end.
  const allowTest = Boolean(options.allowTestAddressesForVerification && options.onlyCustomerIds?.length);

  const now = (options.now ?? new Date()).getTime();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const admin = createAdminClient();

  // Every unpaid search since the cutoff, newest first, paginated (PostgREST
  // caps a select at 1,000 rows silently).
  const PAGE = 1000;
  const rows: Candidate[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = admin
      .from("customer_searches")
      .select("id, customer_id, make, model, model_year, created_at, unpaid_reminder_1_sent_at, unpaid_reminder_2_sent_at")
      .is("paid_at", null)
      .eq("search_status", "awaiting_finalization")
      .gte("created_at", UNPAID_REMINDERS_CUTOFF)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (options.onlyCustomerIds) q = q.in("customer_id", options.onlyCustomerIds);
    const { data, error } = await q;
    if (error) throw new Error(`Failed to load unpaid searches: ${error.message}`);
    rows.push(...((data ?? []) as Candidate[]));
    if (!data || data.length < PAGE) break;
  }

  // The latest unpaid search per customer is the only one in play.
  const latest = new Map<string, Candidate>();
  for (const r of rows) if (!latest.has(r.customer_id)) latest.set(r.customer_id, r);

  for (const search of latest.values()) {
    const which = dueReminder(search, now);
    if (!which) continue;
    try {
      const { data: customer } = await admin
        .from("customers")
        .select("id, first_name, last_name, unpaid_reminders_unsubscribed_at")
        .eq("id", search.customer_id)
        .maybeSingle();
      if (!customer || customer.unpaid_reminders_unsubscribed_at) continue;
      // The real, confirmed address comes from auth, never the denormalized
      // customers.email.
      const { data: auth } = await admin.auth.admin.getUserById(search.customer_id);
      const email = auth?.user?.email ?? null;
      if (!email || !auth?.user?.email_confirmed_at) continue;
      if (isTestEmail(email) && !allowTest) continue;

      // Re-check payment and unsubscribe immediately before sending.
      if (await customerHasPaidSearch(admin, search.customer_id)) continue;
      const column = which === 1 ? "unpaid_reminder_1_sent_at" : "unpaid_reminder_2_sent_at";
      const { data: fresh } = await admin
        .from("customer_searches")
        .select("paid_at, unpaid_reminder_1_sent_at, unpaid_reminder_2_sent_at")
        .eq("id", search.id)
        .maybeSingle();
      if (!fresh || fresh.paid_at || fresh[column]) continue;

      const token = unpaidReminderUnsubscribeToken(search.customer_id);
      if (!token) continue;
      const unsubscribe = `${siteUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
      const unsubscribeOneClick = `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`;
      const { subject, html } = buildUnpaidReminder(
        which,
        { make: search.make, model: search.model, modelYear: search.model_year },
        { review: `${siteUrl}/account/vehicle?searchId=${search.id}`, unsubscribe },
        mailingAddress,
      );
      await sendEmail({
        to: email,
        toName: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || undefined,
        subject,
        html,
        headers: {
          "List-Unsubscribe": `<${unsubscribeOneClick}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      // Stamped only after a successful send, guarded so a concurrent run
      // can't double-stamp.
      const { error: stampError } = await admin
        .from("customer_searches")
        .update({ [column]: new Date().toISOString() })
        .eq("id", search.id)
        .is(column, null);
      summary.sent.push({ searchId: search.id, reminder: which });
      if (stampError) summary.errors.push(`${search.id}: sent but not stamped: ${stampError.message}`);
    } catch (err) {
      summary.errors.push(`${search.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return summary;
}

/** Sets the unsubscribe flag. Idempotent; never clears it. */
export async function unsubscribeFromUnpaidReminders(customerId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: customer } = await admin.from("customers").select("id, unpaid_reminders_unsubscribed_at").eq("id", customerId).maybeSingle();
  if (!customer) return false;
  if (!customer.unpaid_reminders_unsubscribed_at) {
    const { error } = await admin
      .from("customers")
      .update({ unpaid_reminders_unsubscribed_at: new Date().toISOString() })
      .eq("id", customerId)
      .is("unpaid_reminders_unsubscribed_at", null);
    if (error) return false;
  }
  return true;
}
