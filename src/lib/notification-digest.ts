import "server-only";
import { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";
import { composeEventLine, DAILY_UPDATE_EVENT_TYPES, type NotificationEventType } from "./notifications";
import { hasUnreadForCustomer } from "./offer-messages";
import { GENERAL_THREAD_COPY } from "./offer-messages-shared";

type AdminClient = ReturnType<typeof createAdminClient>;

// The daily update (2026-09-27, plan: docs/plans/guarantee-progress-notifications-plan.md).
// One email a day per customer with email on, only when there's something
// to say:
//  - Unread messages: each thread with an unread agent reply is listed once
//    per new reply (daily_update_included_at), not every day until read. No
//    message content. This replaced the per-reply "you have a new message"
//    email (message-email.ts, removed).
//  - Other updates: routine events (DAILY_UPDATE_EVENT_TYPES -- today the
//    customer's own accept/decline receipt). Highlights never wait for this;
//    notifications.ts emails them immediately.
// communication_frequency is no longer read anywhere.

// Approved copy (2026-09-27).
const SUBJECT = "Your LEVR daily update";
const OTHER_UPDATES_HEADING = "Other updates";
const FOOTER =
  "You're getting this because daily updates are on for your account. Change this in account settings.";
function messagesLine(n: number): string {
  return `You have new messages from your agent in ${n} conversation${n === 1 ? "" : "s"}.`;
}

// A routine event older than this is stale news, e.g. from before a
// customer turned email back on.
const ROUTINE_EVENT_MAX_AGE_DAYS = 7;
const PAGE = 1000;
const IN_CHUNK = 200;

function customerDisplayName(customer: { first_name?: string | null; last_name?: string | null }): string | undefined {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || undefined;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IN_CHUNK) out.push(items.slice(i, i + IN_CHUNK));
  return out;
}

// Listed when there's an agent reply the customer hasn't read AND this
// thread hasn't been listed since that reply.
function needsListing(lastAgentAt: string, readAt: string | null, includedAt: string | null): boolean {
  if (!hasUnreadForCustomer(lastAgentAt, readAt)) return false;
  return !includedAt || new Date(lastAgentAt) > new Date(includedAt);
}

interface ThreadEntry {
  kind: "offer" | "general";
  /** Offer id, or customer id for the general thread. */
  id: string;
  label: string;
  href: string;
  /** Stamped as daily_update_included_at once listed. */
  lastAgentMessageAt: string;
}

async function loadOfferThreadsNeedingListing(admin: AdminClient) {
  const rows: {
    id: string;
    customer_search_id: string;
    dealer_name: string;
    last_agent_message_at: string;
    customer_messages_read_at: string | null;
    daily_update_included_at: string | null;
  }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("qualifying_offers")
      .select("id, customer_search_id, dealer_name, last_agent_message_at, customer_messages_read_at, daily_update_included_at")
      .not("last_agent_message_at", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load message threads: ${error.message}`);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < PAGE) break;
  }
  return rows.filter((r) => needsListing(r.last_agent_message_at, r.customer_messages_read_at, r.daily_update_included_at));
}

async function loadGeneralThreadsNeedingListing(admin: AdminClient) {
  const rows: {
    customer_id: string;
    last_agent_message_at: string;
    customer_messages_read_at: string | null;
    daily_update_included_at: string | null;
  }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("general_threads")
      .select("customer_id, last_agent_message_at, customer_messages_read_at, daily_update_included_at")
      .not("last_agent_message_at", "is", null)
      .order("customer_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load general threads: ${error.message}`);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < PAGE) break;
  }
  return rows.filter((r) => needsListing(r.last_agent_message_at, r.customer_messages_read_at, r.daily_update_included_at));
}

export interface DigestSummary {
  sent: string[];
  errors: { customerId: string; error: string }[];
}

/**
 * `onlyCustomerIds` limits the run to those customers (verification only --
 * the cron passes nothing). Candidates are still discovered the same way;
 * everyone else is skipped before any email or stamp.
 */
