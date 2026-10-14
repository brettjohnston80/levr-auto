import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isProductionDeploy, runtimeEnv } from "@/lib/runtime-env";
import { assignSearch } from "@/lib/search-assignment";

// Phase 1 Chunk 6 (plan section 3.5, Q6): the email now goes ONLY to the search's assigned agent,
// with "This search is assigned to you." on top. With no agent assigned: a real customer's search
// is assigned first (assign_search), then emailed to whoever got it; a test account's (never
// auto-assigned), or one assignment leaves unassigned, goes to leads (admins when there's no lead)
// without that line. An away agent still gets it.
//
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
  /** True when the email goes to the search's assigned agent: adds "This search is assigned to you." */
  assignedToRecipient?: boolean;
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
      (params.assignedToRecipient ? "<p>This search is assigned to you.</p>" : "") +
      `<p>${who} asked for a call to ${copy.verb} ${vehicle} search.</p>` +
      (contactLines ? `<ul>${contactLines}</ul>` : "") +
      `<p><a href="${outreachUrl}">Open this request on /internal/outreach</a>.</p>`,
  };
}

export interface NotifyAgentsResult {
  sent: number;
  errors: string[];
  /** Who it went to, and why (assigned agent, or the leads/admins fallback). */
  recipients: string[];
  route: "assigned" | "fallback" | "none";
}

/**
 * Best-effort, never throws: callers invoke this AFTER their own call_requested_at-style write
 * has succeeded, so a notification failure must never fail the customer's action (the request is
 * already recorded and visible in the agent queue). Callers `await` it directly.
 */
export async function notifyAgentsOfCallRequest(params: {
  callType: CallRequestType;
  searchId: string;
  customerId: string;
  make: string | null;
  model: string | null;
  modelYear: number | null;
}): Promise<NotifyAgentsResult> {
  const result: NotifyAgentsResult = { sent: 0, errors: [], recipients: [], route: "none" };
  try {
    const admin = createAdminClient();

    const [{ data: search }, { data: customer }, { data: login }] = await Promise.all([
      admin.from("customer_searches").select("assigned_agent_id").eq("id", params.searchId).maybeSingle(),
      admin.from("customers").select("email, first_name, last_name, phone").eq("id", params.customerId).maybeSingle(),
      admin.auth.admin.getUserById(params.customerId),
    ]);
    const isTestCustomer = (login?.user?.email ?? "").toLowerCase().endsWith(".invalid");

    // The assigned agent, if still active.
    const assignedAgent = async (agentId: string | null | undefined) => {
      if (!agentId) return null;
      const { data } = await admin.from("agents").select("email, name, active").eq("id", agentId).maybeSingle();
      return data?.active ? data : null;
    };
    let agent = await assignedAgent(search?.assigned_agent_id);
    // No agent yet: a real customer's search is assigned first (never on a preview build, which
    // shares the production database). A test account is never auto-assigned.
    if (!agent && !isTestCustomer && runtimeEnv() !== "preview") {
      const outcome = await assignSearch(params.searchId, "call_request");
      if (outcome.ok && outcome.agentId) agent = await assignedAgent(outcome.agentId);
    }

    let recipients: { email: string; name: string }[];
    if (agent) {
      recipients = [{ email: agent.email, name: agent.name }];
      result.route = "assigned";
    } else {
      const { data, error } = await admin.rpc("agent_alert_recipients", { p_audience: "leads" });
      if (error) throw new Error(`Could not load leads: ${error.message}`);
      recipients = (data ?? []) as { email: string; name: string }[];
      result.route = "fallback";
    }
    if (recipients.length === 0) {
      result.errors.push("Nobody to notify");
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
      assignedToRecipient: result.route === "assigned",
    });

    for (const r of recipients) {
      try {
        await sendEmail({ to: r.email, toName: r.name, subject, html, audience: "agent" });
        result.sent += 1;
        result.recipients.push(r.email);
      } catch (err) {
        result.errors.push(`Send to ${r.email} failed: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
    // One searchable line per request (test and Vercel logs).
    console.log("[call-request-email]", JSON.stringify({ searchId: params.searchId, callType: params.callType, route: result.route, recipients: result.recipients, subject, ...(isProductionDeploy() ? {} : { html }) }));
  } catch (err) {
    result.errors.push(`notifyAgentsOfCallRequest failed: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  return result;
}
