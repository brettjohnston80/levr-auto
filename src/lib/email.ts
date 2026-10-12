import "server-only";
import { isTestEmail } from "./test-accounts";
import { isProductionDeploy } from "./runtime-env";

const ZEPTOMAIL_SEND_URL = "https://api.zeptomail.com/v1.1/email";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  toName?: string;
  /** Extra MIME headers, e.g. List-Unsubscribe (ZeptoMail's mime_headers). */
  headers?: Record<string, string>;
  /**
   * Who the email is for. "agent" covers every email to LEVR staff (call requests, article
   * reminders, and from Phase 1 the alert emails). Outside production, agent emails are only
   * ever sent to test addresses (which are suppressed below), so local development and preview
   * builds -- which share the production database -- can never email a real agent.
   * Defaults to "customer", which keeps every existing caller's behaviour unchanged.
   */
  audience?: "customer" | "agent";
}

/**
 * General-purpose transactional email sender via ZeptoMail's HTTP API --
 * not specific to any one feature. Every email this app has sent before now
 * (signup confirmation, password reset) went through Supabase Auth's own
 * built-in templates, configured with ZeptoMail as the SMTP backend at the
 * Supabase dashboard level -- there was no application-code path for
 * sending an arbitrary business email until this. First caller is the
 * Day-60 deadline reminder cron, but this file has no Day-60-specific
 * knowledge.
 *
 * ZEPTOMAIL_API_KEY / ZEPTOMAIL_FROM_EMAIL do not exist in this project's
 * env yet (confirmed by reading .env.local's key names directly -- not
 * assumed) -- these need to be added (locally and on Vercel) before this
 * can actually send mail. ZEPTOMAIL_FROM_NAME is optional, defaults to
 * "LEVR Auto".
 */
export async function sendEmail({ to, subject, html, toName, headers, audience = "customer" }: SendEmailParams): Promise<void> {
  // Tester-program suppression, and it is FIRST in this function on purpose.
  //
  // This is the single chokepoint every business email in the app passes
  // through -- Day-60 deadline reminders, auto-renew confirmations, resume
  // reminders, notification digests, real-time notifications, the post-deal
  // survey, and agent article reminders. Guarding here rather than at those
  // call sites means a sender added later cannot forget to opt in; it is
  // suppressed by default and would have to deliberately bypass sendEmail
  // to escape.
  //
  // It must run BEFORE the env checks below, which throw. A test send in an
  // environment without ZeptoMail configured should be a clean no-op, not a
  // "ZEPTOMAIL_API_KEY is not set" error that looks like a real
  // misconfiguration and, in callers that treat send failure as fatal,
  // takes the surrounding job down with it.
  //
  // Logged rather than silently dropped so a tester can still verify that
  // the TRIGGER fired -- what would have been sent, and to whom -- which is
  // most of what the email paths are worth testing for. The .invalid TLD on
  // these addresses is a second line of defence behind this, not a
  // substitute: it bounds the blast radius, this is what stops the attempt.
  if (isTestEmail(to)) {
    console.log("[email suppressed — test account]", { to, subject });
    return;
  }

  // Any .invalid address is undeliverable by definition (RFC 2606), not only the tester
  // domain above. Suppressing them all lets disposable scratch accounts use other .invalid
  // domains (agent dashboard Phase 1 testing) without a send ever being attempted.
  if (to.trim().toLowerCase().endsWith(".invalid")) {
    console.log("[email suppressed — .invalid address]", { to, subject });
    return;
  }

  // Agent-facing email outside a real production deployment is logged, never sent (Phase 1
  // safety rail). Same placement rule as above: before the env checks, so it's a clean no-op.
  if (audience === "agent" && !isProductionDeploy()) {
    console.log("[email suppressed — agent email outside production]", { to, subject });
    return;
  }

  const apiKey = process.env.ZEPTOMAIL_API_KEY;
  const fromEmail = process.env.ZEPTOMAIL_FROM_EMAIL;
  if (!apiKey) {
    throw new Error("ZEPTOMAIL_API_KEY is not set");
  }
  if (!fromEmail) {
    throw new Error("ZEPTOMAIL_FROM_EMAIL is not set");
  }
  const fromName = process.env.ZEPTOMAIL_FROM_NAME ?? "LEVR Auto";

  // ZEPTOMAIL_API_KEY is expected to be the full value ZeptoMail's console
  // gives you to copy (e.g. "Zoho-enczapikey <token>"), pasted verbatim as
  // the Authorization header -- not just the bare token.
  const res = await fetch(ZEPTOMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: { address: fromEmail, name: fromName },
      to: [
        {
          email_address: {
            address: to,
            name: toName ?? to,
          },
        },
      ],
      subject,
      htmlbody: html,
      ...(headers ? { mime_headers: headers } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ZeptoMail send failed (${res.status}): ${body}`);
  }
}
