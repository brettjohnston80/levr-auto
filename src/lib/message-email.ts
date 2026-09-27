import "server-only";

import type { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";

type AdminClient = ReturnType<typeof createAdminClient>;

// Agent-message email (2026-09-26, plan approved: docs/plans/message-email-plan.md).
// The email carries NO message content, dealer or price -- only that a
// message is waiting, and a link to the thread.
//
// Rules:
//  - At most one email per thread until the customer opens it: send only if
//    message_email_sent_at is null or older than customer_messages_read_at.
//    Stamped after a successful send, so a failed send retries on the next
//    agent reply.
//  - Skipped when the customer turned email notifications off
//    (notify_by_email). Sent regardless of the daily-digest setting (Brett,
//    2026-09-26) -- a "you have a message" nudge a day late defeats itself.
//  - Always via sendEmail(), whose first line suppresses @levrauto-test.invalid.
//  - Non-blocking: the caller's message is already saved; this never throws.

// Approved copy (2026-09-26).
export const MESSAGE_EMAIL_SUBJECT = "You have a new message from your LEVR agent";
const MESSAGE_EMAIL_BODY = "You have a new message from your LEVR agent.";
const MESSAGE_EMAIL_BUTTON = "View message";
const MESSAGE_EMAIL_FOOTER =
  "We'll email you once per conversation until you've read it. You can turn off email notifications in your account settings.";

// Same small local copy every sender keeps (see agent-call-notifications.ts).
function customerDisplayName(customer: { first_name?: string | null; last_name?: string | null }): string | undefined {
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
  return name || undefined;
}

export type MessageEmailOutcome =
  | "sent"
  | "already_emailed_unread"
  | "email_notifications_off"
  | "no_email"
  | "error";

export async function emailCustomerAboutAgentMessage(admin: AdminClient, offerId: string): Promise<MessageEmailOutcome> {
  try {
    const { data: offer } = await admin
      .from("qualifying_offers")
      .select("id, customer_search_id, message_email_sent_at, customer_messages_read_at")
      .eq("id", offerId)
      .maybeSingle();
    if (!offer) return "error";

    const sentAt = offer.message_email_sent_at as string | null;
    const readAt = offer.customer_messages_read_at as string | null;
    if (sentAt && !(readAt && new Date(readAt) > new Date(sentAt))) return "already_emailed_unread";

    const { data: search } = await admin
      .from("customer_searches")
      .select("customer_id")
      .eq("id", offer.customer_search_id)
      .maybeSingle();
    if (!search) return "error";
    const { data: customer } = await admin
      .from("customers")
      .select("email, first_name, last_name, notify_by_email")
      .eq("id", search.customer_id)
      .maybeSingle();
    if (!customer) return "error";
    if (!customer.notify_by_email) return "email_notifications_off";
    if (!customer.email) return "no_email";

    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const link = `${site}/account/messages/${offerId}`;
    const html = `
      <p>${MESSAGE_EMAIL_BODY}</p>
      <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#10b981;color:#0a0a0a;border-radius:9999px;text-decoration:none;font-weight:600">${MESSAGE_EMAIL_BUTTON}</a></p>
      <p style="color:#71717a;font-size:12px">${MESSAGE_EMAIL_FOOTER}</p>
    `;

    await sendEmail({ to: customer.email as string, toName: customerDisplayName(customer), subject: MESSAGE_EMAIL_SUBJECT, html });
    await admin.from("qualifying_offers").update({ message_email_sent_at: new Date().toISOString() }).eq("id", offerId);
    return "sent";
  } catch (e) {
    console.error("emailCustomerAboutAgentMessage failed", offerId, e);
    return "error";
  }
}
