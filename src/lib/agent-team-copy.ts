// Wording for the Add-agent page (Phase 1, Chunk 1g; plan section 3.8, plus the
// new lines marked NEW, pending Brett's sign-off). Plain module so the page,
// the forms and the server actions share one copy.
import { SETUP_LINK_LIFETIME } from "./agent-invite-lifetime";

export const TEAM_COPY = {
  pageTitle: "Add an agent",
  name: "Name",
  workEmail: "Work email",
  role: "Role",
  roleLabels: { agent: "Agent", lead: "Lead", admin: "Admin" } as const,
  // 3.8 said "24 hours"; the link really lasts SETUP_LINK_LIFETIME (Brett confirmed 3600 seconds).
  helpLine: `They'll get an email to set a password and turn on two-factor sign-in. The invite link works once and expires in ${SETUP_LINK_LIFETIME}.`,
  sendInvite: "Send invite",
  sendingInvite: "Sending invite…",
  inviteSent: (email: string, name: string, levrid: number | null) =>
    levrid !== null
      ? `Invite sent to ${email}. ${name} is LEVRID ${levrid}.`
      : `Invite sent to ${email}. ${name} is a test agent, so has no LEVRID.`, // NEW (test agents only)
  inviteEmailFailed: (name: string, levrid: number | null, message: string) =>
    `${name} was added${levrid !== null ? ` as LEVRID ${levrid}` : ""}, but the invite email didn't send: ${message}.`,
  resendInvite: "Resend invite",
  resendingInvite: "Sending…", // NEW
  resendSent: (email: string) => `Invite sent again to ${email}.`,
  // NEW: the agents list and the two-factor reset
  agentsHeading: "Agents",
  columns: { name: "Name", email: "Work email", role: "Role", levrid: "LEVRID", status: "Sign-in" },
  status: { ready: "Two-factor on", invited: "Invite not finished", noLogin: "No login yet", oldLogin: "Old login, not moved yet" },
  testBadge: "TEST",
  you: "you",
  resetTwoFactor: "Reset two-factor",
  resetConfirm: (name: string) =>
    `Reset ${name}'s two-factor sign-in? They'll be signed out everywhere and set it up again next time they sign in. Confirm it's really them by phone or video first.`,
  resetConfirmButton: "Reset",
  resetting: "Resetting…",
  cancel: "Cancel",
  resetDone: (name: string) => `${name}'s two-factor sign-in was reset. They've been signed out everywhere.`,
} as const;
