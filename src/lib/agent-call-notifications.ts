import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// Closes a real gap (investigated 2026-09-20): requestFinalizationCall /
// requestSwitchCall / requestCancellationCall previously only wrote a
// call_requested_at-style timestamp and sat passively in one of the three
// matching /internal/outreach queues -- nothing actively told an agent a
// customer was waiting. Reuses sendArticleReminders' own pattern (query
// active agents, sendEmail() to each, one recipient's failure doesn't
// block another's) rather than inventing a second notification mechanism
// -- this file has no reminder-cadence/dedup logic of its own, since a
// call request is a one-shot event, not a recurring nudge.

export type CallRequestType = "finalization" | "switch" | "cancellation";

const CALL_TYPE_COPY: Record<CallRequestType, { verb: string; anchor: string; subjectNoun: string }> = {
  finalization: {
    verb: "finalize the trim, color, and options on their",
    anchor: "finalization-calls",
    subjectNoun: "finalization call",
  },
  switch: {
    verb: "switch away from their current",
    anchor: "switch-calls",
    subjectNoun: "switch call",
  },
  cancellation: {
    verb: "talk through cancelling their",
    anchor: "cancellation-calls",
    subjectNoun: "cancellation call",
  },
};

function vehicleLabel(make: string | null, model: string | null, modelYear: number | null): string {
  const base = [make, model].filter(Boolean).join(" ") || "vehicle";
  return modelYear ? `${modelYear} ${base}` : base;
}

// Same [first, last].filter(Boolean).join(" ") shape as notifications.ts's
// own customerDisplayName() -- kept as a separate small copy rather than
// a shared import since that file's version isn't exported and the two
// have no other reason to depend on each other.
function customerDisplayName(customer: { first_name?: string | null; last_name?: string | null }): string | undefined {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || undefined;
}

/**
 * Pure -- no DB read, no network call -- so its output can be verified
 * directly against real scratch data without ever invoking sendEmail().
 */
export function buildCallRequestEmail(params: {
  callType: CallRequestType;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  customerName: string | undefined;
  customerEmail: string | null;
  customerPhone: string | null;
  outreachUrl: string;
}): { subject: string; html: string } {
  const { callType, make, model, modelYear, customerName, customerEmail, customerPhone, outreachUrl } = params;
  const copy = CALL_TYPE_COPY[callType];
  const vehicle = vehicleLabel(make, model, modelYear);
  const who = customerName ?? customerEmail ?? "A customer";

  const contactLines = [
    customerName ? `<li>Name: ${customerName}</li>` : null,
    customerEmail ? `<li>Email: ${customerEmail}</li>` : null,
    customerPhone ? `<li>Phone: ${customerPhone}</li>` : null,
  ]
    .filter(Boolean)
    .join("");

  return {
    subject: `${who} requested a ${copy.subjectNoun} — ${vehicle}`,
    html:
      `<p>${who} asked for a call to ${copy.verb} ${vehicle} search.</p>` +
      (contactLines ? `<ul>${contactLines}</ul>` : "") +
      `<p><a href="${outreachUrl}">Open this request on /internal/outreach</a>.</p>`,
  };
}

export interface NotifyAgentsResult {
  sent: number;
  errors: string[];
}

/**
 * Best-effort, never throws -- the whole body is wrapped, same convention
 * as notifications.ts's own logNotificationEvent(). Callers invoke this
 * AFTER their own call_requested_at-style write has already succeeded, so
 * a notification failure here must never surface as a failure of the
 * customer-facing action -- the call request itself is already recorded
 * and already visible in the agent queue regardless of whether this email
 * goes out. Callers `await` it directly (no fire-and-forget, no external
 * .catch()) since a Server Action's execution isn't guaranteed to survive
 * past its own return in every runtime this could deploy to.
 */
export async function notifyAgentsOfCallRequest(params: {
  callType: CallRequestType;
  customerId: string;
  make: string | null;
  model: string | null;
  modelYear: number | null;
}): Promise<NotifyAgentsResult> {
  const result: NotifyAgentsResult = { sent: 0, errors: [] };
  try {
    const admin = createAdminClient();

    const [{ data: agents }, { data: customer }] = await Promise.all([
      admin.from("agents").select("email, name").eq("active", true),
      admin
        .from("customers")
        .select("email, first_name, last_name, phone")
        .eq("id", params.customerId)
        .maybeSingle(),
    ]);

    if (!agents || agents.length === 0) {
      result.errors.push("No active agents to notify");
      return result;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const outreachUrl = `${siteUrl}/internal/outreach#${CALL_TYPE_COPY[params.callType].anchor}`;

    const { subject, html } = buildCallRequestEmail({
      callType: params.callType,
      make: params.make,
      model: params.model,
      modelYear: params.modelYear,
      customerName: customer ? customerDisplayName(customer) : undefined,
      customerEmail: customer?.email ?? null,
      customerPhone: customer?.phone ?? null,
      outreachUrl,
    });

    for (const agent of agents) {
      try {
        await sendEmail({ to: agent.email, toName: agent.name, subject, html });
        result.sent += 1;
      } catch (err) {
        result.errors.push(`Send to ${agent.email} failed: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
  } catch (err) {
    result.errors.push(`notifyAgentsOfCallRequest failed: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  return result;
}