export async function sendNotificationDigests(options: { onlyCustomerIds?: string[] } = {}): Promise<DigestSummary> {
  const admin = createAdminClient();
  const summary: DigestSummary = { sent: [], errors: [] };
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const [offerThreads, generalThreads] = await Promise.all([
    loadOfferThreadsNeedingListing(admin),
    loadGeneralThreadsNeedingListing(admin),
  ]);

  // Routine events never emailed yet. real_time_sent_at IS NULL keeps out
  // receipts the old code already emailed immediately.
  const since = new Date(Date.now() - ROUTINE_EVENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error: eventsError } = await admin
    .from("notification_events")
    .select("id, customer_id, customer_search_id, event_type, event_data")
    .in("event_type", DAILY_UPDATE_EVENT_TYPES)
    .is("digest_sent_at", null)
    .is("real_time_sent_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (eventsError) throw new Error(`Failed to load pending daily-update events: ${eventsError.message}`);

  const searchIds = [
    ...new Set([...offerThreads.map((o) => o.customer_search_id), ...(events ?? []).map((e) => e.customer_search_id as string)]),
  ];
  const searchById = new Map<string, { customer_id: string; make: string | null; model: string | null }>();
  for (const ids of chunks(searchIds)) {
    const { data } = await admin.from("customer_searches").select("id, customer_id, make, model").in("id", ids);
    for (const s of data ?? []) searchById.set(s.id as string, s as { customer_id: string; make: string | null; model: string | null });
  }

  const threadsByCustomer = new Map<string, ThreadEntry[]>();
  const addThread = (customerId: string, entry: ThreadEntry) => {
    const list = threadsByCustomer.get(customerId) ?? [];
    list.push(entry);
    threadsByCustomer.set(customerId, list);
  };
  for (const g of generalThreads) {
    addThread(g.customer_id, {
      kind: "general",
      id: g.customer_id,
      label: GENERAL_THREAD_COPY.title,
      href: `${site}/account/messages/general`,
      lastAgentMessageAt: g.last_agent_message_at,
    });
  }
  for (const o of offerThreads) {
    const search = searchById.get(o.customer_search_id);
    if (!search) continue;
    const vehicle = [search.make, search.model].filter(Boolean).join(" ");
    addThread(search.customer_id, {
      kind: "offer",
      id: o.id,
      label: vehicle ? `${o.dealer_name} — ${vehicle}` : o.dealer_name,
      href: `${site}/account/messages/${o.id}`,
      lastAgentMessageAt: o.last_agent_message_at,
    });
  }

  const eventsByCustomer = new Map<string, NonNullable<typeof events>>();
  for (const e of events ?? []) {
    const list = eventsByCustomer.get(e.customer_id as string) ?? [];
    list.push(e);
    eventsByCustomer.set(e.customer_id as string, list);
  }

  const candidateIds = [...new Set([...threadsByCustomer.keys(), ...eventsByCustomer.keys()])].filter(
    (id) => !options.onlyCustomerIds || options.onlyCustomerIds.includes(id),
  );
  if (candidateIds.length === 0) return summary;

  // A daily update is an email, so it only goes to customers with email on.
  // Text-only customers are already flagged to an agent per event.
  const customers: { id: string; email: string | null; first_name: string | null; last_name: string | null }[] = [];
  for (const ids of chunks(candidateIds)) {
    const { data, error } = await admin
      .from("customers")
      .select("id, email, first_name, last_name")
      .in("id", ids)
      .eq("notify_by_email", true);
    if (error) throw new Error(`Failed to load customers for the daily update: ${error.message}`);
    customers.push(...((data ?? []) as typeof customers));
  }

  for (const customer of customers) {
    if (!customer.email) {
      summary.errors.push({ customerId: customer.id, error: "No customer email on file" });
      continue;
    }
    const threads = threadsByCustomer.get(customer.id) ?? [];
    const customerEvents = eventsByCustomer.get(customer.id) ?? [];

    const sections: string[] = [];
    if (threads.length > 0) {
      sections.push(
        `<p>${messagesLine(threads.length)}</p><ul>${threads
          .map((t) => `<li><a href="${t.href}">${escapeHtml(t.label)}</a></li>`)
          .join("")}</ul>`,
      );
    }
    if (customerEvents.length > 0) {
      const lines = customerEvents.map((e) => {
        const search = searchById.get(e.customer_search_id as string) ?? { make: null, model: null };
        return composeEventLine(e.event_type as NotificationEventType, e.event_data as Record<string, unknown>, search);
      });
      sections.push(
        `<p><strong>${OTHER_UPDATES_HEADING}</strong></p><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`,
      );
    }
    const html = `${sections.join("")}<p style="color:#71717a;font-size:12px">${FOOTER}</p>`;

    try {
      await sendEmail({ to: customer.email, toName: customerDisplayName(customer), subject: SUBJECT, html });
    } catch (err) {
      summary.errors.push({ customerId: customer.id, error: err instanceof Error ? err.message : "Send failed" });
      continue;
    }

    // Stamp each thread with the reply it was listed for, so only a NEWER
    // agent reply lists it again.
    const stampErrors: string[] = [];
    for (const t of threads) {
      const { error } =
        t.kind === "offer"
          ? await admin.from("qualifying_offers").update({ daily_update_included_at: t.lastAgentMessageAt }).eq("id", t.id)
          : await admin
              .from("general_threads")
              .update({ daily_update_included_at: t.lastAgentMessageAt })
              .eq("customer_id", t.id);
      if (error) stampErrors.push(error.message);
    }
    if (customerEvents.length > 0) {
      const { error } = await admin
        .from("notification_events")
        .update({ digest_sent_at: new Date().toISOString() })
        .in(
          "id",
          customerEvents.map((e) => e.id as string),
        );
      if (error) stampErrors.push(error.message);
    }
    if (stampErrors.length > 0) {
      summary.errors.push({ customerId: customer.id, error: `Email sent but failed to mark included: ${stampErrors.join("; ")}` });
      continue;
    }

    summary.sent.push(customer.id);
  }

  return summary;
}
