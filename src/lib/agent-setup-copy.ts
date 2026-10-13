// Wording for the agent invite / set-password / two-factor / reset screens
// (Phase 1, Chunk 1c; plan section 3.6 and C15). Plain module so pages,
// forms and server actions share one copy. New lines pending Brett's sign-off.

export const AGENT_LINK_INVALID = "This link has expired or has already been used.";
export const AGENT_LINK_INVALID_INVITE_HINT = "Ask your lead to send a new invite.";
export const AGENT_LINK_INVALID_RESET_LINK = "Request a new reset link";
export const AGENT_PASSWORDS_DONT_MATCH = "Passwords don't match.";
export const AGENT_RESET_SENT =
  "If that's an agent's work email, we've sent a link to reset the password. Check your inbox.";

export const ACCEPT_COPY = {
  invite: {
    heading: "Welcome to the LEVR Auto agent dashboard",
    body: "Continue to set your password and turn on two-factor sign-in.",
  },
  reset: {
    heading: "Reset your password",
    body: "Continue to set a new password.",
  },
} as const;
