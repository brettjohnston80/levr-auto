import "server-only";
import { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";
import { isProductionDeploy, runtimeEnv } from "./runtime-env";

/**
 * Alert emails (Phase 1, Chunk 4; plan section 4 and wording in section 3.4).
 *
 * agent_alerts rows are written by the database (assign_search's lead fallback and no-lead
 * cases, log_agent_activity's caught failures) and by the app (logAgentActivity when the call
 * itself fails; assignSearch when assignment fails for a real customer). This sweep emails each
 * one to its audience and stamps notified_at:
 *   - leads  = active leads, or active admins when there's no active lead;
 *   - admins = active admins.
 * (agent_alert_recipients(), Step 13; test agents never receive alerts.)
 *
 * Each alert is CLAIMED first with one conditional update (notified_at is null), so two runs that
 * overlap send each alert once. If every send for an alert fails, or nobody can receive it, the
 * claim is undone so the next run retries; a partial failure is logged and not retried, so nobody
 * gets the same alert twice.
 *
 * Runs from the hourly sweep (/api/cron/agent-sweeps) and straight after an assignment that
 * returned an alert. Outside production, sendEmail logs agent email instead of sending it.
 */

const BATCH = 50;

export type AlertKind = "assignment_lead_fallback" | "assignment_no_lead" | "assignment_failed" | "activity_log_failed" | "other";

interface AlertRow {
  id: string;
  kind: AlertKind;
  audience: "leads" | "admins";
  search_id: string | null;
  agent_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AlertSweepCounts {
  claimed: number;
  sent: number; // emails handed to sendEmail without an error (one per recipient)
  alertsNotified: number;
  retryLater: number; // un-claimed: every send failed, or nobody could receive it
  partial: number; // some sends failed; left claimed so nobody gets it twice
  errors: { alertId: string; error: string }[];
}

/**
 * Where it may run: production sends every pending alert; a preview never runs it (it shares the
 * production database); anywhere else only named alerts, so a local run can never claim (and so
 * silently swallow) a real alert.
 */
export function alertScope(onlyAlertIds: string[] | null): { allowed: true } | { allowed: false; reason: string } {
  const env = runtimeEnv();
  if (env === "production") return { allowed: true };
  if (env === "preview") return { allowed: false, reason: "not run on a preview build" };
  if (!onlyAlertIds || onlyAlertIds.length === 0) {
    return { allowed: false, reason: "outside production only named alerts are sent" };
  }
  return { allowed: true };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface AlertContext {
  customerName: string;
  vehicle: string;
  agentName: string;
  actionLabel: string;
  error: string;
  adminUrl: string;
}

/** The subject and body for one alert (wording: plan section 3.4). Exported for the preview test. */
export function buildAlertEmail(kind: AlertKind, c: AlertContext): { subject: string; text: string } {
  const link = `Search: ${c.adminUrl}`;
  switch (kind) {
    case "assignment_lead_fallback":
      return {
        subject: `Search assigned to ${c.agentName}: nobody is in rotation`,
        text: `${c.customerName}'s ${c.vehicle} search was paid and assigned to ${c.agentName}, because no agent is in rotation. Put an agent back in rotation, or reassign the search if someone else should take it. ${link}`,
      };
    case "assignment_no_lead":
      return {
        subject: "A paid search has no agent",
        text: `${c.customerName}'s ${c.vehicle} search is paid but couldn't be assigned: no agent is in rotation and there is no active lead. Put someone in rotation or assign it yourself. ${link}`,
      };
    case "activity_log_failed":
      return {
        subject: "An agent action wasn't recorded in the activity log",
        text: `${c.agentName}'s action "${c.actionLabel}" went through, but its activity record couldn't be saved (${c.error}). Nothing needs undoing; this only affects the history.`,
      };
    case "assignment_failed":
      return {
        subject: "Automatic assignment failed for a paid search",
        text: `Assigning ${c.customerName}'s ${c.vehicle} search failed: ${c.error}. The hourly sweep will try again. ${link}`,
      };
    default:
      // Nothing writes 'other' today; a plain fallback so one is never dropped silently.
      return { subject: "A LEVR Auto agent alert needs attention", text: `An alert was raised (${c.error}). ${link}` };
  }
}

function toHtml(text: string, adminUrl: string): string {
  // The admin link becomes a real link; everything else is escaped text.
  const parts = text.split(adminUrl).map(esc);
  return `<p>${parts.join(`<a href="${esc(adminUrl)}">${esc(adminUrl)}</a>`)}</p>`;
}

async function contextFor(alert: AlertRow): Promise<AlertContext> {
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const details = alert.details ?? {};
  const ctx: AlertContext = {
    customerName: "A customer",
    vehicle: "vehicle",
    agentName: "An agent",
    actionLabel: typeof details.action === "string" ? details.action : "unknown action",
    error: typeof details.error === "string" ? details.error : "no error message",
    adminUrl: `${siteUrl}/internal/admin`,
  };

  if (alert.search_id) {
    const { data: s } = await admin
      .from("customer_searches")
      .select("customer_id, make, model, model_year")
      .eq("id", alert.search_id)
      .maybeSingle();
    if (s) {
      ctx.vehicle = s.make && s.model ? [s.model_year, s.make, s.model].filter(Boolean).join(" ") : "undecided";
      const { data: cust } = await admin.from("customers").select("first_name, last_name").eq("id", s.customer_id).maybeSingle();
      const name = [cust?.first_name, cust?.last_name].filter(Boolean).join(" ").trim();
      if (name) ctx.customerName = name;
      else {
        const { data: u } = await admin.auth.admin.getUserById(s.customer_id);
        if (u?.user?.email) ctx.customerName = u.user.email;
      }
    }
  }
  if (alert.agent_id) {
    const { data: ag } = await admin.from("agents").select("name").eq("id", alert.agent_id).maybeSingle();
    if (ag?.name) ctx.agentName = ag.name;
  }
  if (alert.kind === "activity_log_failed" && typeof details.action === "string") {
    const { data: t } = await admin.from("agent_activity_types").select("label").eq("code", details.action).maybeSingle();
    if (t?.label) ctx.actionLabel = t.label;
  }
  return ctx;
}

/** Emails pending alerts (up to 50). Never throws. */
export async function sendPendingAgentAlerts(opts: { onlyAlertIds?: string[] } = {}): Promise<AlertSweepCounts> {
  const counts: AlertSweepCounts = { claimed: 0, sent: 0, alertsNotified: 0, retryLater: 0, partial: 0, errors: [] };
  const scope = alertScope(opts.onlyAlertIds ?? null);
  if (!scope.allowed) {
    console.log("[agent-alerts] skipped:", scope.reason);
    return counts;
  }
  try {
    const admin = createAdminClient();
    let pending = admin.from("agent_alerts").select("id").is("notified_at", null).order("created_at", { ascending: true }).limit(BATCH);
    if (opts.onlyAlertIds) pending = pending.in("id", opts.onlyAlertIds);
    const { data: candidates, error: listError } = await pending;
    if (listError) throw new Error(`Could not load pending alerts: ${listError.message}`);
    const ids = (candidates ?? []).map((r) => r.id as string);
    if (ids.length === 0) return counts;

    // The claim: only rows still un-notified are returned, so an overlapping run gets the rest.
    const { data: claimedRows, error: claimError } = await admin
      .from("agent_alerts")
      .update({ notified_at: new Date().toISOString() })
      .in("id", ids)
      .is("notified_at", null)
      .select("id, kind, audience, search_id, agent_id, details, created_at");
    if (claimError) throw new Error(`Could not claim alerts: ${claimError.message}`);
    const claimed = (claimedRows ?? []) as AlertRow[];
    counts.claimed = claimed.length;

    const recipientsByAudience = new Map<string, { email: string; name: string }[]>();
    for (const alert of claimed) {
      try {
        if (!recipientsByAudience.has(alert.audience)) {
          const { data, error } = await admin.rpc("agent_alert_recipients", { p_audience: alert.audience });
          if (error) throw new Error(`Could not load recipients: ${error.message}`);
          recipientsByAudience.set(alert.audience, (data ?? []) as { email: string; name: string }[]);
        }
        const recipients = recipientsByAudience.get(alert.audience)!;
        const ctx = await contextFor(alert);
        const { subject, text } = buildAlertEmail(alert.kind, ctx);
        const html = toHtml(text, ctx.adminUrl);

        let ok = 0;
        const failures: string[] = [];
        for (const r of recipients) {
          try {
            // Test-only, never honoured in production: every alert send fails, to show the claim
            // is undone and the alert retried.
            if (!isProductionDeploy() && process.env.AGENT_ALERT_FORCE_SEND_FAIL === "1") throw new Error("forced test send failure");
            await sendEmail({ to: r.email, toName: r.name, subject, html, audience: "agent" });
            ok++;
          } catch (e) {
            failures.push(`${r.email}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        counts.sent += ok;
        // Outside production the body is logged too, so a test can check the exact wording
        // (production logs keep customer details out).
        console.log("[agent-alert]", JSON.stringify({ alertId: alert.id, kind: alert.kind, audience: alert.audience, recipients: recipients.map((r) => r.email), subject, sent: ok, failed: failures.length, ...(isProductionDeploy() ? {} : { html }) }));

        if (ok === 0) {
          // Nothing went out: undo the claim so the next run tries again.
          await admin.from("agent_alerts").update({ notified_at: null }).eq("id", alert.id);
          counts.retryLater++;
          const why = recipients.length === 0 ? `nobody can receive ${alert.audience} alerts` : failures.join("; ");
          counts.errors.push({ alertId: alert.id, error: why });
          console.error("[agent-alert-failed]", { alertId: alert.id, error: why });
        } else {
          counts.alertsNotified++;
          if (failures.length) {
            counts.partial++;
            console.error("[agent-alert-partial]", { alertId: alert.id, failures });
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await admin.from("agent_alerts").update({ notified_at: null }).eq("id", alert.id);
        counts.retryLater++;
        counts.errors.push({ alertId: alert.id, error: message });
        console.error("[agent-alert-failed]", { alertId: alert.id, error: message });
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    counts.errors.push({ alertId: "-", error: message });
    console.error("[agent-alert-failed]", { error: message });
  }
  return counts;
}

/**
 * Records an assignment_failed alert for a real customer's search, at most one open per search
 * (the sweep retries every hour, and each retry must not raise a new email). Test customers
 * (.invalid) get none. Returns the alert id when a new one was written. Never throws.
 */
export async function raiseAssignmentFailedAlert(searchId: string, source: string, error: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: s } = await admin.from("customer_searches").select("customer_id").eq("id", searchId).maybeSingle();
    if (!s) return null;
    const { data: u } = await admin.auth.admin.getUserById(s.customer_id);
    if ((u?.user?.email ?? "").toLowerCase().endsWith(".invalid")) return null;
    const { data: open } = await admin
      .from("agent_alerts")
      .select("id")
      .eq("search_id", searchId)
      .eq("kind", "assignment_failed")
      .is("resolved_at", null)
      .limit(1);
    if (open && open.length > 0) return null;
    const { data, error: insertError } = await admin
      .from("agent_alerts")
      .insert({ kind: "assignment_failed", audience: "leads", search_id: searchId, details: { error, source } })
      .select("id")
      .single();
    if (insertError) {
      console.error("[assignment-failed] could not write the alert", { searchId, error: insertError.message });
      return null;
    }
    return data.id as string;
  } catch (e) {
    console.error("[assignment-failed] could not write the alert", { searchId, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
