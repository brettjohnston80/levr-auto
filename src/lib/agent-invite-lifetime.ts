// Plain module (no server imports), shared by the invite emails and the Add-agent page.

// How long a one-time link stays valid, in seconds. This MUST equal the
// project's "Email OTP Expiration" setting (Supabase dashboard → Authentication
// → Providers → Email), which also governs customer sign-up and reset links;
// the emails' "expires in …" text is built from it. Brett kept the current
// setting (option (a)) and confirmed it is 3600 seconds (2026-10-13).
export const SETUP_LINK_LIFETIME_SECONDS = 3600;

export function linkLifetimeText(seconds: number = SETUP_LINK_LIFETIME_SECONDS): string {
  if (seconds % 3600 === 0) {
    const h = seconds / 3600;
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  const m = Math.round(seconds / 60);
  return m === 1 ? "1 minute" : `${m} minutes`;
}

export const SETUP_LINK_LIFETIME = linkLifetimeText();
