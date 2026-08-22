"use server";

import { createAdminClient } from "./supabase/admin";

export interface CaptureEmailSignupResult {
  ok: boolean;
  error?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Low-commitment interest capture (website audit item 12) -- deliberately
 * scoped minimal, no confirmation email. A repeat submission of the same
 * email is a no-op, not an error, so the caller can't tell (and doesn't
 * need to) whether this was a new signup or an existing one.
 */
export async function captureEmailSignup(email: string): Promise<CaptureEmailSignupResult> {
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("email_signups")
    .upsert({ email: trimmed, source: "homepage" }, { onConflict: "email", ignoreDuplicates: true });

  if (error) {
    return { ok: false, error: "Something went wrong. Try again." };
  }

  return { ok: true };
}
