import "server-only";
import { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";
import { formatLongDate } from "./dashboard-format";

export type NotificationEventType =
  | "offer_logged"
  | "offer_response_recorded"
  | "deal_progress_update"
  | "search_purchased"
  | "offer_withdrawn"
  | "guarantee_resolved";

/**
 * Notification rules (2026-09-27, docs/plans/guarantee-progress-notifications-plan.md):
 * HIGHLIGHTS go out immediately to every customer with email on, whatever
 * their old communication_frequency said (that setting is retired). Routine
 * events -- today only the customer's own accept/decline receipt -- wait for
 * the one daily update email (notification-digest.ts).
 */
export const HIGHLIGHT_EVENT_TYPES: NotificationEventType[] = [
  "offer_logged",
  "offer_withdrawn",
  "deal_progress_update",
  "search_purchased",
  "guarantee_resolved",
];
export const DAILY_UPDATE_EVENT_TYPES: NotificationEventType[] = ["offer_response_recorded"];

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
export interface OfferWithdrawnData {
  dealerName: string;
}
export interface GuaranteeResolvedData {
  outcome: "met" | "refunded";
  /** ISO timestamp: the search deadline (effectiveDeadline) at resolution. */
  searchContinuesThrough: string;
}

type LogNotificationEventInput =
  | { customerSearchId: string; eventType: "offer_logged"; eventData: OfferLoggedData }
  | { customerSearchId: string; eventType: "offer_response_recorded"; eventData: OfferResponseRecordedData }
  | { customerSearchId: string; eventType: "deal_progress_update"; eventData: DealProgressUpdateData }
  | { customerSearchId: string; eventType: "search_purchased"; eventData: SearchPurchasedData }
  | { customerSearchId: string; eventType: "offer_withdrawn"; eventData: OfferWithdrawnData }
  | { customerSearchId: string; eventType: "guarantee_resolved"; eventData: GuaranteeResolvedData };

// Link under every highlight email. Needs Brett's sign-off (2026-09-27).
const HIGHLIGHT_LINK_LABEL = "Go to Your Deal";

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
    // Approved copy (2026-09-27).
    case "offer_withdrawn": {
      const d = eventData as unknown as OfferWithdrawnData;
      return {
        subject: "An update on your accepted offer",
        html: `<p>Your accepted offer from ${d.dealerName} was released, so you can choose another offer. Your agent will be in touch about what happened.</p>`,
      };
    }
    case "guarantee_resolved": {
      const d = eventData as unknown as GuaranteeResolvedData;
      const through = formatLongDate(d.searchContinuesThrough);
      return d.outcome === "met"
        ? {
            subject: "Your LEVR guarantee was delivered",
            html: `<p>You received an offer below Total SRP within 30 days — your guarantee is met. We'll keep working your search through ${through}.</p>`,
          }
        : {
            subject: "Your $699 is being refunded",
            html: `<p>We didn't find an offer below Total SRP within 30 days, so we're refunding your $699. We'll keep searching through ${through} at no cost.</p>`,
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
    // Highlights are never in the daily update today; these lines exist so
    // the switch stays exhaustive.
    case "offer_withdrawn": {
      const d = eventData as unknown as OfferWithdrawnData;
      return `Your accepted offer from ${d.dealerName} was released`;
    }
    case "guarantee_resolved": {
      const d = eventData as unknown as GuaranteeResolvedData;
      return d.outcome === "met" ? "Your LEVR guarantee was delivered" : "Your $699 is being refunded";
    }
  }
}

/**
 * The one shared hook point for every notify-worthy event -- always inserts
 * a notification_events row (regardless of preference). A HIGHLIGHT is also
 * emailed immediately when notify_by_email is on; a routine event waits for
 * the daily update. Deliberately non-blocking end to end (wrapped in its own
 * try/catch, every failure logged not thrown) -- the caller's own primary
 * write must never fail because notification logging/sending did.
 *
 * agent_callback_requested_at is set here, at creation time -- a callback
 * task shouldn't wait for tomorrow (Brett's call, unchanged 2026-09-27).
 * flagged_no_deliverable_channel covers notify_by_text being the only
 * channel on: there's no SMS provider integrated, so that customer would
 * otherwise get nothing at all; this flags it for an agent instead.
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
      .select("email, first_name, last_name, notify_by_email, notify_by_text, notify_by_agent_callback")
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

    const sendsImmediately = HIGHLIGHT_EVENT_TYPES.includes(input.eventType);

    if (sendsImmediately && customer.notify_by_email && customer.email) {
      const { subject, html } = composeEventEmail(
        input.eventType,
        input.eventData as unknown as Record<string, unknown>,
        { make: search.make, model: search.model }
      );
      // Every highlight ends with a link to the search's Your Deal page.
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const link = `${site}/account/deal?searchId=${input.customerSearchId}`;
      const htmlWithLink = `${html}
      <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#10b981;color:#0a0a0a;border-radius:9999px;text-decoration:none;font-weight:600">${HIGHLIGHT_LINK_LABEL}</a></p>`;
      try {
        await sendEmail({ to: customer.email, toName: customerDisplayName(customer), subject, html: htmlWithLink });
        await admin.from("notification_events").update({ real_time_sent_at: new Date().toISOString() }).eq("id", eventRow.id);
      } catch (err) {
        console.error("logNotificationEvent: real-time send failed", err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error("logNotificationEvent: unexpected error", err instanceof Error ? err.message : err);
  }
}
