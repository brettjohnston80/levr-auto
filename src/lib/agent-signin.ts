import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "./supabase/admin";

/**
 * Agent sign-in rate limiting (Phase 1, Chunk 1b; plan section 7.4).
 *
 * Supabase's own per-IP limits apply underneath. Ours, counted in
 * agent_signin_attempts (Step 12):
 *   - 5 failed attempts per account per 15 minutes,
 *   - 20 failed attempts per IP address per 15 minutes.
 * Password and two-factor failures count together. A blocked attempt is not
 * recorded, so it doesn't extend the window.
 *
 * Emails and IPs are stored only as keyed hashes (HMAC-SHA256), never raw.
 * The key is the server-only service-role key, so a leaked table can't be
 * matched against a list of guessed addresses. Rotating that key only resets
 * the current 15-minute windows.
 */

export const SIGNIN_WINDOW_MINUTES = 15;
export const MAX_FAILURES_PER_ACCOUNT = 5;
export const MAX_FAILURES_PER_IP = 20;

// Approved wording, plan section 3.6 (sign-off pending).
export const AGENT_SIGNIN_GENERIC_ERROR = "That didn't work. Check your details and try again.";
export const AGENT_SIGNIN_TOO_MANY = "Too many sign-in attempts. Wait 15 minutes and try again.";

// Every failure takes at least this long, so the response time doesn't show
// which detail was wrong (an unknown email returns faster than a wrong password).
const MIN_FAILURE_MS = 900;

function hashValue(kind: "email" | "ip", value: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createHmac("sha256", key).update(`levr-agent-signin:${kind}:${value}`).digest("hex");
}

export function normalizeSigninEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

export interface SigninKeys {
  emailHash: string;
  ipHash: string;
}

export async function signinKeys(email: string): Promise<SigninKeys> {
  return {
    emailHash: hashValue("email", normalizeSigninEmail(email)),
    ipHash: hashValue("ip", await clientIp()),
  };
}

/** True when this account or IP has used up its failures in the window. */
export async function isSigninRateLimited(keys: SigninKeys): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - SIGNIN_WINDOW_MINUTES * 60_000).toISOString();
  const [byEmail, byIp] = await Promise.all([
    admin
      .from("agent_signin_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email_hash", keys.emailHash)
      .eq("succeeded", false)
      .gte("created_at", since),
    admin
      .from("agent_signin_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", keys.ipHash)
      .eq("succeeded", false)
      .gte("created_at", since),
  ]);
  if (byEmail.error || byIp.error) {
    // Fail closed: if the limit can't be checked, don't allow the attempt.
    console.error("[agent-signin] rate-limit check failed", byEmail.error?.message ?? byIp.error?.message);
    return true;
  }
  return (byEmail.count ?? 0) >= MAX_FAILURES_PER_ACCOUNT || (byIp.count ?? 0) >= MAX_FAILURES_PER_IP;
}

export async function recordSigninAttempt(
  keys: SigninKeys,
  stage: "password" | "two_factor",
  succeeded: boolean,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("agent_signin_attempts").insert({
    email_hash: keys.emailHash,
    ip_hash: keys.ipHash,
    stage,
    succeeded,
  });
  if (error) console.error("[agent-signin] could not record attempt", error.message);
}

/** Waits until at least MIN_FAILURE_MS has passed since `startedAt`. */
export async function padFailure(startedAt: number): Promise<void> {
  const wait = MIN_FAILURE_MS - (Date.now() - startedAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
