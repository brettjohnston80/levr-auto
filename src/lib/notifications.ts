import "server-only";
import { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";

export type NotificationEventType =
  | "offer_logged"
  | "offer_response_recorded"
  | "deal_progress_update"
  | "search_purchased";

export interface OfferLoggedData {
  dealerName: string;
  offerPriceCents: number;
  msrpCents: number;
}
export interface OfferResponseRecordedData {
  dealerName: string;
  response: "accepted" | "declined";
}
export interface DealProgressUpdateData {
  dealerName: string;
  milestone: "availability_reconfirmed" | "deposit_confirmed";
}
export interface SearchPurchasedData {
  dealerName: string;
}

type LogNotificationEventInput =
  | { customerSearchId: string; eventType: "offer_logged"; eventData: OfferLoggedData }
  | { customerSearchId: string; eventType: "offer_response_recorded"; eventData: OfferResponseRecordedData }
  | { customerSearchId: string; eventType: "deal_progress_update"; eventData: DealProgressUpdateData }
  | { customerSearchId: string; eventType: "search_purchased"; eventData: SearchPurchasedData };

function customerDisplayName(customer: { first_name?: string | null; last_name?: string | null }): string | undefined {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || undefined;
}

function formatPriceCents(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function vehicleLabel(search: { make: string | null; model: string | null }): string {
  return [search.make, search.model].filter(Boolean).join(" ") || "vehicle";
}

/** Full subject + body for a standalone real-time notification email. */
export function composeEventEmail(
  eventType: NotificationEventType,
  eventData: Record<string, unknown>,
  search: { make: string | null; model: string | null }
): { subject: string; html: string } {
  const vehicle = vehicleLabel(search);

  switch (eventType) {
    case "offer_logged": {
      const d = eventData as unknown as OfferLoggedData;
      return {
        subject: `A new offer just came in on your ${vehicle}`,
        html: `<p>Good news — ${d.dealerName} sent over a new offer: ${formatPriceCents(d.offerPriceCents)}. Log into your account to review the details and decide what's next.</p>`,
      };
    }
    case "offer_response_recorded": {
      const d = eventData as unknown as OfferResponseRecordedData;
      return {
        subject: `We've got your response on the ${d.dealerName} offer`,
        html:
          d.response === "accepted"
            ? `<p>You accepted the offer from ${d.dealerName} — nice! Your agent will be in touch to help close things out.</p>`
            : `<p>Got it — you declined the offer from ${d.dealerName}. We'll keep searching for a better fit.</p>`,
      };
    }
    case "deal_progress_update": {
      const d = eventData as unknown as DealProgressUpdateData;
      return {
        subject: `An update on your deal with ${d.dealerName}`,
        html:
          d.milestone === "availability_reconfirmed"
            ? `<p>${d.dealerName} just reconfirmed your vehicle is still available — you're on track.</p>`
            : `<p>${d.dealerName} confirmed they've received your deposit. One more step toward driving home your new car.</p>`,
      };
    }
    case "search_purchased": {
      const d = eventData as unknown as SearchPurchasedData;
      return {
        subject: `Congratulations on your new ${vehicle}!`,
        html: `<p>Your purchase from ${d.dealerName} is confirmed. Congratulations — we hope you love it.</p>`,
      };
    }
  }
}

/** One short line for the daily digest rollup -- same underlying facts as composeEventEmail, condensed. */
export function composeEventLine(
  eventType: NotificationEventType,
  eventData: Record<string, unknown>,
  search: { make: string | null; model: string | null }
): string {
  switch (eventType) {
    case "offer_logged": {
      const d = eventData as unknown as OfferLoggedData;
      return `A new offer arrived from ${d.dealerName}: ${formatPriceCents(d.offerPriceCents)}`;
    }
    case "offer_response_recorded": {
      const d = eventData as unknown as OfferResponseRecordedData;
      return `Your response to the ${d.dealerName} offer was recorded`;
    }
    case "deal_progress_update": {
      const d = eventData as unknown as DealProgressUpdateData;
      return d.milestone === "availability_reconfirmed"
        ? `${d.dealerName} reconfirmed your vehicle is still available`
        : `${d.dealerName} confirmed your deposit`;
    }
    case "search_purchased": {
      const d = eventData as unknown as SearchPurchasedData;
      return `🎉 Your ${vehicleLabel(search)} purchase from ${d.dealerName} is confirmed!`;
    }
  }
}

/**
 * The one shared hook point for all four notify-worthy events -- always
 * inserts a notification_events row (regardless of preference), and
 * additionally sends immediately only for a real_time customer with
 * notify_by_email on. Deliberately non-blocking end to end (wrapped in its
 * own try/catch, every failure logged not thrown) -- the caller's own
 * primary write (the offer, the response, the deal-progress update, the
 * purchase) must never fail because notification logging/sending did,
 * same standard as every other secondary side effect in this codebase.
 *
 * agent_callback_requested_at is set here, at creation time, unconditional
 * of communication_frequency -- a callback task shouldn't wait for
 * tomorrow's digest (per Brett's explicit call). flagged_no_deliverable_channel
 * covers the real edge case where notify_by_text is the only channel on --
 * there's no SMS provider integrated, so that customer would otherwise get
 * nothing at all; this flags it for an agent instead of silently dropping it.
 */
export async function logNotificationEvent(input: LogNotificationEventInput): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: search, error: searchError } = await admin
      .from("customer_searches")
      .select("customer_id, make, model")
      .eq("id", input.customerSearchId)
      .maybeSingle();
    if (searchError || !search) {
      console.error("logNotificationEvent: search not found", input.customerSearchId, searchError?.message);
      return;
    }

    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("email, first_name, last_name, notify_by_email, notify_by_text, notify_by_agent_callback, communication_frequency")
      .eq("id", search.customer_id)
      .maybeSingle();
    if (customerError || !customer) {
      console.error("logNotificationEvent: customer not found", search.customer_id, customerError?.message);
      return;
    }

    const flaggedNoDeliverable = customer.notify_by_text && !customer.notify_by_email && !customer.notify_by_agent_callback;

    const { data: eventRow, error: insertError } = await admin
      .from("notification_events")
      .insert({
        customer_id: search.customer_id,
        customer_search_id: input.customerSearchId,
        event_type: input.eventType,
        event_data: input.eventData,
        agent_callback_requested_at: customer.notify_by_agent_callback ? new Date().toISOString() : null,
        flagged_no_deliverable_channel: flaggedNoDeliverable,
      })
      .select("id")
      .single();

    if (insertError || !eventRow) {
      console.error("logNotificationEvent: insert failed", insertError?.message);
      return;
    }

    if (flaggedNoDeliverable) {
      console.error(
        `logNotificationEvent: customer ${search.customer_id} has notify_by_text as its only enabled channel -- nothing is actually deliverable (event ${eventRow.id})`
      );
    }

    if (customer.communication_frequency === "real_time" && customer.notify_by_email && customer.email) {
      const { subject, html } = composeEventEmail(
        input.eventType,
        input.eventData as unknown as Record<string, unknown>,
        { make: search.make, model: search.model }
      );
      try {
        await sendEmail({ to: customer.email, toName: customerDisplayName(customer), subject, html });
        await admin.from("notification_events").update({ real_time_sent_at: new Date().toISOString() }).eq("id", eventRow.id);
      } catch (err) {
        console.error("logNotificationEvent: real-time send failed", err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error("logNotificationEvent: unexpected error", err instanceof Error ? err.message : err);
  }
}
