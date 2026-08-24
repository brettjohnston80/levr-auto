import "server-only";
import { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";
import { composeEventLine, type NotificationEventType } from "./notifications";

function customerDisplayName(customer: { first_name?: string | null; last_name?: string | null }): string | undefined {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || undefined;
}

export interface DigestSummary {
  sent: string[];
  errors: { customerId: string; error: string }[];
}

/**
 * Daily rollup for communication_frequency = 'daily_digest' customers.
 * Finds every notification_events row still digest_sent_at IS NULL for
 * those customers (an event's own digest_sent_at is the complete tracking
 * mechanism -- no separate "last digest sent" state needed on customers),
 * composes one email per customer listing everything, sends it, then marks
 * exactly those event rows delivered. No email at all when a customer has
 * zero pending events.
 */
export async function sendNotificationDigests(): Promise<DigestSummary> {
  const admin = createAdminClient();
  const summary: DigestSummary = { sent: [], errors: [] };

  // A digest is inherently an email -- gating on communication_frequency
  // alone isn't enough. A daily_digest customer who's also turned
  // notify_by_email off (e.g. text-only, or callback-only) has no channel
  // for a digest to go through; their events still get an immediate
  // agent_callback_requested_at at creation time if applicable (see
  // logNotificationEvent), so nothing is silently lost -- there's just
  // never a digest email for them, which is correct, not a gap.
  const { data: digestCustomers, error: customersError } = await admin
    .from("customers")
    .select("id, email, first_name, last_name")
    .eq("communication_frequency", "daily_digest")
    .eq("notify_by_email", true);

  if (customersError) {
    throw new Error(`Failed to load daily_digest customers: ${customersError.message}`);
  }
  if (!digestCustomers || digestCustomers.length === 0) return summary;

  const customerIds = digestCustomers.map((c) => c.id);
  const { data: events, error: eventsError } = await admin
    .from("notification_events")
    .select("id, customer_id, customer_search_id, event_type, event_data")
    .in("customer_id", customerIds)
    .is("digest_sent_at", null)
    .order("created_at", { ascending: true });

  if (eventsError) {
    throw new Error(`Failed to load pending digest events: ${eventsError.message}`);
  }
  if (!events || events.length === 0) return summary;

  const eventsByCustomer = new Map<string, typeof events>();
  for (const e of events) {
    const list = eventsByCustomer.get(e.customer_id) ?? [];
    list.push(e);
    eventsByCustomer.set(e.customer_id, list);
  }

  const searchIds = [...new Set(events.map((e) => e.customer_search_id))];
  const { data: searches } = await admin.from("customer_searches").select("id, make, model").in("id", searchIds);
  const searchById = new Map((searches ?? []).map((s) => [s.id, s]));

  const customerById = new Map(digestCustomers.map((c) => [c.id, c]));

  for (const [customerId, customerEvents] of eventsByCustomer) {
    const customer = customerById.get(customerId);
    if (!customer?.email) {
      summary.errors.push({ customerId, error: "No customer email on file" });
      continue;
    }

    const lines = customerEvents.map((e) => {
      const search = searchById.get(e.customer_search_id) ?? { make: null, model: null };
      return composeEventLine(e.event_type as NotificationEventType, e.event_data as Record<string, unknown>, search);
    });

    const count = lines.length;
    const subject = `Your LEVR Auto update — ${count} update${count === 1 ? "" : "s"}`;
    const html = `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>`;

    try {
      await sendEmail({ to: customer.email, toName: customerDisplayName(customer), subject, html });
    } catch (err) {
      summary.errors.push({ customerId, error: err instanceof Error ? err.message : "Send failed" });
      continue;
    }

    const { error: updateError } = await admin
      .from("notification_events")
      .update({ digest_sent_at: new Date().toISOString() })
      .in(
        "id",
        customerEvents.map((e) => e.id)
      );

    if (updateError) {
      summary.errors.push({ customerId, error: `Email sent but failed to mark delivered: ${updateError.message}` });
      continue;
    }

    summary.sent.push(customerId);
  }

  return summary;
}
