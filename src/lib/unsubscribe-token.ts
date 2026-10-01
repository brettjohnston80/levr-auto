import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Signed one-click unsubscribe links for the unpaid-search reminders
// (sign-up-to-payment fix, approved 2026-09-30). The token is
// "<customerId>.<signature>", the signature an HMAC-SHA256 of the customer id
// under UNSUBSCRIBE_SECRET, scoped to this one list so a token can never be
// reused for anything else. No expiry: an unsubscribe link should keep
// working for as long as the email exists.

const SCOPE = "unpaid-search-reminders";

function secret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || null;
}

function sign(customerId: string, key: string): string {
  return createHmac("sha256", key).update(`${SCOPE}:${customerId}`).digest("base64url");
}

/** Null when UNSUBSCRIBE_SECRET is unset -- callers must not send then. */
export function unpaidReminderUnsubscribeToken(customerId: string): string | null {
  const key = secret();
  return key ? `${customerId}.${sign(customerId, key)}` : null;
}

/** The customer id a token was issued for, or null if it isn't valid. */
export function verifyUnpaidReminderUnsubscribeToken(token: string | null | undefined): string | null {
  const key = secret();
  if (!key || !token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const customerId = token.slice(0, dot);
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) return null;
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(customerId, key));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return customerId;
}
